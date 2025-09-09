import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  BadRequestException,
  Logger,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { CreateCoinTopUpRequestDto } from './dto/create-coin-top-up-request.dto';
import { ProcessCoinTopUpRequestDto } from './dto/process-coin-top-up-request.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role, CoinTransactionType, CoinTransactionStatus } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { CoinWalletEntity } from './entities/coin-wallet.entity';
import { CoinTransactionEntity } from './entities/coin-transaction.entity';
import { CoinService } from './coins.service';
import { CoinTopUpRequestEntity } from './entities/coin-top-up-request.enitty';
import { ManualCoinAdjustmentDto } from './dto/manual-coin-adjustment.dto';


interface AuthenticatedRequest {
  get(arg0: string): string | undefined;
  ip: string | undefined;
  user: {
    id: string;
    role: Role;
    email?: string;
    name?: string;
  };
}

@ApiTags('coins')
@Controller('coins')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class CoinController {
  private readonly logger = new Logger(CoinController.name);

  constructor(
    private readonly coinService: CoinService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // =============================================
  // WALLET ENDPOINTS
  // =============================================

  @Get('wallet')
  @Roles('CUSTOMER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get user coin wallet details',
    description: 'Retrieve current wallet balance and statistics for the authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet details retrieved successfully',
    type: CoinWalletEntity,
  })
  async getWallet(@Request() req: AuthenticatedRequest) {
    try {
      const wallet = await this.coinService.getWalletDetails(req.user.id);
      
      this.logger.log(`Wallet details retrieved for user ${req.user.id}`);
      
      return {
        success: true,
        data: wallet,
        message: 'Wallet details retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve wallet for user ${req.user.id}:`, {
        error: error.message,
        userId: req.user.id,
      });
      throw error;
    }
  }

  @Get('wallet/:userId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get specific user wallet details (Admin only)',
    description: 'Retrieve wallet details for any user by admin'
  })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  async getWalletByUserId(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    try {
      const wallet = await this.coinService.getWalletDetails(userId);
      
      await this.auditLogService.log({
        action: 'VIEW_USER_WALLET',
        resource: 'coin_wallets',
        resourceId: userId,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return {
        success: true,
        data: wallet,
        message: 'Wallet details retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve wallet for user ${userId}:`, {
        error: error.message,
        targetUserId: userId,
        adminId: req.user.id,
      });
      throw error;
    }
  }

  @Get('balance')
  @Roles('CUSTOMER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get current coin balance',
    description: 'Quick endpoint to get just the current balance'
  })
  async getBalance(@Request() req: AuthenticatedRequest) {
    try {
      const balance = await this.coinService.getWalletBalance(req.user.id);
      
      return {
        success: true,
        data: {
          balance,
          userId: req.user.id,
        },
        message: 'Balance retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve balance for user ${req.user.id}:`, {
        error: error.message,
        userId: req.user.id,
      });
      throw error;
    }
  }

  // =============================================
  // TOP UP REQUEST ENDPOINTS
  // =============================================

  @Post('top-up/request')
  @Roles('CUSTOMER', 'DRIVER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create coin top up request',
    description: 'Submit a request for coin top up that requires admin approval'
  })
  @ApiResponse({
    status: 201,
    description: 'Top up request created successfully',
    type: CoinTopUpRequestEntity,
  })
  async createTopUpRequest(
    @Body(new ValidationPipe({ 
      transform: true, 
      whitelist: true, 
      forbidNonWhitelisted: true 
    })) createTopUpRequestDto: CreateCoinTopUpRequestDto,
    @Request() req: AuthenticatedRequest
  ) {
    try {
      this.logger.log(`Top up request initiated by user: ${req.user.id}`, {
        userId: req.user.id,
        amount: createTopUpRequestDto.requestedAmount,
        urgencyLevel: createTopUpRequestDto.urgencyLevel,
      });

      const topUpRequest = await this.coinService.createTopUpRequest(
        req.user.id,
        createTopUpRequestDto
      );

      await this.auditLogService.log({
        action: 'CREATE_TOP_UP_REQUEST',
        resource: 'coin_top_up_requests',
        resourceId: topUpRequest.id,
        userId: req.user.id,
        newValues: {
          requestNumber: topUpRequest.requestNumber,
          requestedAmount: createTopUpRequestDto.requestedAmount,
          reason: createTopUpRequestDto.reason,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return {
        success: true,
        data: topUpRequest,
        message: 'Top up request submitted successfully. Please wait for admin approval.',
      };
    } catch (error) {
      this.logger.error(`Top up request creation failed for user ${req.user.id}:`, {
        error: error.message,
        userId: req.user.id,
        amount: createTopUpRequestDto.requestedAmount,
      });
      throw error;
    }
  }

  @Get('top-up/my-requests')
  @Roles('CUSTOMER', 'DRIVER')
  @ApiOperation({ 
    summary: 'Get my top up requests',
    description: 'Retrieve all top up requests for the current user'
  })
  @ApiQuery({ name: 'status', required: false, enum: CoinTransactionStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyTopUpRequests(
    @Query('status') status?: CoinTransactionStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req?: AuthenticatedRequest
  ) {
    const filters = {
      customerId: req?.user.id,
      status,
      page: Number(page),
      limit: Math.min(Number(limit), 50),
    };

    const result = await this.coinService.getTopUpRequests(filters);
    
    return {
      success: true,
      ...result,
      message: `Found ${result.data.length} top up requests`,
    };
  }

  @Get('top-up/requests')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get all top up requests (Admin)',
    description: 'Retrieve all top up requests for admin review'
  })
  @ApiQuery({ name: 'status', required: false, enum: CoinTransactionStatus })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'urgencyLevel', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllTopUpRequests(
    @Query('status') status?: CoinTransactionStatus,
    @Query('customerId') customerId?: string,
    @Query('urgencyLevel') urgencyLevel?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    const filters = {
      status,
      customerId,
      urgencyLevel,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    };

    const result = await this.coinService.getTopUpRequests(filters);
    
    return {
      success: true,
      ...result,
      message: `Found ${result.data.length} top up requests`,
    };
  }

  @Post('top-up/requests/:id/process')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Process top up request (Super Admin only)',
    description: 'Approve, reject, or cancel a top up request'
  })
  @ApiParam({ name: 'id', description: 'Top up request ID' })
  async processTopUpRequest(
    @Param('id') id: string,
    @Body(ValidationPipe) processDto: ProcessCoinTopUpRequestDto,
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid request ID format');
    }

    try {
      const result = await this.coinService.processTopUpRequest(
        id,
        processDto,
        req.user.id
      );

      this.logger.log(`Top up request processed: ${id}`, {
        requestId: id,
        status: processDto.status,
        approvedAmount: processDto.approvedAmount,
        adminId: req.user.id,
      });

      return {
        success: true,
        data: result,
        message: `Top up request ${processDto.status.toLowerCase()} successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to process top up request ${id}:`, {
        error: error.message,
        requestId: id,
        adminId: req.user.id,
      });
      throw error;
    }
  }

  // =============================================
  // MANUAL ADJUSTMENT ENDPOINTS
  // =============================================

  @Post('manual-adjustment')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Manual coin adjustment (Super Admin only)',
    description: 'Manually adjust user coin balance for bonuses, refunds, or corrections'
  })
  async manualCoinAdjustment(
    @Body(ValidationPipe) adjustmentDto: ManualCoinAdjustmentDto,
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(adjustmentDto.userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    try {
      const result = await this.coinService.manualCoinAdjustment(
        adjustmentDto,
        req.user.id
      );

      this.logger.log(`Manual coin adjustment completed`, {
        targetUserId: adjustmentDto.userId,
        amount: adjustmentDto.amount,
        type: adjustmentDto.type,
        adminId: req.user.id,
      });

      return {
        success: true,
        data: result,
        message: 'Manual adjustment completed successfully',
      };
    } catch (error) {
      this.logger.error(`Manual adjustment failed:`, {
        error: error.message,
        targetUserId: adjustmentDto.userId,
        amount: adjustmentDto.amount,
        adminId: req.user.id,
      });
      throw error;
    }
  }

  // =============================================
  // TRANSACTION HISTORY ENDPOINTS
  // =============================================

  @Get('transactions')
  @Roles('CUSTOMER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get coin transaction history',
    description: 'Retrieve transaction history. Users see their own, admins see all.'
  })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Admin only - filter by user ID' })
  @ApiQuery({ name: 'type', required: false, enum: CoinTransactionType })
  @ApiQuery({ name: 'status', required: false, enum: CoinTransactionStatus })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransactionHistory(
    @Query('userId') userId?: string,
    @Query('type') type?: CoinTransactionType,
    @Query('status') status?: CoinTransactionStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Request() req?: AuthenticatedRequest
  ) {
    // Non-admin users can only see their own transactions
    const effectiveUserId = ['ADMIN', 'SUPER_ADMIN'].includes(req?.user.role as string) 
      ? userId 
      : req?.user.id;

    const filters = {
      userId: effectiveUserId,
      type,
      status,
      dateFrom,
      dateTo,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    };

    const result = await this.coinService.getTransactionHistory(filters);
    
    return {
      success: true,
      ...result,
      message: `Found ${result.data.length} transactions`,
    };
  }

  @Get('transactions/:id')
  @Roles('CUSTOMER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get transaction by ID',
    description: 'Get detailed information about a specific transaction'
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  async getTransactionById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid transaction ID format');
    }

    // Implementation would go here - retrieve single transaction
    // with proper permission checks
    
    return {
      success: true,
      message: 'Transaction retrieved successfully',
    };
  }

  // =============================================
  // DASHBOARD & ANALYTICS ENDPOINTS
  // =============================================

  @Get('dashboard/admin')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ 
    summary: 'Get coin system dashboard (Admin)',
    description: 'Administrative dashboard with coin system metrics'
  })
  async getAdminDashboard() {
    try {
      // This would be implemented in the service layer
      const dashboardData = {
        totalWallets: 0,
        totalBalance: '0',
        pendingTopUps: 0,
        dailyTransactions: 0,
        topSpenders: [],
        recentActivity: [],
      };

      return {
        success: true,
        data: dashboardData,
        message: 'Dashboard data retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Failed to retrieve admin dashboard:', error);
      throw error;
    }
  }

  @Get('stats/user')
  @Roles('CUSTOMER', 'DRIVER')
  @ApiOperation({ 
    summary: 'Get user coin statistics',
    description: 'Personal coin usage statistics'
  })
  async getUserStats(@Request() req: AuthenticatedRequest) {
    try {
      // This would be implemented in the service layer
      const userStats = {
        totalSpent: '0',
        totalOperationalFees: '0',
        monthlySpend: '0',
        averageOperationalFee: '0',
        transactionCount: 0,
      };

      return {
        success: true,
        data: userStats,
        message: 'User statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve user stats for ${req.user.id}:`, error);
      throw error;
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}