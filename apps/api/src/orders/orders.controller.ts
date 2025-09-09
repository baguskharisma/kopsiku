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
  ForbiddenException,
  UnauthorizedException,
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
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderEntity } from './entities/order.entity';
import { DriverStatus, OrderStatus, Role, VehicleType } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.sevice';
import { AuditLogService } from 'src/audit/audit-log.service';

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

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);
  prisma: any;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // OPERATOR ENDPOINTS

  @Post('operator/create')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createOrderAsOperator(
    @Body(new ValidationPipe({ 
      transform: true, 
      whitelist: true, 
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
    })) createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest
  ) {
    try {
      // DEBUG: Cek authentication state
      this.logger.log('Authentication Debug:', {
        hasUser: !!req.user,
        userId: req.user?.id,
        userRole: req.user?.role,
        userEmail: req.user?.email,
        authHeader: req.get('Authorization'),
        fullUserObject: JSON.stringify(req.user),
      });
  
      // CRITICAL FIX: Handle undefined req.user.id
      if (!req.user?.id) {
        this.logger.error('Authentication failed - no user ID found');
        throw new UnauthorizedException('Authentication required. Please login again.');
      }
  
      // AUTO-ASSIGN adminId if not provided
      const effectiveAdminId = createOrderDto.adminId || req.user.id;
      
      this.logger.log(`Order creation initiated by operator: ${req.user.id}`, {
        operatorId: req.user.id,
        operatorRole: req.user.role,
        passengerPhone: createOrderDto.passengerPhone,
        vehicleType: createOrderDto.requestedVehicleType,
        originalAdminId: createOrderDto.adminId,
        effectiveAdminId: effectiveAdminId,
      });
  
      // Update DTO with effective adminId
      const orderData = {
        ...createOrderDto,
        adminId: effectiveAdminId,
      };
  
      // Additional security validations
      await this.validateOrderCreationRequest(orderData, req.user);
  
      // Create the order with updated data
      const order = await this.ordersService.create(orderData, req.user.id);
  
      // Rest of your existing code...
      await this.auditLogService.log({
        action: 'CREATE_ORDER',
        resource: 'orders',
        resourceId: order.id,
        userId: req.user.id,
        newValues: {
          orderNumber: order.orderNumber,
          passengerName: orderData.passengerName,
          totalFare: order.totalFare,
          vehicleType: orderData.requestedVehicleType,
          operationalFeeCharged: order.operationalFee?.charged || false,
          operationalFeeAmount: order.operationalFee?.amount || null,
          effectiveAdminId: effectiveAdminId,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
  
      this.logger.log(`Order created successfully: ${order.orderNumber}`, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        operatorId: req.user.id,
        operationalFeeCharged: order.operationalFee?.charged || false,
        effectiveAdminId: effectiveAdminId,
      });
  
      return {
        success: true,
        data: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalFare: Number(order.totalFare),
          passengerName: order.passengerName,
          passengerPhone: order.passengerPhone,
          pickupAddress: order.pickupAddress,
          dropoffAddress: order.dropoffAddress,
          requestedVehicleType: order.requestedVehicleType,
          createdAt: order.createdAt,
          operationalFee: order.operationalFee || null,
          adminIdUsed: effectiveAdminId, // Debug info
        },
        message: order.operationalFee?.charged 
          ? 'Order created successfully. Operational fee has been deducted from customer coin balance.'
          : 'Order created successfully.',
      };
    } catch (error) {
      this.logger.error(`Order creation failed for operator ${req.user?.id || 'unknown'}:`, {
        error: error.message,
        stack: error.stack,
        operatorId: req.user?.id,
        passengerPhone: createOrderDto.passengerPhone,
        adminId: createOrderDto.adminId,
        hasUser: !!req.user,
      });
  
      // Log failed attempt
      await this.auditLogService.log({
        action: 'CREATE_ORDER_FAILED',
        resource: 'orders',
        userId: req.user?.id,
        newValues: {
          error: error.message,
          passengerName: createOrderDto.passengerName,
          adminId: createOrderDto.adminId,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }).catch(() => {});
  
      throw error;
    }
  }
  
@Get('operator/drivers')
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiOperation({ summary: 'Get all active drivers with their fleet info' })
@ApiQuery({ name: 'vehicleType', required: false, enum: VehicleType })
@ApiQuery({ name: 'status', required: false, enum: DriverStatus })
async getActiveDrivers(
  @Query('vehicleType') vehicleType?: VehicleType,
  @Query('status') status?: DriverStatus,
  @Request() req?: AuthenticatedRequest
) {
  try {
    this.logger.log(`Fetching active drivers with filters:`, {
      vehicleType,
      status,
      requestedBy: req?.user?.id,
    });

    const drivers = await this.ordersService.getActiveDrivers({
      vehicleType,
      status,
    });

    this.logger.log(`Found ${drivers.length} active drivers`);

    return {
      success: true,
      data: drivers,
      message: `Found ${drivers.length} drivers`,
      meta: {
        total: drivers.length,
        vehicleType,
        status: status || DriverStatus.ACTIVE,
      }
    };
  } catch (error) {
    this.logger.error('Failed to fetch drivers:', {
      error: error.message,
      stack: error.stack,
      filters: { vehicleType, status },
    });
    throw error;
  }
}

@Get('operator/drivers/test')
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiOperation({ summary: 'Test driver query - simplified version' })
async testDriverQuery() {
  try {
    // Simple query to test basic functionality
    const users = await this.prisma.user.findMany({
      where: {
        role: 'DRIVER',
        isActive: true,
      },
      include: {
        DriverProfile: true,
      },
      take: 10,
    });

    const usersWithAssignments = await this.prisma.user.findMany({
      where: {
        role: 'DRIVER',
        isActive: true,
      },
      include: {
        DriverProfile: true,
        FleetAssignment: {
          where: { isActive: true },
          include: {
            fleet: true,
          }
        }
      },
      take: 10,
    });

    return {
      success: true,
      data: {
        basicUsers: users.length,
        usersWithAssignments: usersWithAssignments.length,
        sampleUser: users[0] || null,
        sampleUserWithAssignment: usersWithAssignments[0] || null,
      },
      message: 'Test query completed',
    };
  } catch (error) {
    this.logger.error('Test query failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Test query failed',
    };
  }
}

  @Get('operator/available-drivers')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get available drivers for assignment' })
  @ApiQuery({ name: 'vehicleType', required: true, enum: VehicleType })
  @ApiQuery({ name: 'pickupLat', required: true, type: Number })
  @ApiQuery({ name: 'pickupLng', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  async getAvailableDrivers(
    @Query('vehicleType') vehicleType: VehicleType,
    @Query('pickupLat') pickupLat: number,
    @Query('pickupLng') pickupLng: number,
    @Query('radius') radius = 10
  ) {
    // Validate coordinates
    if (isNaN(pickupLat) || isNaN(pickupLng)) {
      throw new BadRequestException('Invalid coordinates provided');
    }

    if (pickupLat < -90 || pickupLat > 90 || pickupLng < -180 || pickupLng > 180) {
      throw new BadRequestException('Coordinates out of valid range');
    }

    const drivers = await this.ordersService.findAvailableDrivers(
      vehicleType,
      { lat: Number(pickupLat), lng: Number(pickupLng) },
      Number(radius)
    );

    return {
      success: true,
      data: drivers,
      message: `Found ${drivers.length} available drivers`,
    };
  }

  @Post('operator/:id/assign')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Operator assigns driver to order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async assignDriverAsOperator(
    @Param('id') id: string,
    @Body(ValidationPipe) assignDriverDto: AssignDriverDto,
    @Request() req: AuthenticatedRequest
  ) {
    // Validate UUID format
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    try {
      const order = await this.ordersService.assignDriver(id, assignDriverDto, req.user.id);
      
      // Log assignment
      await this.auditLogService.log({
        action: 'ASSIGN_DRIVER',
        resource: 'orders',
        resourceId: id,
        userId: req.user.id,
        newValues: {
          driverId: assignDriverDto.driverId,
          fleetId: assignDriverDto.fleetId,
          reason: assignDriverDto.reason,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return {
        success: true,
        data: order,
        message: 'Driver assigned successfully. Notification sent to driver.',
      };
    } catch (error) {
      this.logger.error(`Driver assignment failed:`, {
        orderId: id,
        driverId: assignDriverDto.driverId,
        error: error.message,
        operatorId: req.user.id,
      });
      throw error;
    }
  }

  @Get('operator/dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get operator dashboard data' })
  async getOperatorDashboard() {
    try {
      // Get orders by status
      const [
        pendingOrders,
        assignedOrders, 
        activeOrders,
        completedToday
      ] = await Promise.all([
        this.ordersService.findAll({ status: OrderStatus.PENDING, limit: 100 }),
        this.ordersService.findAll({ 
          status: OrderStatus.DRIVER_ASSIGNED, 
          limit: 100 
        }),
        this.ordersService.findAll({ 
          status: OrderStatus.IN_PROGRESS, 
          limit: 100 
        }),
        this.ordersService.findAll({ 
          status: OrderStatus.COMPLETED, 
          dateFrom: new Date().toISOString().split('T')[0],
          limit: 1000 
        })
      ]);

      return {
        success: true,
        data: {
          overview: {
            pendingOrders: pendingOrders.meta.total,
            assignedOrders: assignedOrders.meta.total,
            activeOrders: activeOrders.meta.total,
            completedToday: completedToday.meta.total,
          },
          pendingOrders: pendingOrders.data,
          assignedOrders: assignedOrders.data,
          activeOrders: activeOrders.data,
        },
      };
    } catch (error) {
      this.logger.error('Dashboard data retrieval failed:', error);
      throw error;
    }
  }

  // DRIVER ENDPOINTS

  @Get('driver/my-orders')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Get current driver orders' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyOrders(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: OrderStatus,
    @Query('limit') limit = 10
  ) {
    const filters = {
      driverId: req.user.id,
      status,
      limit: Number(limit),
      page: 1,
    };

    const result = await this.ordersService.findAll(filters);
    return {
      success: true,
      ...result,
    };
  }

  @Get('driver/active')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Get driver active order' })
  async getActiveOrder(@Request() req: AuthenticatedRequest) {
    const activeStatuses = [
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.DRIVER_ACCEPTED,
      OrderStatus.DRIVER_ARRIVING,
      OrderStatus.IN_PROGRESS,
    ];

    const result = await this.ordersService.findAll({
      driverId: req.user.id,
      page: 1,
      limit: 10,
    });

    // Filter for active orders
    const activeOrder = result.data.find(order =>
      activeStatuses.includes(order.status)
    );

    return {
      success: true,
      data: activeOrder || null,
      message: activeOrder ? 'Active order found' : 'No active orders',
    };
  }

  @Post('driver/:id/accept')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver accepts assigned order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async acceptOrder(
    @Param('id') id: string,
    @Body() body: { estimatedArrival?: number; location?: { lat: number; lng: number } },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.ordersService.findOne(id);
    
    // Verify this is the assigned driver
    if (order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only accept orders assigned to you');
    }

    if (order.status !== OrderStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException('Order is not in assignable state');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = OrderStatus.DRIVER_ACCEPTED;
    updateDto.reason = 'Driver accepted the order';
    updateDto.metadata = {
      estimatedArrival: body.estimatedArrival || 5,
      acceptedAt: new Date().toISOString(),
      driverLocation: body.location,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    
    // Log acceptance
    await this.auditLogService.log({
      action: 'ACCEPT_ORDER',
      resource: 'orders',
      resourceId: id,
      userId: req.user.id,
      newValues: { status: OrderStatus.DRIVER_ACCEPTED },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      success: true,
      data: updatedOrder,
      message: 'Order accepted successfully',
    };
  }

  @Post('driver/:id/reject')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver rejects assigned order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async rejectOrder(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    if (!body.reason || body.reason.trim().length < 3) {
      throw new BadRequestException('Rejection reason is required (minimum 3 characters)');
    }

    const order = await this.ordersService.findOne(id);
    
    // Verify this is the assigned driver
    if (order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only reject orders assigned to you');
    }

    if (order.status !== OrderStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException('Order cannot be rejected in current status');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = OrderStatus.CANCELLED_BY_DRIVER;
    updateDto.reason = body.reason.trim();
    updateDto.metadata = {
      rejectedAt: new Date().toISOString(),
      driverRejection: true,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    
    // Log rejection
    await this.auditLogService.log({
      action: 'REJECT_ORDER',
      resource: 'orders',
      resourceId: id,
      userId: req.user.id,
      newValues: { 
        status: OrderStatus.CANCELLED_BY_DRIVER,
        reason: body.reason 
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      success: true,
      data: updatedOrder,
      message: 'Order rejected successfully',
    };
  }

  @Post('driver/:id/arrive')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver marks arrival at pickup location' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async markArrival(
    @Param('id') id: string,
    @Body() body: { location?: { lat: number; lng: number } },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.ordersService.findOne(id);
    if (order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only update your own orders');
    }

    if (order.status !== OrderStatus.DRIVER_ACCEPTED) {
      throw new BadRequestException('Order must be accepted first');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = OrderStatus.DRIVER_ARRIVING;
    updateDto.reason = 'Driver arrived at pickup location';
    updateDto.metadata = {
      arrivedAt: new Date().toISOString(),
      location: body.location,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    return {
      success: true,
      data: updatedOrder,
      message: 'Arrival marked successfully',
    };
  }

  @Post('driver/:id/start')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver starts the trip' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async startTrip(
    @Param('id') id: string,
    @Body() body: { location?: { lat: number; lng: number } },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.ordersService.findOne(id);
    if (order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only update your own orders');
    }

    if (order.status !== OrderStatus.DRIVER_ARRIVING) {
      throw new BadRequestException('You must arrive at pickup location first');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = OrderStatus.IN_PROGRESS;
    updateDto.reason = 'Trip started';
    updateDto.metadata = {
      startedAt: new Date().toISOString(),
      location: body.location,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    return {
      success: true,
      data: updatedOrder,
      message: 'Trip started successfully',
    };
  }

  @Post('driver/:id/complete')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver completes the trip' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async completeTrip(
    @Param('id') id: string,
    @Body() body: { 
      location?: { lat: number; lng: number };
      finalFare?: number;
      notes?: string;
      odometerEnd?: number;
    },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.ordersService.findOne(id);
    if (order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only complete your own orders');
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Trip must be in progress to complete');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = OrderStatus.COMPLETED;
    updateDto.reason = 'Trip completed successfully';
    updateDto.metadata = {
      completedAt: new Date().toISOString(),
      location: body.location,
      finalFare: body.finalFare,
      notes: body.notes,
      odometerEnd: body.odometerEnd,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    return {
      success: true,
      data: updatedOrder,
      message: 'Trip completed successfully. You are now available for new orders.',
    };
  }

  // COMMON ENDPOINTS

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER')
  @ApiOperation({ summary: 'Get all orders with filters' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'driverId', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('status') status?: OrderStatus,
    @Query('driverId') driverId?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req?: AuthenticatedRequest
  ) {
    // If user is a driver, filter to their orders only
    const filters = {
      status,
      driverId: req?.user.role === 'DRIVER' ? req.user.id : driverId,
      customerId,
      dateFrom,
      dateTo,
      page: Number(page),
      limit: Math.min(Number(limit), 100), // Limit max results
    };

    const result = await this.ordersService.findAll(filters);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER', 'CUSTOMER')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async findOne(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.ordersService.findOne(id);

    // Check permissions for drivers - they can only see their own orders
    if (req.user.role === 'DRIVER' && order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only view your own orders');
    }

    // Check permissions for customers - they can only see their own orders
    if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return {
      success: true,
      data: order,
    };
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async updateStatus(
    @Param('id') id: string,
    @Body(ValidationPipe) updateOrderStatusDto: UpdateOrderStatusDto,
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    // Additional validation for drivers
    if (req.user.role === 'DRIVER') {
      const order = await this.ordersService.findOne(id);
      
      // Ensure driver can only update their own orders
      if (order.driverId !== req.user.id) {
        throw new ForbiddenException('You can only update your own orders');
      }

      // Validate driver can perform this status change
      const allowedStatuses = [
        OrderStatus.DRIVER_ACCEPTED,
        OrderStatus.DRIVER_ARRIVING,
        OrderStatus.IN_PROGRESS,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED_BY_DRIVER,
      ] as OrderStatus[];

      if (!allowedStatuses.includes(updateOrderStatusDto.status as OrderStatus)) {
        throw new BadRequestException('Invalid status change for driver');
      }
    }

    const order = await this.ordersService.updateStatus(id, updateOrderStatusDto, req.user.id);
    
    // Log status change
    await this.auditLogService.log({
      action: 'UPDATE_ORDER_STATUS',
      resource: 'orders',
      resourceId: id,
      userId: req.user.id,
      newValues: {
        status: updateOrderStatusDto.status,
        reason: updateOrderStatusDto.reason,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      success: true,
      data: order,
      message: 'Order status updated successfully',
    };
  }

  @Post(':id/cancel')
  @Roles('DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason: string; cancellationFee?: number },
    @Request() req: AuthenticatedRequest
  ) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    if (!body.reason || body.reason.trim().length < 3) {
      throw new BadRequestException('Cancellation reason is required (minimum 3 characters)');
    }

    const order = await this.ordersService.findOne(id);
    
    // Check permissions
    if (req.user.role === 'DRIVER' && order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    // Validate cancellation is allowed for current status
    const cancellableStatuses = [
      OrderStatus.PENDING,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.DRIVER_ACCEPTED,
      OrderStatus.DRIVER_ARRIVING,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled in current status');
    }

    const updateDto = new UpdateOrderStatusDto();
    updateDto.status = req.user.role === 'DRIVER' 
      ? OrderStatus.CANCELLED_BY_DRIVER 
      : OrderStatus.CANCELLED_BY_SYSTEM;
    updateDto.reason = body.reason.trim();
    updateDto.metadata = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.user.id,
      cancellationFee: body.cancellationFee || 0,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    
    // Log cancellation
    await this.auditLogService.log({
      action: 'CANCEL_ORDER',
      resource: 'orders',
      resourceId: id,
      userId: req.user.id,
      newValues: {
        status: updateDto.status,
        reason: body.reason,
        cancellationFee: body.cancellationFee,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      success: true,
      data: updatedOrder,
      message: 'Order cancelled successfully',
    };
  }

  // ANALYTICS AND MONITORING

  @Get('stats/dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get orders dashboard statistics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getDashboardStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      dateFrom,
      dateTo,
      page: 1,
      limit: 1000,
    };

    const orders = await this.ordersService.findAll(filters);
    
    const completedOrders = orders.data.filter(o => o.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.data.filter(o => 
      o.status.toString().includes('CANCELLED')
    );
    
    const stats = {
      totalOrders: orders.meta.total,
      pendingOrders: orders.data.filter(o => o.status === OrderStatus.PENDING).length,
      assignedOrders: orders.data.filter(o => o.status === OrderStatus.DRIVER_ASSIGNED).length,
      activeOrders: orders.data.filter(o => [
        OrderStatus.DRIVER_ACCEPTED,
        OrderStatus.DRIVER_ARRIVING,
        OrderStatus.IN_PROGRESS,
      ].includes(o.status)).length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue: completedOrders.reduce((sum, o) => sum + Number(o.totalFare), 0),
      averageOrderValue: orders.data.length > 0 
        ? orders.data.reduce((sum, o) => sum + Number(o.totalFare), 0) / orders.data.length
        : 0,
      completionRate: orders.data.length > 0 
        ? (completedOrders.length / orders.data.length) * 100 
        : 0,
      cancellationRate: orders.data.length > 0 
        ? (cancelledOrders.length / orders.data.length) * 100 
        : 0,
    };

    return {
      success: true,
      data: stats,
    };
  }

  @Get('stats/driver')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Get driver statistics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getDriverStats(
    @Request() req: AuthenticatedRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      driverId: req.user.id,
      dateFrom,
      dateTo,
      page: 1,
      limit: 1000,
    };

    const orders = await this.ordersService.findAll(filters);
    
    const completedTrips = orders.data.filter(o => o.status === OrderStatus.COMPLETED);
    const cancelledTrips = orders.data.filter(o => 
      o.status === OrderStatus.CANCELLED_BY_DRIVER || 
      o.status === OrderStatus.CANCELLED_BY_CUSTOMER
    );
    
    const today = new Date().toDateString();
    const todayTrips = orders.data.filter(o => 
      new Date(o.createdAt).toDateString() === today
    );

    const stats = {
      totalTrips: orders.meta.total,
      completedTrips: completedTrips.length,
      cancelledTrips: cancelledTrips.length,
      totalEarnings: completedTrips.reduce((sum, o) => sum + Number(o.totalFare), 0),
      averageEarningPerTrip: completedTrips.length > 0
        ? completedTrips.reduce((sum, o) => sum + Number(o.totalFare), 0) / completedTrips.length
        : 0,
      todayTrips: todayTrips.length,
      completionRate: orders.data.length > 0 
        ? (completedTrips.length / orders.data.length) * 100 
        : 0,
      rating: {
        average: 4.5, // This would come from a ratings service
        totalRatings: completedTrips.length,
      },
      onlineHours: {
        today: 8.5, // This would come from driver activity tracking
        thisWeek: 45.2,
        thisMonth: 180.7,
      },
    };

    return {
      success: true,
      data: stats,
    };
  }

  // PRIVATE HELPER METHODS

  /**
   * Validates order creation request for additional security
   */
  /**
 * Validates order creation request for additional security
 */
private async validateOrderCreationRequest(
  createOrderDto: CreateOrderDto, 
  user: { id: string; role: Role }
): Promise<void> {
  // Phone number format validation
  const phoneRegex = /^(\+62|62|0)[0-9]{8,13}$/;
  if (!phoneRegex.test(createOrderDto.passengerPhone.replace(/[\s\-]/g, ''))) {
    throw new BadRequestException('Invalid phone number format');
  }

  // Validate coordinates are within Riau bounds
  const { pickupCoordinates, dropoffCoordinates } = createOrderDto;
  if (!this.isWithinSumateraBounds(pickupCoordinates) || 
      !this.isWithinSumateraBounds(dropoffCoordinates)) {
    throw new BadRequestException('Coordinates must be within Riau Province');
  }

  // Validate fare consistency
  const expectedTotal = createOrderDto.baseFare + createOrderDto.distanceFare + (createOrderDto.airportFare || 0);
  if (Math.abs(expectedTotal - createOrderDto.totalFare) > 10000) { // Allow 100 rupiah difference for rounding
    throw new BadRequestException('Fare calculation inconsistency detected');
  }

  // Validate minimum fare (base fare should be at least 60,000 rupiah = 6,000,000 cents)
  if (createOrderDto.totalFare < 6000000) { // 60,000 rupiah minimum
    throw new BadRequestException('Total fare below minimum threshold');
  }

  // FIXED: More realistic fare validation for Indonesian taxi system
  // Base fare: 60,000 IDR for first km + 6,000 IDR per additional km
  const distanceKm = createOrderDto.distanceMeters / 1000;
  
  // Calculate expected fare range based on distance
  const expectedBaseFare = 6000000; // 60,000 rupiah in cents
  const expectedAdditionalFare = Math.max(0, distanceKm - 1) * 600000; // 6,000 rupiah per km in cents
  const expectedMinimumFare = expectedBaseFare + expectedAdditionalFare;
  const expectedMaximumFare = expectedMinimumFare * 1000; // Allow 2x multiplier for vehicle types
  
  if (createOrderDto.totalFare < expectedMinimumFare || 
      createOrderDto.totalFare > expectedMaximumFare) {
    this.logger.warn('Fare validation failed', {
      distanceKm,
      totalFare: createOrderDto.totalFare,
      expectedMinimum: expectedMinimumFare,
      expectedMaximum: expectedMaximumFare,
      vehicleType: createOrderDto.requestedVehicleType
    });
    
    throw new BadRequestException(
      `Total fare (${createOrderDto.totalFare} cents) is outside expected range ` +
      `(${expectedMinimumFare} - ${expectedMaximumFare} cents) for ${distanceKm.toFixed(1)}km trip`
    );
  }

  // Validate distance is reasonable (0.1km - 100km)
  if (distanceKm < 0.1 || distanceKm > 10000) {
    throw new BadRequestException(`Trip distance (${distanceKm.toFixed(1)}km) is outside reasonable range`);
  }

  // Validate duration is reasonable (1 minute - 300 minutes)
  if (createOrderDto.estimatedDurationMinutes < 1 || createOrderDto.estimatedDurationMinutes > 300) {
    throw new BadRequestException(`Estimated duration (${createOrderDto.estimatedDurationMinutes} minutes) is outside reasonable range`);
  }
}

  /**
   * Check if coordinates are within Indonesia bounds
   */
  private isWithinSumateraBounds(coordinates: { lat: number; lng: number }): boolean {
    const { lat, lng } = coordinates;
    return lat >= -6.108 && lat <= 5.946 && lng >= 95.007 && lng <= 106.007;
  }
  
  

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}