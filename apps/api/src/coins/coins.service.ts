import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCoinTopUpRequestDto } from './dto/create-coin-top-up-request.dto';
import { ProcessCoinTopUpRequestDto } from './dto/process-coin-top-up-request.dto';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CoinTransactionType,
  CoinTransactionStatus,
  Prisma,
  CoinTransaction,
} from '@prisma/client';
import { ManualCoinAdjustmentDto } from './dto/manual-coin-adjustment.dto';

const RUPIAH_TO_COINS_RATE = 1;

export interface OperationalFeeResult {
  success: boolean;
  transactionId?: string;
  feeAmount: string;
  newBalance: string;
  message: string;
}

@Injectable()
export class CoinService {
  private readonly logger = new Logger(CoinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // =============================================
  // WALLET MANAGEMENT
  // =============================================

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.coinWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.coinWallet.create({
        data: {
          userId,
          balance: BigInt(0),
          totalTopUp: BigInt(0),
          totalSpent: BigInt(0),
          totalOperationalFees: BigInt(0),
        },
      });

      this.logger.log(`Created new coin wallet for user ${userId}`);
    }

    return this.transformWalletResponse(wallet);
  }

  async getWalletBalance(userId: string): Promise<string> {
    const wallet = await this.prisma.coinWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // Auto-create wallet if it doesn't exist
      const newWallet = await this.prisma.coinWallet.create({
        data: {
          userId,
          balance: BigInt(0),
          totalTopUp: BigInt(0),
          totalSpent: BigInt(0),
          totalOperationalFees: BigInt(0),
        },
      });
      return newWallet.balance.toString();
    }

    return wallet.balance.toString();
  }

  async getWalletDetails(userId: string) {
    const wallet = await this.prisma.coinWallet.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!wallet) {
      return this.getOrCreateWallet(userId);
    }

    return {
      ...this.transformWalletResponse(wallet),
      user: wallet.user,
    };
  }

  // =============================================
  // OPERATIONAL FEE DEDUCTION
  // =============================================

  async deductOperationalFee(
    userId: string,
    orderId: string,
    baseFareAmount: bigint,
    distanceFareAmount: bigint,
    distanceMeters: number,
  ): Promise<OperationalFeeResult> {
    const feeConfig = await this.getOperationalFeeConfig(distanceMeters);
    const feeAmount = this.calculateOperationalFee(
      distanceFareAmount,
      baseFareAmount,
      distanceMeters,
    );

    this.logger.log(`Calculating operational fee for order ${orderId}`, {
      userId,
      baseFareAmount: baseFareAmount.toString(),
      distanceFareAmount: distanceFareAmount.toString(),
      distanceMeters,
      feePercentage: feeConfig.percentageOfBaseFare,
      calculatedFee: feeAmount.toString(),
    });

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Get current wallet with version for optimistic locking
          const wallet = await tx.coinWallet.findUnique({
            where: { userId },
          });

          if (!wallet) {
            throw new BadRequestException(
              'Coin wallet not found. Please contact support.',
            );
          }

          if (wallet.isFrozen) {
            throw new BadRequestException(
              'Wallet is frozen. Cannot process operational fee.',
            );
          }

          if (wallet.balance < feeAmount) {
            throw new BadRequestException(
              `Insufficient coins. Required: ${feeAmount.toString()}, Available: ${wallet.balance.toString()}`,
            );
          }

          const newBalance = wallet.balance - feeAmount;

          // Update wallet with optimistic locking
          const updatedWallet = await tx.coinWallet.update({
            where: {
              userId,
              version: wallet.version, // Optimistic locking
            },
            data: {
              balance: newBalance,
              totalSpent: wallet.totalSpent + feeAmount,
              totalOperationalFees: wallet.totalOperationalFees + feeAmount,
              version: { increment: 1 },
              lastTransactionAt: new Date(),
            },
          });

          // Create transaction record
          const transaction = await tx.coinTransaction.create({
            data: {
              userId,
              type: CoinTransactionType.OPERATIONAL_FEE,
              status: CoinTransactionStatus.COMPLETED,
              amount: -feeAmount, // Negative for deduction
              description: `Operational fee for order ${orderId} (${distanceMeters}m, ${feeConfig.percentageOfBaseFare * 100}%)`,
              balanceBefore: wallet.balance,
              balanceAfter: newBalance,
              referenceType: 'order',
              referenceId: orderId,
              orderId,
              // baseFareAmount, // Store base fare
              distanceFareAmount, // Store distance fare
              feePercentage: feeConfig.percentageOfBaseFare,
              operationalFeeConfig: {
                percentage: feeConfig.percentageOfBaseFare,
                distanceMeters,
                feeRule:
                  distanceMeters >= 1000 && distanceMeters <= 6000
                    ? '7.5% (1-6km)'
                    : distanceMeters > 6000
                      ? '11% (>6km)'
                      : '5% (<1km)',
              },
              processedAt: new Date(),
              idempotencyKey: `operational-fee-${orderId}`,
            },
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
              operationalFeeConfig: {
                percentage: feeConfig.percentageOfBaseFare,
                distanceMeters,
                baseFareAmount: baseFareAmount.toString(),
                distanceFareAmount: distanceFareAmount.toString(),
                totalFareUsed: (baseFareAmount + distanceFareAmount).toString(),
                feeRule:
                  distanceMeters >= 1000 && distanceMeters <= 6000
                    ? '7.5% (1-6km)'
                    : distanceMeters > 6000
                      ? '11% (>6km)'
                      : '5% (<1km)',
              },
            },
          });

          return {
            transaction,
            newBalance: updatedWallet.balance,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      this.logger.log(`Operational fee deducted successfully`, {
        userId,
        orderId,
        distanceMeters,
        feePercentage: feeConfig.percentageOfBaseFare,
        feeAmount: feeAmount.toString(),
        newBalance: result.newBalance.toString(),
        transactionId: result.transaction.id,
      });

      return {
        success: true,
        transactionId: result.transaction.id,
        feeAmount: feeAmount.toString(),
        newBalance: result.newBalance.toString(),
        message: `Operational fee deducted successfully (${feeConfig.percentageOfBaseFare * 100}% for ${distanceMeters}m)`,
      };
    } catch (error) {
      this.logger.error(`Failed to deduct operational fee`, {
        userId,
        orderId,
        distanceMeters,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ConflictException(
            'Wallet was modified by another transaction. Please try again.',
          );
        }
      }

      throw error;
    }
  }

  private convertRupiahToCoins(rupiahAmountInCents: bigint): bigint {
    // IMPORTANT: Data dari database dalam format CENTS (1 rupiah = 100 cents)
    // Konversi ke rupiah dulu, lalu ke coins

    // Opsi 1: 1 rupiah = 1 coin
    const rupiahAmount = rupiahAmountInCents / BigInt(100); // Convert cents to rupiah
    return rupiahAmount; // 1:1 conversion

    // Alternatif jika ingin rasio berbeda:
    // const rupiahAmount = rupiahAmountInCents / BigInt(100);
    // return rupiahAmount / BigInt(10); // 1 rupiah = 0.1 coin
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

  private calculateOperationalFee(
    distanceFareAmount: bigint,
    baseFareAmount: bigint,
    distanceMeters: number,
  ): bigint {
    // Tentukan fee percentage berdasarkan distanceMeters
    let feePercentage: number;

    if (distanceMeters >= 1000 && distanceMeters <= 6000) {
      feePercentage = 0.075; // 7.5%
    } else if (distanceMeters > 6000) {
      feePercentage = 0.11; // 11%
    } else {
      feePercentage = 0.05; // 5% untuk jarak dekat
    }

    // FIXED: Konversi fare dari rupiah ke coins (1:1 ratio)
    const baseFareInCoins = this.convertRupiahToCoins(baseFareAmount);
    const distanceFareInCoins = this.convertRupiahToCoins(distanceFareAmount);
    const totalFareInCoins = baseFareInCoins + distanceFareInCoins;

    // FIXED: Gunakan pembagi yang konsisten
    const feeAmount =
      (totalFareInCoins * BigInt(Math.round(feePercentage * 10000))) /
      BigInt(10000);

    this.logger.log(`🧮 Fee calculation detail`, {
      baseFareRupiah: baseFareAmount.toString(),
      distanceFareRupiah: distanceFareAmount.toString(),
      baseFareCoins: baseFareInCoins.toString(),
      distanceFareCoins: distanceFareInCoins.toString(),
      totalFareCoins: totalFareInCoins.toString(),
      feePercentage,
      distanceMeters,
      multiplier: Math.round(feePercentage * 10000),
      feeAmountCoins: feeAmount.toString(),
      feeRule: this.getFeeRuleDescription(distanceMeters),
    });

    return feeAmount;
  }

  private async getOperationalFeeConfig(distanceMeters?: number) {
    let percentageOfBaseFare: number;

    if (distanceMeters) {
      if (distanceMeters >= 1000 && distanceMeters <= 6000) {
        percentageOfBaseFare = 0.075; // 7.5%
      } else if (distanceMeters > 6000) {
        percentageOfBaseFare = 0.11; // 11%
      } else {
        percentageOfBaseFare = 0.05; // 5% untuk jarak dekat
      }
    } else {
      percentageOfBaseFare = 0.1; // Default 10%
    }

    return {
      percentageOfBaseFare,
      minimumFeeCoins: BigInt(1000), // 1,000 coins minimum
      maximumFeeCoins: BigInt(100000), // 100,000 coins maximum
      distanceMeters,
    };
  }

  async debugFeeCalculation(
    baseFareAmount: bigint,
    distanceFareAmount: bigint,
    distanceMeters: number,
  ): Promise<any> {
    const baseFareRupiah = baseFareAmount / BigInt(100);
    const distanceFareRupiah = distanceFareAmount / BigInt(100);

    let feePercentage: number;
    if (distanceMeters >= 1000 && distanceMeters <= 6000) {
      feePercentage = 0.075;
    } else if (distanceMeters > 6000) {
      feePercentage = 0.11;
    } else {
      feePercentage = 0.05;
    }

    const totalFareRupiah = baseFareRupiah + distanceFareRupiah;
    const totalFareCoins = this.convertRupiahToCoins(totalFareRupiah);
    const feeAmount =
      (totalFareCoins * BigInt(Math.round(feePercentage * 10000))) /
      BigInt(10000);

    return {
      inputs: {
        baseFareCents: baseFareAmount.toString(),
        distanceFareCents: distanceFareAmount.toString(),
        distanceMeters,
      },
      conversions: {
        baseFareRupiah: baseFareRupiah.toString(),
        distanceFareRupiah: distanceFareRupiah.toString(),
        totalFareRupiah: totalFareRupiah.toString(),
        totalFareCoins: totalFareCoins.toString(),
      },
      calculation: {
        feePercentage,
        multiplier: Math.round(feePercentage * 10000),
        feeAmountCoins: feeAmount.toString(),
        feeRule: this.getFeeRuleDescription(distanceMeters),
      },
      validation: {
        isReasonable: feeAmount < totalFareCoins / BigInt(2), // Fee should be less than 50% of fare
        feeToFareRatio: `${Number((feeAmount * BigInt(100)) / totalFareCoins)}%`,
      },
    };
  }

  // =============================================
  // TOP UP REQUEST MANAGEMENT
  // =============================================

  async createTopUpRequest(
    userId: string,
    createTopUpRequestDto: CreateCoinTopUpRequestDto,
  ) {
    const requestNumber = await this.generateTopUpRequestNumber();

    const topUpRequest = await this.prisma.coinTopUpRequest.create({
      data: {
        requestNumber,
        customerId: userId,
        requestedAmount: BigInt(createTopUpRequestDto.requestedAmount),
        reason: createTopUpRequestDto.reason,
        urgencyLevel: createTopUpRequestDto.urgencyLevel || 'NORMAL',
        customerNotes: createTopUpRequestDto.customerNotes,
        contactPreference: createTopUpRequestDto.contactPreference,
        paymentMethod: createTopUpRequestDto.paymentMethod,
        paymentDetails: createTopUpRequestDto.paymentDetails,
        status: CoinTransactionStatus.PENDING,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    this.logger.log(`Top up request created`, {
      requestId: topUpRequest.id,
      requestNumber,
      userId,
      amount: createTopUpRequestDto.requestedAmount,
    });

    return this.transformTopUpRequestResponse(topUpRequest);
  }

  async getTopUpRequests(filters: {
    status?: CoinTransactionStatus;
    customerId?: string;
    urgencyLevel?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, customerId, urgencyLevel, page = 1, limit = 10 } = filters;

    const where: Prisma.CoinTopUpRequestWhereInput = {
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(urgencyLevel && { urgencyLevel }),
    };

    const [requests, total] = await Promise.all([
      this.prisma.coinTopUpRequest.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          processedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { urgencyLevel: 'desc' }, // URGENT first
          { requestedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coinTopUpRequest.count({ where }),
    ]);

    return {
      data: requests.map((req) => this.transformTopUpRequestResponse(req)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async processTopUpRequest(
    requestId: string,
    processDto: ProcessCoinTopUpRequestDto,
    adminId: string,
  ) {
    const request = await this.prisma.coinTopUpRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Top up request not found');
    }

    if (request.status !== CoinTransactionStatus.PENDING) {
      throw new BadRequestException('Request is already processed');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Update request status
        const updatedRequest = await tx.coinTopUpRequest.update({
          where: { id: requestId },
          data: {
            status: processDto.status,
            approvedAmount:
              processDto.status === 'COMPLETED'
                ? BigInt(processDto.approvedAmount)
                : null,
            adminNotes: processDto.adminNotes,
            rejectionReason: processDto.rejectionReason,
            processedById: adminId,
            processedAt: new Date(),
          },
        });

        const coinTransaction = null;

        // If approved, add coins to wallet
        if (processDto.status === 'COMPLETED') {
          const wallet = await this.getOrCreateWallet(request.customerId);

          const newBalance =
            BigInt(wallet.balance) + BigInt(processDto.approvedAmount);

          // Update wallet
          await tx.coinWallet.update({
            where: { userId: request.customerId },
            data: {
              balance: newBalance,
              totalTopUp:
                BigInt(wallet.totalTopUp) + BigInt(processDto.approvedAmount),
              lastTransactionAt: new Date(),
              version: { increment: 1 },
            },
          });

          // Create transaction record
          const coinTransaction: CoinTransaction =
            await tx.coinTransaction.create({
              data: {
                userId: request.customerId,
                type: CoinTransactionType.TOP_UP,
                status: CoinTransactionStatus.COMPLETED,
                amount: BigInt(processDto.approvedAmount),
                description: `Manual top up approved - ${request.reason}`,
                balanceBefore: BigInt(wallet.balance),
                balanceAfter: newBalance,
                referenceType: 'top_up_request',
                referenceId: requestId,
                topUpRequestId: requestId,
                processedBy: adminId,
                processedAt: new Date(),
                notes: processDto.adminNotes,
                idempotencyKey: `top-up-${requestId}`,
              },
            });
        }

        return { updatedRequest, coinTransaction };
      });

      // Log the action
      await this.auditLogService.log({
        action: 'PROCESS_COIN_TOP_UP',
        resource: 'coin_top_up_requests',
        resourceId: requestId,
        userId: adminId,
        newValues: {
          status: processDto.status,
          approvedAmount: processDto.approvedAmount,
          adminNotes: processDto.adminNotes,
        },
      });

      this.logger.log(`Top up request processed`, {
        requestId,
        status: processDto.status,
        approvedAmount: processDto.approvedAmount,
        adminId,
      });

      return {
        request: this.transformTopUpRequestResponse(result.updatedRequest),
        transaction: result.coinTransaction
          ? this.transformTransactionResponse(result.coinTransaction)
          : null,
      };
    } catch (error) {
      this.logger.error(`Failed to process top up request`, {
        requestId,
        error: error.message,
        adminId,
      });
      throw error;
    }
  }

  // =============================================
  // MANUAL ADJUSTMENTS
  // =============================================

  async manualCoinAdjustment(
    adjustmentDto: ManualCoinAdjustmentDto,
    adminId: string,
  ) {
    const { userId, amount, type, description, notes } = adjustmentDto;

    if (amount === 0) {
      throw new BadRequestException('Adjustment amount cannot be zero');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const wallet = await this.getOrCreateWallet(userId);
        const currentBalance = BigInt(wallet.balance);
        const adjustmentAmount = BigInt(amount);
        const newBalance = currentBalance + adjustmentAmount;

        if (newBalance < 0) {
          throw new BadRequestException(
            'Insufficient balance for this adjustment',
          );
        }

        // Update wallet
        const updatedWallet = await tx.coinWallet.update({
          where: { userId },
          data: {
            balance: newBalance,
            ...(amount > 0 && {
              totalTopUp: BigInt(wallet.totalTopUp) + adjustmentAmount,
            }),
            ...(amount < 0 && {
              totalSpent: BigInt(wallet.totalSpent) + -adjustmentAmount,
            }),
            lastTransactionAt: new Date(),
            version: { increment: 1 },
          },
        });

        // Create transaction record
        const transaction = await tx.coinTransaction.create({
          data: {
            userId,
            type: type as CoinTransactionType,
            status: CoinTransactionStatus.COMPLETED,
            amount: adjustmentAmount,
            description,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            referenceType: 'manual',
            processedBy: adminId,
            processedAt: new Date(),
            notes,
            idempotencyKey: `manual-${Date.now()}-${userId}`,
          },
        });

        return { transaction, updatedWallet };
      });

      // Log the action
      await this.auditLogService.log({
        action: 'MANUAL_COIN_ADJUSTMENT',
        resource: 'coin_wallets',
        resourceId: userId,
        userId: adminId,
        newValues: {
          amount,
          type,
          description,
          newBalance: result.updatedWallet.balance.toString(),
        },
      });

      this.logger.log(`Manual coin adjustment completed`, {
        userId,
        amount,
        type,
        adminId,
        newBalance: result.updatedWallet.balance.toString(),
      });

      return {
        transaction: this.transformTransactionResponse(result.transaction),
        wallet: this.transformWalletResponse(result.updatedWallet),
      };
    } catch (error) {
      this.logger.error(`Manual adjustment failed`, {
        userId,
        amount,
        type,
        error: error.message,
        adminId,
      });
      throw error;
    }
  }

  // =============================================
  // TRANSACTION HISTORY
  // =============================================

  async getTransactionHistory(filters: {
    userId?: string;
    type?: CoinTransactionType;
    status?: CoinTransactionStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      type,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.CoinTransactionWhereInput = {
      ...(userId && { userId }),
      ...(type && { type }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.coinTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coinTransaction.count({ where }),
    ]);

    return {
      data: transactions.map((tx) => this.transformTransactionResponse(tx)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private async generateTopUpRequestNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayRequestCount = await this.prisma.coinTopUpRequest.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    const sequence = (todayRequestCount + 1).toString().padStart(3, '0');
    return `TOP-${dateStr}-${sequence}`;
  }

  private transformWalletResponse(wallet: any) {
    return {
      ...wallet,
      balance: wallet.balance.toString(),
      totalTopUp: wallet.totalTopUp.toString(),
      totalSpent: wallet.totalSpent.toString(),
      totalOperationalFees: wallet.totalOperationalFees.toString(),
    };
  }

  private transformTransactionResponse(transaction: any) {
    return {
      ...transaction,
      amount: transaction.amount.toString(),
      balanceBefore: transaction.balanceBefore.toString(),
      balanceAfter: transaction.balanceAfter.toString(),
      baseFareAmount: transaction.baseFareAmount?.toString(),
    };
  }

  private transformTopUpRequestResponse(request: any) {
    return {
      ...request,
      requestedAmount: request.requestedAmount.toString(),
      approvedAmount: request.approvedAmount?.toString(),
    };
  }
}
