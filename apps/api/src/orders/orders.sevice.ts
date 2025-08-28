import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { OrderStatus, DriverStatus, Prisma } from '@prisma/client';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    // Validate fare calculation consistency
    this.validateFareCalculation(createOrderDto);

    // Generate unique order number
    const orderNumber = await this.generateOrderNumber();

    // Validate scheduled time if provided
    if (createOrderDto.scheduledAt) {
      const scheduledTime = new Date(createOrderDto.scheduledAt);
      if (scheduledTime <= new Date()) {
        throw new BadRequestException('Scheduled time must be in the future');
      }
    }

    try {
      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          tripType: createOrderDto.tripType || 'INSTANT',
          scheduledAt: createOrderDto.scheduledAt ? new Date(createOrderDto.scheduledAt) : null,
          passengerName: createOrderDto.passengerName,
          passengerPhone: createOrderDto.passengerPhone,
          specialRequests: createOrderDto.specialRequests,
          pickupAddress: createOrderDto.pickupAddress,
          pickupLat: createOrderDto.pickupCoordinates.lat,
          pickupLng: createOrderDto.pickupCoordinates.lng,
          dropoffAddress: createOrderDto.dropoffAddress,
          dropoffLat: createOrderDto.dropoffCoordinates.lat,
          dropoffLng: createOrderDto.dropoffCoordinates.lng,
          requestedVehicleType: createOrderDto.requestedVehicleType,
          distanceMeters: createOrderDto.distanceMeters,
          estimatedDurationMinutes: createOrderDto.estimatedDurationMinutes,
          baseFare: BigInt(createOrderDto.baseFare),
          distanceFare: BigInt(createOrderDto.distanceFare),
          airportFare: BigInt(createOrderDto.airportFare || 0),
          totalFare: BigInt(createOrderDto.totalFare),
          paymentMethod: createOrderDto.paymentMethod,
          status: OrderStatus.PENDING,
          // Temporary placeholder values - will be updated when driver is assigned
          fleetId: 'temp-fleet-id',
          driverId: 'temp-driver-id',
        },
        include: {
          fleet: true,
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              driverProfile: {
                select: {
                  rating: true,
                  driverStatus: true,
                }
              }
            }
          },
        },
      });

      // Create initial status history
      await this.createStatusHistory(order.id, OrderStatus.PENDING, OrderStatus.PENDING, 'Order created');

      // Emit real-time event
      this.ordersGateway.emitOrderCreated(order);

      return this.transformOrderResponse(order);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Duplicate order detected');
        }
      }
      throw error;
    }
  }

  async assignDriver(orderId: string, assignDriverDto: AssignDriverDto, assignedBy?: string) {
    // Validate order exists and is in correct status
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: true }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Cannot assign driver to order with status: ${order.status}`);
    }

    // Validate driver exists and is available
    const driver = await this.prisma.user.findUnique({
      where: { id: assignDriverDto.driverId },
      include: {
        driverProfile: true,
      }
    });

    if (!driver || !driver.driverProfile) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.driverProfile.driverStatus !== DriverStatus.ACTIVE) {
      throw new BadRequestException(`Driver is not available. Current status: ${driver.driverProfile.driverStatus}`);
    }

    // Validate fleet exists and is available
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: assignDriverDto.fleetId },
    });

    if (!fleet) {
      throw new NotFoundException('Fleet not found');
    }

    if (fleet.status !== 'ACTIVE') {
      throw new BadRequestException(`Fleet is not available. Current status: ${fleet.status}`);
    }

    // Check if vehicle type matches
    if (fleet.vehicleType !== order.requestedVehicleType) {
      throw new BadRequestException(
        `Fleet vehicle type (${fleet.vehicleType}) does not match requested type (${order.requestedVehicleType})`
      );
    }

    try {
      // Use transaction to ensure data consistency
      const result = await this.prisma.$transaction(async (tx) => {
        // Update order
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            driverId: assignDriverDto.driverId,
            fleetId: assignDriverDto.fleetId,
            status: OrderStatus.DRIVER_ASSIGNED,
            driverAssignedAt: new Date(),
          },
          include: {
            fleet: true,
            driver: {
              select: {
                id: true,
                name: true,
                phone: true,
                driverProfile: {
                  select: {
                    rating: true,
                    driverStatus: true,
                  }
                }
              }
            },
          },
        });

        // Update driver status to BUSY
        await tx.driverProfile.update({
          where: { userId: assignDriverDto.driverId },
          data: {
            driverStatus: DriverStatus.BUSY,
            statusChangedAt: new Date(),
          },
        });

        // Create status history
        await this.createStatusHistory(
          orderId,
          OrderStatus.PENDING,
          OrderStatus.DRIVER_ASSIGNED,
          assignDriverDto.reason || 'Driver assigned',
          assignedBy
        );

        return updatedOrder;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderAssigned(result);
      this.ordersGateway.emitDriverStatusChanged(assignDriverDto.driverId, DriverStatus.BUSY);

      return this.transformOrderResponse(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Order or driver not found');
        }
      }
      throw error;
    }
  }

  async updateStatus(orderId: string, updateStatusDto: UpdateOrderStatusDto, updatedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          include: { driverProfile: true }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, updateStatusDto.status);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Prepare update data
        const updateData: any = {
          status: updateStatusDto.status,
        };

        // Set timestamp based on status
        const now = new Date();
        switch (updateStatusDto.status) {
          case OrderStatus.DRIVER_ACCEPTED:
            updateData.driverAcceptedAt = now;
            break;
          case OrderStatus.DRIVER_ARRIVING:
            updateData.driverArrivedAt = now;
            break;
          case OrderStatus.IN_PROGRESS:
            updateData.tripStartedAt = now;
            break;
          case OrderStatus.COMPLETED:
            updateData.tripCompletedAt = now;
            updateData.paymentStatus = 'COMPLETED';
            break;
          case OrderStatus.CANCELLED_BY_CUSTOMER:
          case OrderStatus.CANCELLED_BY_DRIVER:
          case OrderStatus.CANCELLED_BY_SYSTEM:
            updateData.cancelledAt = now;
            updateData.cancelledReason = updateStatusDto.reason;
            break;
        }

        // Update order
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: updateData,
          include: {
            fleet: true,
            driver: {
              select: {
                id: true,
                name: true,
                phone: true,
                driverProfile: {
                  select: {
                    rating: true,
                    driverStatus: true,
                  }
                }
              }
            },
          },
        });

        // Update driver status if needed
        if (updateStatusDto.status === OrderStatus.COMPLETED || 
            updateStatusDto.status === OrderStatus.CANCELLED_BY_CUSTOMER ||
            updateStatusDto.status === OrderStatus.CANCELLED_BY_DRIVER ||
            updateStatusDto.status === OrderStatus.CANCELLED_BY_SYSTEM) {
          
          await tx.driverProfile.update({
            where: { userId: order.driverId },
            data: {
              driverStatus: DriverStatus.ACTIVE,
              statusChangedAt: now,
              ...(updateStatusDto.status === OrderStatus.COMPLETED && {
                completedTrips: { increment: 1 },
                totalTrips: { increment: 1 },
                totalEarnings: { increment: Number(order.totalFare) },
              }),
              ...(updateStatusDto.status.startsWith('CANCELLED') && {
                cancelledTrips: { increment: 1 },
                totalTrips: { increment: 1 },
              }),
            },
          });
        }

        // Create status history
        await this.createStatusHistory(
          orderId,
          order.status,
          updateStatusDto.status,
          updateStatusDto.reason,
          updatedBy,
          updateStatusDto.metadata
        );

        return updatedOrder;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderStatusUpdated(result);
      
      // If trip completed or cancelled, emit driver status change
      if (
        updateStatusDto.status === OrderStatus.COMPLETED ||
        updateStatusDto.status === OrderStatus.CANCELLED_BY_CUSTOMER ||
        updateStatusDto.status === OrderStatus.CANCELLED_BY_DRIVER ||
        updateStatusDto.status === OrderStatus.CANCELLED_BY_SYSTEM
      ) {
        this.ordersGateway.emitDriverStatusChanged(order.driverId, DriverStatus.ACTIVE);
      }

      return this.transformOrderResponse(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Order not found');
        }
      }
      throw error;
    }
  }

  async findAll(filters?: {
    status?: OrderStatus;
    driverId?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.driverId) {
      where.driverId = filters.driverId;
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          fleet: true,
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              driverProfile: {
                select: {
                  rating: true,
                  driverStatus: true,
                }
              }
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            }
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map(order => this.transformOrderResponse(order)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        fleet: true,
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            driverProfile: {
              select: {
                rating: true,
                driverStatus: true,
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        rating: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.transformOrderResponse(order);
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of orders created today
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayOrderCount = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequence = (todayOrderCount + 1).toString().padStart(3, '0');
    return `TXB-${dateStr}-${sequence}`;
  }

  private validateFareCalculation(createOrderDto: CreateOrderDto) {
    const { baseFare, distanceFare, airportFare = 0, totalFare } = createOrderDto;
    const calculatedTotal = baseFare + distanceFare + airportFare;
    
    if (Math.abs(calculatedTotal - totalFare) > 100) { // Allow 100 cents tolerance
      throw new BadRequestException(
        `Fare calculation mismatch. Expected: ${calculatedTotal}, Received: ${totalFare}`
      );
    }

    // Validate minimum fare
    if (totalFare < baseFare) {
      throw new BadRequestException('Total fare cannot be less than base fare');
    }
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus) {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED_BY_SYSTEM, OrderStatus.EXPIRED],
      [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.DRIVER_ACCEPTED, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_SYSTEM],
      [OrderStatus.DRIVER_ACCEPTED]: [OrderStatus.DRIVER_ARRIVING, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_CUSTOMER],
      [OrderStatus.DRIVER_ARRIVING]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_CUSTOMER],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_CUSTOMER],
      [OrderStatus.COMPLETED]: [], // Terminal status
      [OrderStatus.CANCELLED_BY_CUSTOMER]: [], // Terminal status
      [OrderStatus.CANCELLED_BY_DRIVER]: [], // Terminal status
      [OrderStatus.CANCELLED_BY_SYSTEM]: [], // Terminal status
      [OrderStatus.EXPIRED]: [], // Terminal status
      [OrderStatus.NO_DRIVER_AVAILABLE]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED_BY_SYSTEM],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async createStatusHistory(
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    reason?: string,
    changedBy?: string,
    metadata?: Record<string, any>
  ) {
    return this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        reason,
        changedBy,
        metadata,
      },
    });
  }

  private transformOrderResponse(order: any) {
    return {
      ...order,
      // Convert BigInt to number for JSON serialization
      baseFare: Number(order.baseFare),
      distanceFare: Number(order.distanceFare),
      timeFare: Number(order.timeFare),
      airportFare: Number(order.airportFare),
      surgeFare: Number(order.surgeFare),
      additionalFare: Number(order.additionalFare),
      discount: Number(order.discount),
      totalFare: Number(order.totalFare),
      cancellationFee: Number(order.cancellationFee),
    };
  }
}