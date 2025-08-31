import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, DriverStatus, Prisma } from '@prisma/client';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from 'src/database/prisma.service';

// Define proper types for the return value
interface FleetWithDriver {
  fleet: {
    id: string;
    vehicleType: string;
    status: string;
    // Add other fleet properties as needed
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    driverProfile: {
      id: string;
      rating: number;
      driverStatus: string;
      currentLat: number | null;
      currentLng: number | null;
      isVerified: boolean;
      // Add other driver profile properties as needed
    };
  };
}

@Injectable()
export class OrdersService {
  findOne(id: string) {
    throw new Error('Method not implemented.');
  }
  findAll(filters: any) {
    throw new Error('Method not implemented.');
  }
  updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto, id1: any) {
    throw new Error('Method not implemented.');
  }
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
            fleetId: assignedFleet ? assignedFleet.id : 'temp-fleet-id',
            driverId: assignedDriver ? assignedDriver.id : 'temp-driver-id',
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Order or driver not found');
        }
      }
      throw error;
    }
  }

  // Helper method to find available fleet and driver - Fixed return type
  private async findAvailableFleetAndDriver(
    vehicleType: string, 
    pickupCoordinates: { lat: number; lng: number }
  ): Promise<FleetWithDriver | null> {
    const availableFleetWithDriver = await this.prisma.fleet.findFirst({
      where: {
        vehicleType: vehicleType as any,
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
        // Add other fleet properties as needed
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
          // Add other driver profile properties as needed
        }
      }
    };
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

  // ... rest of methods (updateStatus, findAll, findOne) remain the same
}