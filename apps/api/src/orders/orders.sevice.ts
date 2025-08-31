import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, DriverStatus, Prisma, VehicleType } from '@prisma/client';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from 'src/database/prisma.service';

// Define proper types for the return value
interface FleetWithDriver {
  fleet: {
    id: string;
    vehicleType: VehicleType;
    status: string;
    plateNumber: string;
    brand: string;
    model: string;
    color: string;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    driverProfile: {
      id: string;
      rating: number;
      driverStatus: DriverStatus;
      currentLat: number | null;
      currentLng: number | null;
      isVerified: boolean;
      totalTrips: number;
      completedTrips: number;
    };
  };
}

interface FindAllFilters {
  status?: OrderStatus;
  driverId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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

    // Find available driver automatically for instant orders
    let assignedFleet: FleetWithDriver['fleet'] | null = null;
    let assignedDriver: FleetWithDriver['driver'] | null = null;

    if (!createOrderDto.scheduledAt || createOrderDto.tripType === 'INSTANT') {
      const availableFleetWithDriver = await this.findAvailableFleetAndDriver(
        createOrderDto.requestedVehicleType,
        createOrderDto.pickupCoordinates
      );
      
      if (availableFleetWithDriver) {
        assignedFleet = availableFleetWithDriver.fleet;
        assignedDriver = availableFleetWithDriver.driver;
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Create order
        const order = await tx.order.create({
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
            status: assignedDriver ? OrderStatus.DRIVER_ASSIGNED : OrderStatus.PENDING,
            fleetId: assignedFleet?.id || '',
            driverId: assignedDriver?.id || '',
            driverAssignedAt: assignedDriver ? new Date() : null,
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
                    currentLat: true,
                    currentLng: true,
                  }
                }
              }
            },
          },
        });

        // Create status history
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.PENDING,
            toStatus: order.status,
            reason: assignedDriver ? 'Order created and driver auto-assigned' : 'Order created',
          },
        });

        // If driver assigned, update driver status
        if (assignedDriver) {
          await tx.driverProfile.update({
            where: { userId: assignedDriver.id },
            data: {
              driverStatus: DriverStatus.BUSY,
              statusChangedAt: new Date(),
            },
          });

          // Create driver status history
          await tx.driverStatusHistory.create({
            data: {
              driverId: assignedDriver.driverProfile.id,
              fromStatus: DriverStatus.ACTIVE,
              toStatus: DriverStatus.BUSY,
              reason: 'Assigned to new order',
              metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
              },
            },
          });
        }

        return order;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderCreated(result);
      
      if (assignedDriver) {
        this.ordersGateway.emitOrderAssigned(result);
        this.ordersGateway.emitDriverStatusChanged(assignedDriver.id, DriverStatus.BUSY);
        
        // Send notification specifically to assigned driver
        this.ordersGateway.notifyDriverAssignment(assignedDriver.id, result);
      } else {
        // Notify all available drivers about new order
        this.ordersGateway.notifyAvailableDrivers(result);
      }

      return this.transformOrderResponse(result);
    } catch (error) {
      this.logger.error('Failed to create order', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Duplicate order detected');
        }
      }
      throw error;
    }
  }

  async assignDriver(orderId: string, assignDriverDto: AssignDriverDto, assignedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: true }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.NO_DRIVER_AVAILABLE) {
      throw new BadRequestException(`Cannot assign driver to order with status: ${order.status}`);
    }

    const driver = await this.prisma.user.findUnique({
      where: { id: assignDriverDto.driverId },
      include: { driverProfile: true },
    });

    if (!driver || !driver.driverProfile) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.driverProfile.driverStatus !== DriverStatus.ACTIVE) {
      throw new BadRequestException(`Driver is not available. Current status: ${driver.driverProfile.driverStatus}`);
    }

    const fleet = await this.prisma.fleet.findUnique({
      where: { id: assignDriverDto.fleetId },
    });

    if (!fleet) {
      throw new NotFoundException('Fleet not found');
    }

    if (fleet.status !== 'ACTIVE') {
      throw new BadRequestException(`Fleet is not available. Current status: ${fleet.status}`);
    }

    if (fleet.vehicleType !== order.requestedVehicleType) {
      throw new BadRequestException(
        `Fleet vehicle type (${fleet.vehicleType}) does not match requested type (${order.requestedVehicleType})`
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
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
                    currentLat: true,
                    currentLng: true,
                  }
                }
              }
            },
          },
        });

        await tx.driverProfile.update({
          where: { userId: assignDriverDto.driverId },
          data: {
            driverStatus: DriverStatus.BUSY,
            statusChangedAt: new Date(),
          },
        });

        await this.createStatusHistory(
          tx,
          orderId,
          order.status,
          OrderStatus.DRIVER_ASSIGNED,
          assignDriverDto.reason || 'Driver assigned',
          assignedBy
        );

        return updatedOrder;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderAssigned(result);
      this.ordersGateway.emitDriverStatusChanged(assignDriverDto.driverId, DriverStatus.BUSY);
      this.ordersGateway.notifyDriverAssignment(assignDriverDto.driverId, result);

      return this.transformOrderResponse(result);
    } catch (error) {
      this.logger.error('Failed to assign driver', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Order or driver not found');
        }
      }
      throw error;
    }
  }

  async updateStatus(orderId: string, updateOrderStatusDto: UpdateOrderStatusDto, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          include: {
            driverProfile: true
          }
        },
        fleet: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transition
    const validTransitions = this.getValidStatusTransitions(order.status);
    if (!validTransitions.includes(updateOrderStatusDto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${updateOrderStatusDto.status}`
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: updateOrderStatusDto.status,
            ...(updateOrderStatusDto.status === OrderStatus.DRIVER_ACCEPTED && { driverAcceptedAt: new Date() }),
            ...(updateOrderStatusDto.status === OrderStatus.DRIVER_ARRIVING && { driverArrivedAt: new Date() }),
            ...(updateOrderStatusDto.status === OrderStatus.IN_PROGRESS && { tripStartedAt: new Date() }),
            ...(updateOrderStatusDto.status === OrderStatus.COMPLETED && { 
              tripCompletedAt: new Date(),
              actualDurationMinutes: order.tripStartedAt ? 
                Math.round((new Date().getTime() - order.tripStartedAt.getTime()) / 60000) : null
            }),
            ...(updateOrderStatusDto.status.startsWith('CANCELLED') && { 
              cancelledAt: new Date(),
              cancelledReason: updateOrderStatusDto.reason
            }),
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
                    currentLat: true,
                    currentLng: true,
                  }
                }
              }
            },
          },
        });

        // Create status history
        await this.createStatusHistory(
          tx,
          orderId,
          order.status,
          updateOrderStatusDto.status,
          updateOrderStatusDto.reason,
          userId,
          updateOrderStatusDto.metadata
        );

        // Update driver status based on order status
        if (order.driver?.driverProfile) {
          let newDriverStatus: DriverStatus | null = null;
          
          if (updateOrderStatusDto.status === OrderStatus.COMPLETED || 
              updateOrderStatusDto.status.startsWith('CANCELLED')) {
            newDriverStatus = DriverStatus.ACTIVE;
          }

          if (newDriverStatus) {
            await tx.driverProfile.update({
              where: { userId: order.driverId },
              data: {
                driverStatus: newDriverStatus,
                statusChangedAt: new Date(),
                ...(updateOrderStatusDto.status === OrderStatus.COMPLETED && {
                  completedTrips: { increment: 1 },
                  totalTrips: { increment: 1 }
                }),
                ...(updateOrderStatusDto.status.startsWith('CANCELLED') && {
                  cancelledTrips: { increment: 1 },
                  totalTrips: { increment: 1 }
                })
              },
            });

            // Create driver status history
            await tx.driverStatusHistory.create({
              data: {
                driverId: order.driver.driverProfile.id,
                fromStatus: DriverStatus.BUSY,
                toStatus: newDriverStatus,
                reason: `Order ${updateOrderStatusDto.status.toLowerCase()}`,
                metadata: {
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                },
              },
            });
          }
        }

        return updatedOrder;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderStatusUpdated(result);
      
      if (order.driver?.driverProfile && 
          (updateOrderStatusDto.status === OrderStatus.COMPLETED || 
           updateOrderStatusDto.status.startsWith('CANCELLED'))) {
        this.ordersGateway.emitDriverStatusChanged(order.driverId, DriverStatus.ACTIVE);
      }

      return this.transformOrderResponse(result);
    } catch (error) {
      this.logger.error('Failed to update order status', error);
      throw error;
    }
  }

  async findAll(filters: FindAllFilters): Promise<PaginatedResponse<any>> {
    const { status, driverId, customerId, dateFrom, dateTo, page = 1, limit = 10 } = filters;

    const where: Prisma.OrderWhereInput = {
      ...(status && { status }),
      ...(driverId && { driverId }),
      ...(customerId && { customerId }),
      ...(dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
    };

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
                  currentLat: true,
                  currentLng: true,
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
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
                currentLat: true,
                currentLng: true,
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
          orderBy: { createdAt: 'asc' }
        }
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.transformOrderResponse(order);
  }

  // Helper method to find available fleet and driver
  private async findAvailableFleetAndDriver(
    vehicleType: VehicleType, 
    pickupCoordinates: { lat: number; lng: number }
  ): Promise<FleetWithDriver | null> {
    const availableFleetWithDriver = await this.prisma.fleet.findFirst({
      where: {
        vehicleType: vehicleType,
        status: 'ACTIVE',
        assignments: {
          some: {
            isActive: true,
            driver: {
              driverProfile: {
                driverStatus: 'ACTIVE',
                isVerified: true,
              }
            }
          }
        }
      },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            driver: {
              include: {
                driverProfile: true
              }
            }
          }
        }
      },
      // TODO: Add distance-based ordering using PostGIS or similar
    });

    if (!availableFleetWithDriver || 
        !availableFleetWithDriver.assignments.length || 
        !availableFleetWithDriver.assignments[0].driver?.driverProfile) {
      return null;
    }

    const assignment = availableFleetWithDriver.assignments[0];
    const driver = assignment.driver;

    // Ensure driver profile exists before proceeding
    if (!driver.driverProfile) {
      return null;
    }

    return {
      fleet: {
        id: availableFleetWithDriver.id,
        vehicleType: availableFleetWithDriver.vehicleType,
        status: availableFleetWithDriver.status,
        plateNumber: availableFleetWithDriver.plateNumber,
        brand: availableFleetWithDriver.brand,
        model: availableFleetWithDriver.model,
        color: availableFleetWithDriver.color,
      },
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        driverProfile: {
          id: driver.driverProfile.id,
          rating: driver.driverProfile.rating || 0,
          driverStatus: driver.driverProfile.driverStatus,
          currentLat: driver.driverProfile.currentLat,
          currentLng: driver.driverProfile.currentLng,
          isVerified: driver.driverProfile.isVerified,
          totalTrips: driver.driverProfile.totalTrips,
          completedTrips: driver.driverProfile.completedTrips,
        }
      }
    };
  }

  private getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.NO_DRIVER_AVAILABLE, OrderStatus.CANCELLED_BY_SYSTEM],
      [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.DRIVER_ACCEPTED, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.EXPIRED],
      [OrderStatus.DRIVER_ACCEPTED]: [OrderStatus.DRIVER_ARRIVING, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_CUSTOMER],
      [OrderStatus.DRIVER_ARRIVING]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED_BY_DRIVER, OrderStatus.CANCELLED_BY_CUSTOMER],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED_BY_DRIVER],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED_BY_CUSTOMER]: [],
      [OrderStatus.CANCELLED_BY_DRIVER]: [],
      [OrderStatus.CANCELLED_BY_SYSTEM]: [],
      [OrderStatus.EXPIRED]: [],
      [OrderStatus.NO_DRIVER_AVAILABLE]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED_BY_SYSTEM],
    };

    return transitions[currentStatus] || [];
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
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
    
    if (Math.abs(calculatedTotal - totalFare) > 100) {
      throw new BadRequestException(
        `Fare calculation mismatch. Expected: ${calculatedTotal}, Received: ${totalFare}`
      );
    }

    if (totalFare < baseFare) {
      throw new BadRequestException('Total fare cannot be less than base fare');
    }
  }

  private async createStatusHistory(
    tx: any,
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    reason?: string,
    changedBy?: string,
    metadata?: Record<string, any>
  ) {
    return tx.orderStatusHistory.create({
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