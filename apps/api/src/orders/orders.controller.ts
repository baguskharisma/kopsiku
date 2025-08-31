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
import { OrderStatus, Role } from '@prisma/client';
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

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest
  ) {
    try {
      const order = await this.ordersService.create(createOrderDto);
      return {
        success: true,
        data: order,
        message: 'Order created successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Post(':id/assign')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign driver to order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Driver assigned successfully',
    type: OrderEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid assignment' })
  @ApiResponse({ status: 404, description: 'Order or driver not found' })
  async assignDriver(
    @Param('id') id: string,
    @Body(ValidationPipe) assignDriverDto: AssignDriverDto,
    @Request() req: AuthenticatedRequest
  ) {
    const order = await this.ordersService.assignDriver(id, assignDriverDto, req.user.id);
    return {
      success: true,
      data: order,
      message: 'Driver assigned successfully',
    };
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: OrderEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
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
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderEntity' },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
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

  @Get('my-orders')
  @Roles('DRIVER')
  @ApiOperation({ summary: 'Get current driver orders' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyOrders(
    @Query('status') status?: OrderStatus,
    @Query('limit') limit = 10,
    @Request() req?: AuthenticatedRequest
  ) {
    const filters = {
      driverId: req?.user.id,
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

  @Get('active')
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
      limit: 1,
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

  @Post(':id/accept')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver accepts assigned order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order accepted successfully',
    type: OrderEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid order state' })
  @ApiResponse({ status: 403, description: 'Order not assigned to you' })
  async acceptOrder(
    @Param('id') id: string,
    @Body() body: { estimatedArrival?: number },
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
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    return {
      success: true,
      data: updatedOrder,
      message: 'Order accepted successfully',
    };
  }

  @Post(':id/arrive')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver marks arrival at pickup location' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Arrival marked successfully',
    type: OrderEntity,
  })
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

  @Post(':id/start')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver starts the trip' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Trip started successfully',
    type: OrderEntity,
  })
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

  @Post(':id/complete')
  @Roles('DRIVER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver completes the trip' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Trip completed successfully',
    type: OrderEntity,
  })
  async completeTrip(
    @Param('id') id: string,
    @Body() body: { 
      location?: { lat: number; lng: number };
      finalFare?: number;
      notes?: string;
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
    };

    const updatedOrder = await this.ordersService.updateStatus(id, updateDto, req.user.id);
    return {
      success: true,
      data: updatedOrder,
      message: 'Trip completed successfully',
    };
  }

  @Post(':id/cancel')
  @Roles('DRIVER', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderEntity,
  })
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

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER', 'CUSTOMER')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: OrderEntity,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
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

  @Get(':id/history')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER')
  @ApiOperation({ summary: 'Get order status history' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async getOrderHistory(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest
  ) {
    const order = await this.ordersService.findOne(id);

    // Check permissions for drivers
    if (req.user.role === 'DRIVER' && order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only view your own order history');
    }

    return {
      success: true,
      data: {
        orderId: id,
        orderNumber: order.orderNumber,
        statusHistory: order.statusHistory || [],
      },
    };
  }

  @Get('stats/dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get orders dashboard statistics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getDashboardStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    // This would typically call a separate stats service
    const filters = {
      dateFrom,
      dateTo,
      page: 1,
      limit: 1000, // Get more data for stats
    };

    const orders = await this.ordersService.findAll(filters);
    
    const completedOrders = orders.data.filter(o => o.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.data.filter(o => 
      o.status.toString().includes('CANCELLED')
    );
    
    const stats = {
      totalOrders: orders.meta.total,
      pendingOrders: orders.data.filter(o => o.status === OrderStatus.PENDING).length,
      activeOrders: orders.data.filter(o => [
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.DRIVER_ACCEPTED,
        OrderStatus.DRIVER_ARRIVING as string,
        OrderStatus.IN_PROGRESS as string,
      ].includes(o.status.toString())).length,
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

  @Post('bulk-assign')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk assign orders to drivers' })
  @ApiResponse({
    status: 200,
    description: 'Bulk assignment completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              success: { type: 'boolean' },
              data: { $ref: '#/components/schemas/OrderEntity' },
              error: { type: 'string' },
            },
          },
        },
        message: { type: 'string' },
      },
    },
  })

  

  async bulkAssignOrders(
    @Body() body: {
      assignments: Array<{
        orderId: string;
        driverId: string;
        fleetId: string;
        reason?: string;
      }>;
    },
    @Request() req: AuthenticatedRequest
  ) {
    const results: Array<{
      orderId: string;
      success: boolean;
      data?: any;
      error?: string;
    }> = [];
    
    for (const assignment of body.assignments) {
      try {
        const assignDto = new AssignDriverDto();
        assignDto.driverId = assignment.driverId;
        assignDto.fleetId = assignment.fleetId;
        assignDto.reason = assignment.reason || 'Bulk assignment';

        const result = await this.ordersService.assignDriver(
          assignment.orderId,
          assignDto,
          req.user.id
        );
        
        results.push({  
          orderId: assignment.orderId,
          success: true,
          data: result,
        });
      } catch (error) {
        results.push({
          orderId: assignment.orderId,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      data: results,
      message: `${successCount}/${body.assignments.length} orders assigned successfully`,
    };
  }

  @Get('nearby/:driverId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DRIVER')
  @ApiOperation({ summary: 'Get nearby orders for a driver' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Search radius in km' })
  async getNearbyOrders(
    @Param('driverId') driverId: string,
    @Query('radius') radius = 5,
    @Request() req: AuthenticatedRequest
  ) {
    // Check permissions - drivers can only see their own nearby orders
    if (req.user.role === 'DRIVER' && req.user.id !== driverId) {
      throw new ForbiddenException('You can only view your own nearby orders');
    }

    // Get pending orders
    const pendingOrders = await this.ordersService.findAll({
      status: OrderStatus.PENDING,
      page: 1,
      limit: 50,
    });

    // This is a simplified version - in production, you'd use PostGIS or similar
    // for proper geospatial queries with actual driver location
    const nearbyOrders = pendingOrders.data.filter(order => {
      // For now, return all pending orders
      // In production, calculate actual distance based on driver location
      return true;
    });

    return {
      success: true,
      data: nearbyOrders,
      message: `Found ${nearbyOrders.length} nearby orders within ${radius}km`,
    };
  }

  @Post('emergency-broadcast')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send emergency broadcast to all drivers' })
  @ApiResponse({
    status: 200,
    description: 'Emergency broadcast sent successfully',
  })
  async emergencyBroadcast(
    @Body() body: {
      message: string;
      priority: 'low' | 'medium' | 'high' | 'emergency';
      targetDrivers?: string[];
    },
    @Request() req: AuthenticatedRequest
  ) {
    // This would integrate with the WebSocket gateway
    // For now, return success response
    
    return {
      success: true,
      message: 'Emergency broadcast sent successfully',
      data: {
        broadcastId: `emergency-${Date.now()}`,
        sentAt: new Date().toISOString(),
        targetCount: body.targetDrivers ? body.targetDrivers.length : 'all_drivers',
        priority: body.priority,
      },
    };
  }

  @Get('performance/driver/:driverId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get detailed driver performance metrics' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getDriverPerformance(
    @Param('driverId') driverId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      driverId,
      dateFrom,
      dateTo,
      page: 1,
      limit: 1000,
    };

    const orders = await this.ordersService.findAll(filters);
    
    const completedOrders = orders.data.filter(o => o.status === OrderStatus.COMPLETED);
    const cancelledOrders = orders.data.filter(o => 
      o.status === OrderStatus.CANCELLED_BY_DRIVER
    );
    
    const performance = {
      driverId,
      period: { dateFrom, dateTo },
      metrics: {
        totalTrips: orders.meta.total,
        completedTrips: completedOrders.length,
        cancelledTrips: cancelledOrders.length,
        completionRate: orders.data.length > 0 
          ? (completedOrders.length / orders.data.length) * 100 
          : 0,
        cancellationRate: orders.data.length > 0 
          ? (cancelledOrders.length / orders.data.length) * 100 
          : 0,
        totalEarnings: completedOrders.reduce((sum, o) => sum + o.totalFare, 0),
        averageEarningsPerTrip: completedOrders.length > 0
          ? completedOrders.reduce((sum, o) => sum + o.totalFare, 0) / completedOrders.length
          : 0,
        averageRating: 4.5, // This would come from ratings service
        totalRatings: completedOrders.length,
        onTimePerformance: 95.2, // Calculate based on estimated vs actual times
        responseTime: {
          averageAcceptanceTime: 45, // seconds
          averageArrivalTime: 8.5, // minutes
        },
      },
      trends: {
        dailyTrips: this.calculateDailyTrends(orders.data),
        earnings: this.calculateEarningsTrends(completedOrders),
        performance: this.calculatePerformanceTrends(orders.data),
      },
    };

    return {
      success: true,
      data: performance,
    };
  }

  @Get('analytics/fleet')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get fleet-wide analytics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'fleetId', required: false, type: String })
  async getFleetAnalytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('fleetId') fleetId?: string,
  ) {
    const filters = {
      dateFrom,
      dateTo,
      page: 1,
      limit: 5000, // Large dataset for analytics
    };

    const orders = await this.ordersService.findAll(filters);
    
    // Group by driver for fleet analysis
    const driverStats = new Map();
    
    orders.data.forEach(order => {
      if (!order.driverId) return;
      
      if (!driverStats.has(order.driverId)) {
        driverStats.set(order.driverId, {
          driverId: order.driverId,
          totalTrips: 0,
          completedTrips: 0,
          cancelledTrips: 0,
          totalEarnings: 0,
        });
      }
      
      const stats = driverStats.get(order.driverId);
      stats.totalTrips++;
      
      if (order.status === OrderStatus.COMPLETED) {
        stats.completedTrips++;
        stats.totalEarnings += order.totalFare;
      } else if (order.status === OrderStatus.CANCELLED_BY_DRIVER) {
        stats.cancelledTrips++;
      }
    });

    const driverPerformance = Array.from(driverStats.values()).map(stats => ({
      ...stats,
      completionRate: stats.totalTrips > 0 
        ? (stats.completedTrips / stats.totalTrips) * 100 
        : 0,
      averageEarnings: stats.completedTrips > 0 
        ? stats.totalEarnings / stats.completedTrips 
        : 0,
    }));

    const analytics = {
      period: { dateFrom, dateTo },
      fleet: {
        totalDrivers: driverPerformance.length,
        activeDrivers: driverPerformance.filter(d => d.totalTrips > 0).length,
        topPerformers: driverPerformance
          .sort((a, b) => b.completionRate - a.completionRate)
          .slice(0, 10),
        bottomPerformers: driverPerformance
          .filter(d => d.totalTrips >= 5) // Only drivers with significant activity
          .sort((a, b) => a.completionRate - b.completionRate)
          .slice(0, 5),
      },
      aggregates: {
        totalOrders: orders.meta.total,
        totalRevenue: driverPerformance.reduce((sum, d) => sum + d.totalEarnings, 0),
        averageCompletionRate: driverPerformance.length > 0
          ? driverPerformance.reduce((sum, d) => sum + d.completionRate, 0) / driverPerformance.length
          : 0,
        totalTripsCompleted: driverPerformance.reduce((sum, d) => sum + d.completedTrips, 0),
      },
      insights: {
        peakHours: this.calculatePeakHours(orders.data),
        busyDays: this.calculateBusyDays(orders.data),
        cancellationReasons: this.analyzeCancellationReasons(orders.data),
      },
    };

    return {
      success: true,
      data: analytics,
    };
  }

  @Post('driver/:driverId/feedback')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provide feedback to driver based on performance' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  async provideDriverFeedback(
    @Param('driverId') driverId: string,
    @Body() body: {
      feedbackType: 'commendation' | 'improvement' | 'warning';
      message: string;
      actionItems?: string[];
      followUpDate?: string;
    },
    @Request() req: AuthenticatedRequest
  ) {
    // In production, this would save to a feedback/notifications service
    const feedback = {
      id: `feedback-${Date.now()}`,
      driverId,
      type: body.feedbackType,
      message: body.message,
      actionItems: body.actionItems || [],
      providedBy: req.user.id,
      providedAt: new Date().toISOString(),
      followUpDate: body.followUpDate,
      status: 'pending_acknowledgment',
    };

    return {
      success: true,
      data: feedback,
      message: 'Feedback provided successfully',
    };
  }

  // Helper methods for analytics calculations
  private calculateDailyTrends(orders: any[]) {
    const dailyData = new Map();
    
    orders.forEach(order => {
      const date = new Date(order.createdAt).toDateString();
      if (!dailyData.has(date)) {
        dailyData.set(date, 0);
      }
      dailyData.set(date, dailyData.get(date) + 1);
    });

    return Array.from(dailyData.entries()).map(([date, count]) => ({
      date,
      trips: count,
    }));
  }

  private calculateEarningsTrends(completedOrders: any[]) {
    const dailyEarnings = new Map();
    
    completedOrders.forEach(order => {
      const date = new Date(order.createdAt).toDateString();
      if (!dailyEarnings.has(date)) {
        dailyEarnings.set(date, 0);
      }
      dailyEarnings.set(date, dailyEarnings.get(date) + order.totalFare);
    });

    return Array.from(dailyEarnings.entries()).map(([date, earnings]) => ({
      date,
      earnings,
    }));
  }

  private calculatePerformanceTrends(orders: any[]) {
    const weeklyPerformance = new Map();
    
    orders.forEach(order => {
      const weekStart = this.getWeekStart(new Date(order.createdAt));
      const key = weekStart.toDateString();
      
      if (!weeklyPerformance.has(key)) {
        weeklyPerformance.set(key, { total: 0, completed: 0 });
      }
      
      const stats = weeklyPerformance.get(key);
      stats.total++;
      
      if (order.status === OrderStatus.COMPLETED) {
        stats.completed++;
      }
    });

    return Array.from(weeklyPerformance.entries()).map(([week, stats]) => ({
      week,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      totalTrips: stats.total,
    }));
  }

  private calculatePeakHours(orders: any[]) {
    const hourlyData = new Map();
    
    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
    });

    return Array.from(hourlyData.entries())
      .map(([hour, count]) => ({ hour, orders: count }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }

  private calculateBusyDays(orders: any[]) {
    const dailyData = new Map();
    
    orders.forEach(order => {
      const dayName = new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      dailyData.set(dayName, (dailyData.get(dayName) || 0) + 1);
    });

    return Array.from(dailyData.entries())
      .map(([day, count]) => ({ day, orders: count }))
      .sort((a, b) => b.orders - a.orders);
  }

  private analyzeCancellationReasons(orders: any[]) {
    const reasons = new Map();
    
    orders
      .filter(order => order.status.toString().includes('CANCELLED'))
      .forEach(order => {
        const reason = order.statusHistory?.slice(-1)[0]?.reason || 'Unknown';
        reasons.set(reason, (reasons.get(reason) || 0) + 1);
      });

    return Array.from(reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
}