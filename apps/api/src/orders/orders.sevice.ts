import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, DriverStatus, Prisma, VehicleType, CoinTransactionType, CoinTransactionStatus } from '@prisma/client';
import { OrdersGateway } from './orders.gateway';
import { PrismaService } from 'src/database/prisma.service';
import { CoinService } from 'src/coins/coins.service';

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

export interface DriverLocation {
  lat: number | null;
  lng: number | null;
}

export interface FleetInfo {
  id: string;
  vehicleType: VehicleType;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  status: string;
}

export interface ActiveDriverResponse {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  rating: number;
  status: DriverStatus;
  currentLocation: DriverLocation;
  fleets: FleetInfo[];
  // Backward compatibility fields
  plate: string;
  vehicleType: VehicleType | undefined;
  fleetId: string | undefined;
}

export interface GetDriversFilters {
  vehicleType?: VehicleType;
  status?: DriverStatus;
}

interface OperationalFeeResult {
  success: boolean;
  transactionId?: string;
  feeAmount: string;
  newBalance: string;
  message: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly ORDER_ASSIGNMENT_TIMEOUT = 30; // seconds
  private readonly ORDER_ACCEPTANCE_TIMEOUT = 120; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersGateway: OrdersGateway,
    private readonly coinService: CoinService
  ) {}

  
  async getActiveDrivers(filters: GetDriversFilters = {}) {
    const { vehicleType, status = DriverStatus.ACTIVE } = filters;

  try {
    // Start with FleetAssignment to ensure we only get drivers with active assignments
    const assignments = await this.prisma.fleetAssignment.findMany({
      where: {
        isActive: true,
        fleet: {
          status: 'ACTIVE',
          ...(vehicleType && { vehicleType }),
        },
        driver: {
          role: 'DRIVER',
          // isActive: true,
          // isVerified: true,
        }
      },
      include: {
        driver: {
          include: {
            driverProfile: {
              where: {
                // driverStatus: status,
                // isVerified: true,
              }
            }
          }
        },
        fleet: {
          select: {
            id: true,
            vehicleType: true,
            plateNumber: true,
            brand: true,
            model: true,
            color: true,
            status: true,
            year: true,
            capacity: true,
            type: true,
          }
        }
      },
      orderBy: {
        driver: {
          driverProfile: {
            rating: 'desc'
          }
        }
      }
    });

    // Filter out assignments where driver has a valid DriverProfile (array with at least one entry)
    // const validAssignments = assignments.filter(assignment => 
    //   Array.isArray(assignment.driver.driverProfile) && assignment.driver.driverProfile.length > 0
    // );

    const validAssignments = assignments;

    console.log('Raw assignments count:', assignments.length);
    console.log('Sample assignment:', JSON.stringify(assignments[0], (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2
    ));
    console.log('Valid assignments count:', validAssignments.length);

    // Group by driver to avoid duplicates
    const driverMap = new Map();
    
    validAssignments.forEach(assignment => {
      const driverId = assignment.driver.id;
      
      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driver: assignment.driver,
          assignments: []
        });
      }
      
      driverMap.get(driverId).assignments.push(assignment);
    });

    // Transform to expected format
   // Transform to expected format
