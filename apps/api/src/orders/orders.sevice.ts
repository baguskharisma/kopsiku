import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, DriverStatus, Prisma, VehicleType } from '@prisma/client';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from 'src/database/prisma.service';

// Define proper types for the return value
export interface FleetWithDriver {
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
  private readonly ORDER_ASSIGNMENT_TIMEOUT = 30; // seconds
  private readonly ORDER_ACCEPTANCE_TIMEOUT = 120; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async create(createOrderDto: CreateOrderDto, createdBy?: string) {
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
      const result = await this.prisma.$transaction(async (tx) => {
        // Create order with PENDING status first
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
            status: OrderStatus.PENDING,
            // Leave driver and fleet empty initially
            fleetId: '',
            driverId: '',
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
            toStatus: OrderStatus.PENDING,
            reason: 'Order created by operator',
            changedBy: createdBy,
          },
        });

        return order;
      });

      // Emit order created event
      this.ordersGateway.emitOrderCreated(result);
      
      // Log order creation
      this.logger.log(`Order created: ${result.orderNumber} by ${createdBy || 'system'}`);

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
      include: { 
        driver: true,
        fleet: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.NO_DRIVER_AVAILABLE) {
      throw new BadRequestException(`Cannot assign driver to order with status: ${order.status}`);
    }

    // Validate driver availability and permissions
    await this.validateDriverAssignment(assignDriverDto.driverId, assignDriverDto.fleetId, order.requestedVehicleType);

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
          tx,
          orderId,
          order.status,
          OrderStatus.DRIVER_ASSIGNED,
          assignDriverDto.reason || 'Driver assigned by operator',
          assignedBy
        );

        // Create driver status history
        await tx.driverStatusHistory.create({
          data: {
            driverId: assignDriverDto.driverId,
            fromStatus: DriverStatus.ACTIVE,
            toStatus: DriverStatus.BUSY,
            reason: 'Assigned to new order',
            changedBy: assignedBy,
            metadata: {
              orderId: updatedOrder.id,
              orderNumber: updatedOrder.orderNumber,
            },
          },
        });

        return updatedOrder;
      });

      // Emit real-time events
      this.ordersGateway.emitOrderAssigned(result);
      this.ordersGateway.emitDriverStatusChanged(assignDriverDto.driverId, DriverStatus.BUSY);
      
      // Send notification specifically to assigned driver
      this.ordersGateway.notifyDriverAssignment(assignDriverDto.driverId, result);

      // Set timeout for driver acceptance
      this.scheduleAcceptanceTimeout(result.id, assignDriverDto.driverId);

      this.logger.log(`Order ${result.orderNumber} assigned to driver ${assignDriverDto.driverId} by ${assignedBy || 'system'}`);

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
        const updateData: any = {
          status: updateOrderStatusDto.status,
        };

        // Add timestamp fields based on status
        switch (updateOrderStatusDto.status) {
          case OrderStatus.DRIVER_ACCEPTED:
            updateData.driverAcceptedAt = new Date();
            break;
          case OrderStatus.DRIVER_ARRIVING:
            updateData.driverArrivedAt = new Date();
            break;
          case OrderStatus.IN_PROGRESS:
            updateData.tripStartedAt = new Date();
            break;
          case OrderStatus.COMPLETED:
            updateData.tripCompletedAt = new Date();
            if (order.tripStartedAt) {
              updateData.actualDurationMinutes = Math.round(
                (new Date().getTime() - order.tripStartedAt.getTime()) / 60000
              );
            }
            break;
        }

        // Handle cancellation fields
        if (updateOrderStatusDto.status.startsWith('CANCELLED')) {
          updateData.cancelledAt = new Date();
          updateData.cancelledReason = updateOrderStatusDto.reason;
        }

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
          let statusChangeReason = '';
          
          if (updateOrderStatusDto.status === OrderStatus.COMPLETED) {
            newDriverStatus = DriverStatus.ACTIVE;
            statusChangeReason = 'Trip completed successfully';
            
            // Update driver statistics
            await tx.driverProfile.update({
              where: { userId: order.driverId },
              data: {
                driverStatus: newDriverStatus,
                statusChangedAt: new Date(),
                completedTrips: { increment: 1 },
                totalTrips: { increment: 1 },
              },
            });
          } else if (updateOrderStatusDto.status.startsWith('CANCELLED')) {
            newDriverStatus = DriverStatus.ACTIVE;
            statusChangeReason = `Trip cancelled: ${updateOrderStatusDto.reason || 'Unknown reason'}`;
            
            // Update driver statistics
            await tx.driverProfile.update({
              where: { userId: order.driverId },
              data: {
                driverStatus: newDriverStatus,
                statusChangedAt: new Date(),
                cancelledTrips: { increment: 1 },
                totalTrips: { increment: 1 },
              },
            });
          }

          if (newDriverStatus) {
            // Create driver status history
            await tx.driverStatusHistory.create({
              data: {
                driverId: order.driver.driverProfile.id,
                fromStatus: DriverStatus.BUSY,
                toStatus: newDriverStatus,
                reason: statusChangeReason,
                changedBy: userId,
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

      this.logger.log(`Order ${result.orderNumber} status updated to ${updateOrderStatusDto.status} by ${userId || 'system'}`);

      return this.transformOrderResponse(result);
    } catch (error) {
      this.logger.error('Failed to update order status', error);
      throw error;
    }
  }

  // Enhanced method to find available drivers
  async findAvailableDrivers(
    vehicleType: VehicleType, 
    pickupCoordinates: { lat: number; lng: number },
    radiusKm: number = 10
  ): Promise<FleetWithDriver[]> {
    const availableFleetWithDrivers = await this.prisma.fleet.findMany({
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
                currentLat: { not: null },
                currentLng: { not: null },
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
      take: 20, // Limit initial results
    });

    const eligibleDrivers: FleetWithDriver[] = [];

    for (const fleet of availableFleetWithDrivers) {
      if (!fleet.assignments.length || !fleet.assignments[0].driver?.driverProfile) {
        continue;
      }

      const assignment = fleet.assignments[0];
      const driver = assignment.driver;
      const profile = driver.driverProfile;

      // Calculate distance if coordinates are available
      if (profile && profile.currentLat != null && profile.currentLng != null) {
        const distance = this.calculateDistance(
          pickupCoordinates.lat,
          pickupCoordinates.lng,
          profile.currentLat,
          profile.currentLng
        );

        if (distance <= radiusKm) {
          eligibleDrivers.push({
            fleet: {
              id: fleet.id,
              vehicleType: fleet.vehicleType,
              status: fleet.status,
              plateNumber: fleet.plateNumber,
              brand: fleet.brand,
              model: fleet.model,
              color: fleet.color,
            },
            driver: {
              id: driver.id,
              name: driver.name,
              phone: driver.phone,
              driverProfile: {
                id: profile.id,
                rating: profile.rating || 0,
                driverStatus: profile.driverStatus,
                currentLat: profile.currentLat,
                currentLng: profile.currentLng,
                isVerified: profile.isVerified,
                totalTrips: profile.totalTrips,
                completedTrips: profile.completedTrips,
              }
            }
          });
        }
      }
    }

    // Sort by distance and rating
    return eligibleDrivers.sort((a, b) => {
      const distanceA = this.calculateDistance(
        pickupCoordinates.lat,
        pickupCoordinates.lng,
        a.driver.driverProfile.currentLat!,
        a.driver.driverProfile.currentLng!
      );
      const distanceB = this.calculateDistance(
        pickupCoordinates.lat,
        pickupCoordinates.lng,
        b.driver.driverProfile.currentLat!,
        b.driver.driverProfile.currentLng!
      );

      // Primary sort by distance, secondary by rating
      if (Math.abs(distanceA - distanceB) < 1) { // If distances are similar (within 1km)
        return b.driver.driverProfile.rating - a.driver.driverProfile.rating;
      }
      return distanceA - distanceB;
    });
  }

  // Helper method to validate driver assignment
  private async validateDriverAssignment(
    driverId: string, 
    fleetId: string, 
    requiredVehicleType: VehicleType
  ): Promise<void> {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });

    if (!driver || !driver.driverProfile) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.driverProfile.driverStatus !== DriverStatus.ACTIVE) {
      throw new BadRequestException(
        `Driver is not available. Current status: ${driver.driverProfile.driverStatus}`
      );
    }

    if (!driver.driverProfile.isVerified) {
      throw new BadRequestException('Driver is not verified');
    }

    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: {
        assignments: {
          where: {
            driverId: driverId,
            isActive: true,
          }
        }
      }
    });

    if (!fleet) {
      throw new NotFoundException('Fleet not found');
    }

    if (fleet.status !== 'ACTIVE') {
      throw new BadRequestException(`Fleet is not available. Current status: ${fleet.status}`);
    }

    if (fleet.vehicleType !== requiredVehicleType) {
      throw new BadRequestException(
        `Fleet vehicle type (${fleet.vehicleType}) does not match requested type (${requiredVehicleType})`
      );
    }

    if (!fleet.assignments.length) {
      throw new BadRequestException('Driver is not assigned to this fleet');
    }
  }

  // Method to handle acceptance timeout
  private scheduleAcceptanceTimeout(orderId: string, driverId: string) {
    setTimeout(async () => {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
        });

        // Check if order is still in DRIVER_ASSIGNED status
        if (order && order.status === OrderStatus.DRIVER_ASSIGNED) {
          this.logger.warn(`Driver ${driverId} did not accept order ${order.orderNumber} within timeout`);
          
          // Update order status to expired and make driver available
          await this.updateStatus(orderId, {
            status: OrderStatus.EXPIRED,
            reason: 'Driver did not accept within time limit',
          }, 'system');

          // Optionally, try to reassign to another driver
          // await this.findAndAssignNextDriver(orderId);
        }
      } catch (error) {
        this.logger.error(`Error handling acceptance timeout for order ${orderId}:`, error);
      }
    }, this.ORDER_ACCEPTANCE_TIMEOUT * 1000);
  }

  // Utility method to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLng = this.degreesToRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) *
        Math.cos(this.degreesToRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Keep all existing methods...
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
      [OrderStatus.EXPIRED]: [OrderStatus.DRIVER_ASSIGNED], // Allow reassignment
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