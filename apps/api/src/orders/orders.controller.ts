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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderEntity } from './entities/order.entity';
import { OrderStatus, Role, VehicleType } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { OrdersService } from './orders.sevice';

interface AuthenticatedRequest {
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
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // OPERATOR ENDPOINTS

  @Post('operator/create')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Operator creates a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderEntity,
  })
  async createOrderAsOperator(
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest
  ) {
    const order = await this.ordersService.create(createOrderDto, req.user.id);
    return {
      success: true,
      data: order,
      message: 'Order created successfully',
    };
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
    const order = await this.ordersService.assignDriver(id, assignDriverDto, req.user.id);
    return {
      success: true,
      data: order,
      message: 'Driver assigned successfully. Notification sent to driver.',
    };
  }

  @Get('operator/dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get operator dashboard data' })
  async getOperatorDashboard() {
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
    updateDto.reason = body.reason;
    updateDto.metadata = {
      rejectedAt: new Date().toISOString(),
      driverRejection: true,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
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
      limit: Number(limit),
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
    updateDto.reason = body.reason;
    updateDto.metadata = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.user.id,
      cancellationFee: body.cancellationFee || 0,
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
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
      totalRevenue: completedOrders.reduce((sum, o) => sum + o.totalFare, 0),
      averageOrderValue: orders.data.length > 0 
        ? orders.data.reduce((sum, o) => sum + o.totalFare, 0) / orders.data.length
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
      totalEarnings: completedTrips.reduce((sum, o) => sum + o.totalFare, 0),
      averageEarningPerTrip: completedTrips.length > 0
        ? completedTrips.reduce((sum, o) => sum + o.totalFare, 0) / completedTrips.length
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
}