return Array.from(driverMap.values()).map(({ driver, assignments }) => {
  // Handle both array and single object for driverProfile
  const driverProfile = driver.driverProfile?.length 
    ? driver.driverProfile[0] 
    : driver.driverProfile;
  
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    rating: driverProfile?.rating ?? 0,
    status: driverProfile?.driverStatus ?? status,
    isVerified: driverProfile?.isVerified ?? false,
    currentLocation: driverProfile
      ? { lat: driverProfile.currentLat, lng: driverProfile.currentLng }
      : null,
    lastLocationUpdate: driverProfile?.lastLocationUpdate,
    fleets: assignments.map(a => ({
      id: a.fleet.id,
      vehicleType: a.fleet.vehicleType,
      plateNumber: a.fleet.plateNumber,
      brand: a.fleet.brand,
      model: a.fleet.model,
      color: a.fleet.color,
      status: a.fleet.status,
      year: a.fleet.year,
      capacity: a.fleet.capacity,
      type: a.fleet.type,
    })),
    // backward compatibility
    plate: assignments[0]?.fleet.plateNumber ?? '',
    vehicleType: assignments[0]?.fleet.vehicleType,
    fleetId: assignments[0]?.fleet.id,
  };
});

  } catch (error) {
    this.logger.error('Error in getActiveDriversSimple:', error);
    throw error;
  }
  }

  async getDriverFleetMapping(driverId: string): Promise<string | null> {
    try {
      const assignment = await this.prisma.fleetAssignment.findFirst({
        where: {
          driverId: driverId,
          isActive: true,
          fleet: {
            status: 'ACTIVE',
          }
        },
        include: {
          fleet: {
            select: {
              id: true,
              status: true,
            }
          }
        }
      });
  
      return assignment?.fleet.id || null;
    } catch (error) {
      this.logger.error(`Failed to get fleet mapping for driver ${driverId}:`, error);
      return null;
    }
  }

  // async create(createOrderDto: CreateOrderDto, createdBy?: string) {
  //   // Validate fare calculation consistency
  //   this.validateFareCalculation(createOrderDto);
  
  //   // Generate unique order number
  //   const orderNumber = await this.generateOrderNumber();
  
  //   // Validate scheduled time if provided
  //   if (createOrderDto.scheduledAt) {
  //     const scheduledTime = new Date(createOrderDto.scheduledAt);
  //     if (scheduledTime <= new Date()) {
  //       throw new BadRequestException('Scheduled time must be in the future');
  //     }
  //   }
  
  //   // Sanitize input data
  //   const sanitizedData = {
  //     ...createOrderDto,
  //     passengerName: this.sanitizeString(createOrderDto.passengerName),
  //     passengerPhone: this.sanitizePhoneNumber(createOrderDto.passengerPhone),
  //     pickupAddress: this.sanitizeString(createOrderDto.pickupAddress),
  //     dropoffAddress: this.sanitizeString(createOrderDto.dropoffAddress),
  //     specialRequests: createOrderDto.specialRequests 
  //       ? this.sanitizeString(createOrderDto.specialRequests) 
  //       : null,
  //   };

  //   // Check if operator exists and has sufficient coin balance
  //   let customerHasWallet = false;
  //   let operationalFeePreview: OperationalFeeResult | null = null;
    
  //   if (createOrderDto.adminId) {
  //     try {
  //       const walletBalance = await this.coinService.getWalletBalance(createOrderDto.adminId);
  //       customerHasWallet = true;
        
  //       // Calculate operational fee preview (don't deduct yet)
  //       const feeAmount = this.calculateOperationalFeeAmount(BigInt(sanitizedData.baseFare));
        
  //       if (BigInt(walletBalance) < feeAmount) {
  //         this.logger.warn(`Customer ${createOrderDto.adminId} has insufficient coins for operational fee`, {
  //           required: feeAmount.toString(),
  //           available: walletBalance,
  //           orderId: 'pending',
  //         });
          
  //         throw new BadRequestException(
  //           `Insufficient coin balance for operational fee. Required: ${feeAmount.toString()} coins, Available: ${walletBalance} coins. Please top up your account.`
  //         );
  //       }
  //     } catch (error) {
  //       if (error instanceof BadRequestException) {
  //         throw error; // Re-throw balance insufficient errors
  //       }
        
  //       this.logger.warn(`Could not check customer coin balance: ${error.message}`, {
  //         customerId: createOrderDto.adminId,
  //       });
  //       // Continue without coin deduction if wallet doesn't exist
  //     }
  //   }
  
  //   try {
  //     const result = await this.prisma.$transaction(async (tx) => {
  //       // Create the order first
  //       const order = await tx.order.create({
  //         data: {
  //           orderNumber,
  //           tripType: sanitizedData.tripType || 'INSTANT',
  //           scheduledAt: sanitizedData.scheduledAt ? new Date(sanitizedData.scheduledAt) : null,
  //           passengerName: sanitizedData.passengerName,
  //           passengerPhone: sanitizedData.passengerPhone,
  //           specialRequests: sanitizedData.specialRequests,
  //           pickupAddress: sanitizedData.pickupAddress,
  //           pickupLat: sanitizedData.pickupCoordinates.lat,
  //           pickupLng: sanitizedData.pickupCoordinates.lng,
  //           dropoffAddress: sanitizedData.dropoffAddress,
  //           dropoffLat: sanitizedData.dropoffCoordinates.lat,
  //           dropoffLng: sanitizedData.dropoffCoordinates.lng,
  //           requestedVehicleType: sanitizedData.requestedVehicleType,
  //           distanceMeters: sanitizedData.distanceMeters,
  //           estimatedDurationMinutes: sanitizedData.estimatedDurationMinutes,
  //           baseFare: BigInt(sanitizedData.baseFare),
  //           distanceFare: BigInt(sanitizedData.distanceFare),
  //           airportFare: BigInt(sanitizedData.airportFare || 0),
  //           totalFare: BigInt(sanitizedData.totalFare),
  //           paymentMethod: sanitizedData.paymentMethod,
  //           status: OrderStatus.PENDING,
  //           driverId: null,
  //           fleetId: null,
  //           // Initialize operational fee fields
  //           operationalFeeStatus: customerHasWallet ? 'PENDING' : 'NOT_APPLICABLE',
  //           // Create nested status history
  //           statusHistory: {
  //             create: {
  //               fromStatus: OrderStatus.PENDING,
  //               toStatus: OrderStatus.PENDING,
  //               reason: 'Order created by operator',
  //               changedBy: createdBy || null,
  //             },
  //           },
  //         },
  //         include: {
  //           statusHistory: true,
  //         },
  //       });

  //       // Deduct operational fee if customer has wallet
  //       if (customerHasWallet && createOrderDto.adminId) {
  //         try {
  //           const feeResult = await this.coinService.deductOperationalFee(
  //             createOrderDto.adminId,
  //             order.id,
  //             BigInt(sanitizedData.baseFare)
  //           );
            
  //           this.logger.log(`Operational fee deducted for order ${order.orderNumber}`, {
  //             orderId: order.id,
  //             customerId: createOrderDto.adminId,
  //             feeAmount: feeResult.feeAmount,
  //             newBalance: feeResult.newBalance,
  //             transactionId: feeResult.transactionId,
  //           });
            
  //           operationalFeePreview = feeResult;
            
  //         } catch (feeError) {
  //           this.logger.error(`Failed to deduct operational fee for order ${order.orderNumber}`, {
  //             orderId: order.id,
  //             customerId: createOrderDto.adminId,
  //             error: feeError.message,
  //             stack: feeError.stack,
  //           });
            
  //           // Update order to mark operational fee as failed
  //           await tx.order.update({
  //             where: { id: order.id },
  //             data: {
  //               operationalFeeStatus: 'FAILED',
  //               operationalFeeConfig: { 
  //                 error: feeError.message,
  //                 failedAt: new Date().toISOString(),
  //               },
  //             },
  //           });
            
  //           // Don't fail the entire order creation, just log the warning
  //           this.logger.warn(`Order ${order.orderNumber} created but operational fee could not be deducted`);
  //         }
  //       }

  //       return order;
  //     }, {
  //       isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  //       timeout: 30000, // 30 seconds timeout
  //     });

  //     // Transform BigInt fields to strings before emitting events or logging
  //     const transformedResult = this.transformOrderResponse(result);

  //     // Add operational fee info to response
  //     if (operationalFeePreview) {
  //       transformedResult.operationalFee = {
  //         charged: (operationalFeePreview as OperationalFeeResult | null)?.success || false,
  //         amount: (operationalFeePreview as OperationalFeeResult | null)?.feeAmount || false,
  //         transactionId: (operationalFeePreview as OperationalFeeResult | null)?.transactionId || false,
  //         remainingBalance: (operationalFeePreview as OperationalFeeResult | null)?.newBalance || false,
  //       };
  //     }

  //     // Emit order created event with transformed data
  //     this.ordersGateway.emitOrderCreated(transformedResult);
      
  //     this.logger.log(`Order created successfully: ${result.orderNumber} by ${createdBy || 'system'}`, {
  //       orderId: result.id,
  //       orderNumber: result.orderNumber,
  //       passengerName: sanitizedData.passengerName,
  //       totalFare: result.totalFare.toString(),
  //       operationalFeeCharged: (operationalFeePreview as OperationalFeeResult | null)?.success || false,
  //     });

  //     return transformedResult;
      
  //   } catch (error) {
  //     this.logger.error('Failed to create order', {
  //       error: error.message,
  //       stack: error.stack,
  //       createdBy,
  //       passengerName: sanitizedData.passengerName,
  //       orderNumber,
  //     });
      
  //     if (error instanceof Prisma.PrismaClientKnownRequestError) {
  //       if (error.code === 'P2002') {
  //         throw new ConflictException('Duplicate order detected');
  //       }
  //       if (error.code === 'P2003') {
  //         throw new BadRequestException('Referenced data not found');
  //       }
  //     }
      
  //     throw error;
  //   }
  // }

  async create(createOrderDto: CreateOrderDto, createdBy?: string) {
    this.validateFareCalculation(createOrderDto);
    const orderNumber = await this.generateOrderNumber();
  
    this.logger.log(`🔍 Order creation started`, {
      adminId: createOrderDto.adminId,
      baseFare: createOrderDto.baseFare,
      distanceFare: createOrderDto.distanceFare,
      distanceMeters: createOrderDto.distanceMeters,
      orderNumber,
    });
  
    const sanitizedData = {
      ...createOrderDto,
      passengerName: this.sanitizeString(createOrderDto.passengerName),
      passengerPhone: this.sanitizePhoneNumber(createOrderDto.passengerPhone),
      pickupAddress: this.sanitizeString(createOrderDto.pickupAddress),
      dropoffAddress: this.sanitizeString(createOrderDto.dropoffAddress),
      specialRequests: createOrderDto.specialRequests 
        ? this.sanitizeString(createOrderDto.specialRequests) 
        : null,
    };
  
    // Pre-validate customer wallet if adminId is provided
    let customerHasWallet = false;
    
    if (createOrderDto.adminId) {
      try {
        this.logger.log(`🔍 Checking wallet for customer: ${createOrderDto.adminId}`);
        
        const walletBalance = await this.coinService.getWalletBalance(createOrderDto.adminId);
        customerHasWallet = true;
        
        // Calculate required fee berdasarkan distanceMeters
        const requiredFeeAmount = this.calculateOperationalFeeAmount(
          BigInt(sanitizedData.baseFare),
          BigInt(sanitizedData.distanceFare), 
          sanitizedData.distanceMeters
        );
        
        this.logger.log(`💰 Wallet validation`, {
          customerId: createOrderDto.adminId,
          currentBalance: walletBalance,
          baseFare: sanitizedData.baseFare,
          distanceFare: sanitizedData.distanceFare,
          distanceMeters: sanitizedData.distanceMeters,
          requiredFee: requiredFeeAmount.toString(),
          feeRule: this.getFeeRuleDescription(sanitizedData.distanceMeters),
          hasEnoughBalance: BigInt(walletBalance) >= requiredFeeAmount,
        });
        
        if (BigInt(walletBalance) < requiredFeeAmount) {
          const feeRule = this.getFeeRuleDescription(sanitizedData.distanceMeters);
          throw new BadRequestException(
            `Insufficient coin balance. Required: ${requiredFeeAmount.toString()} coins (${feeRule}), Available: ${walletBalance} coins`
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(`❌ Customer wallet check failed:`, {
          customerId: createOrderDto.adminId,
          error: (error as Error).message,
        });
      }
    } else {
      this.logger.warn(`⚠️ No adminId provided, skipping operational fee`);
    }
  
    try {
      // Create order first
      this.logger.log(`📄 Creating order in database...`);
      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          tripType: sanitizedData.tripType || 'INSTANT',
          scheduledAt: sanitizedData.scheduledAt ? new Date(sanitizedData.scheduledAt) : null,
          passengerName: sanitizedData.passengerName,
          passengerPhone: sanitizedData.passengerPhone,
          specialRequests: sanitizedData.specialRequests,
          pickupAddress: sanitizedData.pickupAddress,
          pickupLat: sanitizedData.pickupCoordinates.lat,
          pickupLng: sanitizedData.pickupCoordinates.lng,
          dropoffAddress: sanitizedData.dropoffAddress,
          dropoffLat: sanitizedData.dropoffCoordinates.lat,
          dropoffLng: sanitizedData.dropoffCoordinates.lng,
          requestedVehicleType: sanitizedData.requestedVehicleType,
          distanceMeters: sanitizedData.distanceMeters,
          estimatedDurationMinutes: sanitizedData.estimatedDurationMinutes,
          baseFare: BigInt(sanitizedData.baseFare),
          distanceFare: BigInt(sanitizedData.distanceFare),
          airportFare: BigInt(sanitizedData.airportFare || 0),
          totalFare: BigInt(sanitizedData.totalFare),
          paymentMethod: sanitizedData.paymentMethod,
          status: OrderStatus.COMPLETED,
          operationalFeeStatus: customerHasWallet ? 'COMPLETED' : 'NOT_APPLICABLE',
          statusHistory: {
            create: {
              fromStatus: OrderStatus.COMPLETED,
              toStatus: OrderStatus.COMPLETED,
              reason: 'Order created by operator',
              changedBy: createdBy || null,
            },
          },
        },
        include: { statusHistory: true },
      });
  
      this.logger.log(`✅ Order created in database`, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        distanceMeters: order.distanceMeters,
        operationalFeeStatus: order.operationalFeeStatus,
      });
  
      // Process operational fee if customer has wallet
      let operationalFeeResult: OperationalFeeResult | null = null;
      
      if (customerHasWallet && createOrderDto.adminId) {
        this.logger.log(`💳 Starting operational fee deduction...`);
        
        try {
          // UPDATED: Pass distanceMeters to deductOperationalFee
          operationalFeeResult = await this.coinService.deductOperationalFee(
            createOrderDto.adminId,
            order.id,
            BigInt(order.baseFare),
            BigInt(order.distanceFare),
            order.distanceMeters as number // Ensure distanceMeters is a number
          );
          
          this.logger.log(`✅ Operational fee processed successfully`, {
            orderId: order.id,
            customerId: createOrderDto.adminId,
            distanceMeters: order.distanceMeters,
            feeAmount: operationalFeeResult.feeAmount,
            newBalance: operationalFeeResult.newBalance,
            transactionId: operationalFeeResult.transactionId,
            success: operationalFeeResult.success,
            feeRule: this.getFeeRuleDescription(order.distanceMeters as number),
          });
          
        } catch (feeError) {
          this.logger.error(`❌ Operational fee processing failed`, {
            orderId: order.id,
            customerId: createOrderDto.adminId,
            distanceMeters: order.distanceMeters,
            error: (feeError as Error).message,
            stack: (feeError as Error).stack,
          });
          
          // Update order to mark fee as failed
          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              operationalFeeStatus: 'FAILED',
              operationalFeeConfig: { 
                error: (feeError as Error).message,
                failedAt: new Date().toISOString(),
                distanceMeters: order.distanceMeters,
              },
            },
          });
          
          this.logger.warn(`⚠️ Order created but operational fee failed - continuing anyway`);
        }
      } else {
        this.logger.log(`ℹ️ Skipping operational fee`, {
          customerHasWallet,
          adminId: createOrderDto.adminId,
        });
      }
  
      const transformedResult = this.transformOrderResponse(order);
  
      // Add operational fee info to response
      if (operationalFeeResult && operationalFeeResult.success) {
        transformedResult.operationalFee = {
          charged: operationalFeeResult.success,
          amount: operationalFeeResult.feeAmount,
          transactionId: operationalFeeResult.transactionId || '',
          remainingBalance: operationalFeeResult.newBalance,
          feeRule: this.getFeeRuleDescription(order.distanceMeters as number),
          distanceMeters: order.distanceMeters as number,
        };
      }
      // Emit events
      this.ordersGateway.emitOrderCreated(transformedResult);
      
      this.logger.log(`🎉 Order creation completed`, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        distanceMeters: order.distanceMeters,
        totalFare: order.totalFare.toString(),
        operationalFeeCharged: operationalFeeResult?.success || false,
        operationalFeeAmount: operationalFeeResult?.feeAmount ?? 'N/A',
        feeRule: order.distanceMeters !== null && order.distanceMeters !== undefined
          ? this.getFeeRuleDescription(order.distanceMeters)
          : 'N/A',
      });

      return transformedResult;
    } catch (error) {
      this.logger.error(`💥 Order creation failed`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        orderNumber,
        passengerName: sanitizedData.passengerName,
        adminId: createOrderDto.adminId,
        distanceMeters: sanitizedData.distanceMeters,
      });
      throw error;
    }
  }
  
  // 2. CRITICAL CHECK: Pastikan method deductOperationalFee tidak di-comment
  // Di coins.service.ts - UNCOMMENT method ini:
  
  async deductOperationalFee(
    userId: string, 
    orderId: string, 
    distanceFareAmount: bigint
  ): Promise<OperationalFeeResult> {
    // Debug logging
    this.logger.log(`🔍 deductOperationalFee called`, {
      userId,
      orderId,
      distanceFareAmount: distanceFareAmount.toString(),
    });
  
    const feeConfig = await this.getOperationalFeeConfig();
    const feeAmount = this.calculateOperationalFee(distanceFareAmount, feeConfig.percentageOfBaseFare);
  
    this.logger.log(`💰 Fee calculation`, {
      userId,
      orderId,
      distanceFareAmount: distanceFareAmount.toString(),
      feePercentage: feeConfig.percentageOfBaseFare,
      calculatedFee: feeAmount.toString(),
    });
  
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Get current wallet with version for optimistic locking
        const wallet = await tx.coinWallet.findUnique({
          where: { userId },
        });
  
        if (!wallet) {
          throw new BadRequestException('Coin wallet not found. Please contact support.');
        }
  
        this.logger.log(`💳 Current wallet state`, {
          userId,
          balance: wallet.balance.toString(),
          totalSpent: wallet.totalSpent.toString(),
          totalOperationalFees: wallet.totalOperationalFees.toString(),
          version: wallet.version,
          isFrozen: wallet.isFrozen,
        });
  
        if (wallet.isFrozen) {
          throw new BadRequestException('Wallet is frozen. Cannot process operational fee.');
        }
  
        if (wallet.balance < feeAmount) {
          throw new BadRequestException(
            `Insufficient coins. Required: ${feeAmount.toString()}, Available: ${wallet.balance.toString()}`
          );
        }
  
        const newBalance = wallet.balance - feeAmount;
        const newTotalSpent = wallet.totalSpent + feeAmount;
        const newTotalOperationalFees = wallet.totalOperationalFees + feeAmount;
  
        this.logger.log(`🔄 Updating wallet`, {
          userId,
          oldBalance: wallet.balance.toString(),
          deductAmount: feeAmount.toString(),
          newBalance: newBalance.toString(),
          oldTotalSpent: wallet.totalSpent.toString(),
          newTotalSpent: newTotalSpent.toString(),
          oldTotalOperationalFees: wallet.totalOperationalFees.toString(),
          newTotalOperationalFees: newTotalOperationalFees.toString(),
        });
  
        // Update wallet with optimistic locking
        const updatedWallet = await tx.coinWallet.update({
          where: { 
            userId,
            version: wallet.version, // Optimistic locking
          },
          data: {
            balance: newBalance,
            totalSpent: newTotalSpent,
            totalOperationalFees: newTotalOperationalFees,
            version: { increment: 1 },
            lastTransactionAt: new Date(),
          },
        });
  
        this.logger.log(`✅ Wallet updated successfully`, {
          userId,
          newBalance: updatedWallet.balance.toString(),
          newVersion: updatedWallet.version,
        });
  
        // Create transaction record
        const transaction = await tx.coinTransaction.create({
          data: {
            userId,
            type: CoinTransactionType.OPERATIONAL_FEE,
            status: CoinTransactionStatus.COMPLETED,
            amount: -feeAmount, // Negative for deduction
            description: `Operational fee for order ${orderId}`,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            referenceType: 'order',
            referenceId: orderId,
            orderId,
            distanceFareAmount, // FIXED: Use actual baseFareAmount
            feePercentage: feeConfig.percentageOfBaseFare,
            operationalFeeConfig: feeConfig.percentageOfBaseFare,
            processedAt: new Date(),
            idempotencyKey: `operational-fee-${orderId}`,
          },
        });
  
        this.logger.log(`📝 Transaction record created`, {
          transactionId: transaction.id,
          userId,
          orderId,
          amount: transaction.amount.toString(),
        });
  
        // Update order with operational fee info
        await tx.order.update({
          where: { id: orderId },
          data: {
            operationalFeeCoins: feeAmount,
            operationalFeePercent: feeConfig.percentageOfBaseFare,
            operationalFeeStatus: 'CHARGED',
            operationalFeeChargedAt: new Date(),
            operationalFeeTransactionId: transaction.id,
            operationalFeeConfig: feeConfig.percentageOfBaseFare,
          },
        });
  
        this.logger.log(`📋 Order updated with fee info`, {
          orderId,
          feeAmount: feeAmount.toString(),
          transactionId: transaction.id,
        });
  
        return {
          transaction,
          newBalance: updatedWallet.balance,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
  
      this.logger.log(`🎉 Operational fee deducted successfully`, {
        userId,
        orderId,
        feeAmount: feeAmount.toString(),
        newBalance: result.newBalance.toString(),
        transactionId: result.transaction.id,
      });
  
      return {
        success: true,
        transactionId: result.transaction.id,
        feeAmount: feeAmount.toString(),
        newBalance: result.newBalance.toString(),
        message: 'Operational fee deducted successfully',
      };
  
    } catch (error) {
      this.logger.error(`💥 Failed to deduct operational fee`, {
        userId,
        orderId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
  
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ConflictException('Wallet was modified by another transaction. Please try again.');
        }
      }
  
      throw error;
    }
  }
  
  // 3. CHECK: Pastikan method calculateOperationalFee ada dan benar
  private calculateOperationalFee(baseFareAmount: bigint, feePercentage: number): bigint {
    const feeAmount = (baseFareAmount * BigInt(Math.round(feePercentage * 100))) / BigInt(10000);
    this.logger.log(`🧮 Fee calculation detail`, {
      baseFareAmount: baseFareAmount.toString(),
      feePercentage,
      multiplier: Math.round(feePercentage * 100),
      calculated: feeAmount.toString(),
    });
    return feeAmount;
  }
  
  // 4. CHECK: Pastikan getOperationalFeeConfig mengembalikan nilai yang benar
  private async getOperationalFeeConfig() {
    const config = {
      percentageOfBaseFare: 0.10, // 10%
      minimumFeeCoins: BigInt(1000), // 1,000 coins minimum
      maximumFeeCoins: BigInt(100000), // 100,000 coins maximum
    };
    
    this.logger.log(`⚙️ Operational fee config`, config);
    return config;
  }

  // FIXED: Process operational fee within transaction context
  // private async processOperationalFeeInTransaction(
  //   tx: any,
  //   customerId: string,
  //   orderId: string,
  //   feeAmount: bigint
  // ) {
  //   // Get current wallet
  //   const wallet = await tx.coinWallet.findUnique({
  //     where: { userId: customerId },
  //   });

  //   if (!wallet) {
  //     throw new BadRequestException('Customer wallet not found');
  //   }

  //   if (wallet.isFrozen) {
  //     throw new BadRequestException('Wallet is frozen');
  //   }

  //   if (wallet.balance < feeAmount) {
  //     throw new BadRequestException(
  //       `Insufficient balance. Required: ${feeAmount.toString()}, Available: ${wallet.balance.toString()}`
  //     );
  //   }

  //   const newBalance = wallet.balance - feeAmount;

  //   // Update wallet balance
  //   const updatedWallet = await tx.coinWallet.update({
  //     where: { 
  //       userId: customerId,
  //       version: wallet.version, // Optimistic locking
  //     },
  //     data: {
  //       balance: newBalance,
  //       totalSpent: wallet.totalSpent + feeAmount,
  //       totalOperationalFees: wallet.totalOperationalFees + feeAmount,
  //       version: { increment: 1 },
  //       lastTransactionAt: new Date(),
  //     },
  //   });

  //   // Create transaction record
  //   const transaction = await tx.coinTransaction.create({
  //     data: {
  //       userId: customerId,
  //       type: 'OPERATIONAL_FEE',
  //       status: 'COMPLETED',
  //       amount: -feeAmount, // Negative for deduction
  //       description: `Operational fee for order ${orderId}`,
  //       balanceBefore: wallet.balance,
  //       balanceAfter: newBalance,
  //       referenceType: 'order',
  //       referenceId: orderId,
  //       orderId,
  //       baseFareAmount: wallet.balance, // Store original base fare if needed
  //       processedAt: new Date(),
  //       idempotencyKey: `operational-fee-${orderId}`,
  //     },
  //   });

  //   this.logger.log(`Operational fee processed within transaction`, {
  //     customerId,
  //     orderId,
  //     previousBalance: wallet.balance.toString(),
  //     deductedAmount: feeAmount.toString(),
  //     newBalance: newBalance.toString(),
  //     transactionId: transaction.id,
  //   });

  //   return {
  //     success: true,
  //     transactionId: transaction.id,
  //     feeAmount: feeAmount.toString(),
  //     newBalance: newBalance.toString(),
  //     message: 'Operational fee processed successfully',
  //   };
  // }
  
  private convertRupiahToCoins(rupiahAmount: bigint): bigint {
    // PENTING: Gunakan logic yang sama dengan CoinsService
    // 1 rupiah = 1 coin
    return rupiahAmount;
    
    // Alternatif jika ingin rasio berbeda:
    // return rupiahAmount / BigInt(10); // 1 rupiah = 0.1 coin
  }
  

  private calculateOperationalFeeAmount(
    baseFareAmount: bigint, 
    distanceFareAmount: bigint, 
    distanceMeters: number
  ): bigint {
    let feePercentage: number;
    
    if (distanceMeters >= 1000 && distanceMeters <= 6000) {
      feePercentage = 0.075; // 7.5%
    } else if (distanceMeters > 6000) {
      feePercentage = 0.11; // 11%
    } else {
      feePercentage = 0.05; // 5%
    }
  
    // FIXED: Konversi dari cents ke rupiah, lalu ke coins
    const baseFareInRupiah = baseFareAmount / BigInt(100);
    const distanceFareInRupiah = distanceFareAmount / BigInt(100);
    const totalFareInRupiah = baseFareInRupiah + distanceFareInRupiah;
    
    // Convert to coins (1:1 ratio)
    const totalFareInCoins = this.convertRupiahToCoins(totalFareInRupiah);
    
    // FIXED: Gunakan pembagi yang konsisten
    const feeAmount = (totalFareInCoins * BigInt(Math.round(feePercentage * 10000))) / BigInt(10000);
    
    this.logger.log(`💰 Fee calculation preview`, {
      baseFareCents: baseFareAmount.toString(),
      distanceFareCents: distanceFareAmount.toString(),
      baseFareRupiah: baseFareInRupiah.toString(),
      distanceFareRupiah: distanceFareInRupiah.toString(),
      totalFareRupiah: totalFareInRupiah.toString(),
      totalFareCoins: totalFareInCoins.toString(),
      feePercentage,
      distanceMeters,
      multiplier: Math.round(feePercentage * 10000),
      feeAmountCoins: feeAmount.toString(),
      feeRule: this.getFeeRuleDescription(distanceMeters),
    });
    
    return feeAmount;
  }
  

  private getFeeRuleDescription(distanceMeters: number): string {
    if (distanceMeters >= 1000 && distanceMeters <= 6000) {
      return '7.5% fee (1-6km)';
    } else if (distanceMeters > 6000) {
      return '11% fee (>6km)';
    } else {
      return '5% fee (<1km)';
    }
  }

  private getFeePercentage(distanceMeters: number): number {
    if (distanceMeters >= 1000 && distanceMeters <= 6000) {
      return 0.075; // 7.5%
    } else if (distanceMeters > 6000) {
      return 0.11; // 11%
    } else {
      return 0.05; // 5%
    }
  }
  
   // Helper method to transform BigInt fields to strings
   private transformOrderResponse(order: any) {
    return {
      ...order,
      baseFare: order.baseFare.toString(),
      distanceFare: order.distanceFare.toString(),
      airportFare: order.airportFare.toString(),
      totalFare: order.totalFare.toString(),
    };
  }

  private validateFareCalculation(createOrderDto: CreateOrderDto) {
    const { baseFare, distanceFare, airportFare = 0, totalFare } = createOrderDto;
    const calculatedTotal = baseFare + distanceFare + airportFare;
    
    if (Math.abs(calculatedTotal - totalFare) > 1000) {
      throw new BadRequestException(
        `Fare calculation mismatch. Expected: ${calculatedTotal}, Received: ${totalFare}`
      );
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
      this.logger.error('Failed to assign driver', {
        error: error.message,
        orderId,
        driverId: assignDriverDto.driverId,
        assignedBy,
      });
      
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
              where: { userId: order.driverId ?? undefined },
              data: {
                driverStatus: newDriverStatus,
                statusChangedAt: new Date(),
                completedTrips: { increment: 1 },
                totalTrips: { increment: 1 },
                totalEarnings: { increment: updatedOrder.totalFare },
              },
            });
          } else if (updateOrderStatusDto.status.startsWith('CANCELLED')) {
            newDriverStatus = DriverStatus.ACTIVE;
            statusChangeReason = `Trip cancelled: ${updateOrderStatusDto.reason || 'Unknown reason'}`;
            
            // Update driver statistics
            await tx.driverProfile.update({
              where: { userId: order.driverId ?? undefined },
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
      
      if (
        order.driver?.driverProfile &&
        (
          updateOrderStatusDto.status === OrderStatus.COMPLETED ||
          (typeof updateOrderStatusDto.status === 'string' && updateOrderStatusDto.status.startsWith('CANCELLED'))
        )
      ) {
        if (order.driverId) {
          this.ordersGateway.emitDriverStatusChanged(order.driverId, DriverStatus.ACTIVE);
        }
      }

      this.logger.log(`Order ${result.orderNumber} status updated to ${updateOrderStatusDto.status} by ${userId || 'system'}`);

      return this.transformOrderResponse(result);
    } catch (error) {
      this.logger.error('Failed to update order status', {
        error: error.message,
        orderId,
        status: updateOrderStatusDto.status,
        userId,
      });
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
            select: {
              id: true,
              name: true,
              phone: true, // Include phone
              driverProfile: {
                select: {
                  id: true,
                  rating: true,
                  driverStatus: true,
                  currentLat: true,
                  currentLng: true,
                  isVerified: true,
                  totalTrips: true,
                  completedTrips: true,
                }
              }
            }
          }
        }
      }
    },
    take: 20,
  });

  const eligibleDrivers: FleetWithDriver[] = [];

  for (const fleet of availableFleetWithDrivers) {
    if (!fleet.assignments.length || !fleet.assignments[0].driver?.driverProfile) {
      continue;
    }

    const assignment = fleet.assignments[0];
    const driver = assignment.driver;
    const profile = driver.driverProfile;

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
            phone: driver.phone, // Include phone in response
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

    if (Math.abs(distanceA - distanceB) < 1) {
      return b.driver.driverProfile.rating - a.driver.driverProfile.rating;
    }
    return distanceA - distanceB;
  });
}

  // Helper method to validate driver assignment
  private async validateDriverAssignment(
    driverId: string, 
    fleetId?: string, 
    requiredVehicleType?: VehicleType
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

  // private async generateOrderNumber(): Promise<string> {
  //   const today = new Date();
  //   const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
  //   const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  //   const endOfDay = new Date(startOfDay);
  //   endOfDay.setDate(endOfDay.getDate() + 1);

  //   const todayOrderCount = await this.prisma.order.count({
  //     where: {
  //       createdAt: {
  //         gte: startOfDay,
  //         lt: endOfDay,
  //       },
  //     },
  //   });

  //   const sequence = (todayOrderCount + 1).toString().padStart(3, '0');
  //   return `TXB-${dateStr}-${sequence}`;
  // }

  // private validateFareCalculation(createOrderDto: CreateOrderDto) {
  //   const { baseFare, distanceFare, airportFare = 0, totalFare } = createOrderDto;
  //   const calculatedTotal = baseFare + distanceFare + airportFare;
    
  //   if (Math.abs(calculatedTotal - totalFare) > 1000) { // Allow 10 rupiah difference
  //     throw new BadRequestException(
  //       `Fare calculation mismatch. Expected: ${calculatedTotal}, Received: ${totalFare}`
  //     );
  //   }

  //   if (totalFare < baseFare) {
  //     throw new BadRequestException('Total fare cannot be less than base fare');
  //   }
  // }

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
    return `TXK-${dateStr}-${sequence}`;
  }

  private sanitizeString(input: string): string {
    if (!input) return input;
    return input.trim().replace(/[<>\"'&]/g, '');
  }

  private sanitizePhoneNumber(phone: string): string {
    if (!phone) return phone;
    return phone.replace(/[^\d+]/g, '');
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

  // private transformOrderResponse(order: any) {
  //   return {
  //     ...order,
  //     baseFare: Number(order.baseFare),
  //     distanceFare: Number(order.distanceFare),
  //     timeFare: Number(order.timeFare),
  //     airportFare: Number(order.airportFare),
  //     surgeFare: Number(order.surgeFare),
  //     additionalFare: Number(order.additionalFare),
  //     discount: Number(order.discount),
  //     totalFare: Number(order.totalFare),
  //     cancellationFee: Number(order.cancellationFee),
  //   };
  // }

  // Security helper methods
  // private sanitizeString(input: string): string {
  //   if (!input) return input;
  //   return input.trim().replace(/[<>\"'&]/g, '');
  // }

  // private sanitizePhoneNumber(phone: string): string {
  //   if (!phone) return phone;
  //   // Remove all non-numeric characters except +
  //   return phone.replace(/[^\d+]/g, '');
  // }
}