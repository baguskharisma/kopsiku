import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OrderStatus, DriverStatus, VehicleType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  driverId?: string;
}

interface DriverSocket {
  socket: AuthenticatedSocket;
  driverId: string;
  isActive: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  vehicleType?: VehicleType;
  lastLocationUpdate?: Date;
}

interface OrderAssignmentData {
  orderId: string;
  orderNumber: string;
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  estimatedDuration: number;
  vehicleType: VehicleType;
  specialRequests?: string;
  distanceKm?: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private logger = new Logger('OrdersGateway');
  private driverSockets = new Map<string, DriverSocket>(); // driverId -> socket info
  private operatorSockets = new Set<AuthenticatedSocket>(); // operator/admin sockets

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    try {
      // Extract token from auth header or query
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (token) {
        const payload = this.jwtService.verify(token);
        client.userId = payload.sub;
        client.userRole = payload.role;
        
        if (payload.role === 'DRIVER') {
          client.driverId = payload.sub;
          await this.handleDriverConnection(client);
        } else if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') {
          await this.handleOperatorConnection(client);
        }
      }
    } catch (error) {
      this.logger.warn(`Authentication failed for client ${client.id}: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove from driver sockets
    if (client.driverId) {
      const driverSocket = this.driverSockets.get(client.driverId);
      if (driverSocket && driverSocket.socket.id === client.id) {
        this.driverSockets.delete(client.driverId);
        this.logger.log(`Driver ${client.driverId} disconnected`);
        
        // Notify operators about driver going offline
        this.server.to('operators').emit('driver:disconnected', {
          driverId: client.driverId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Remove from operator sockets
    this.operatorSockets.delete(client);
  }

  private async handleDriverConnection(client: AuthenticatedSocket) {
    if (!client.driverId) return;

    this.driverSockets.set(client.driverId, {
      socket: client,
      driverId: client.driverId,
      isActive: true,
    });
    
    client.join(`driver:${client.driverId}`);
    this.logger.log(`Driver ${client.driverId} authenticated and joined room`);
    
    // Notify operators about new driver online
    this.server.to('operators').emit('driver:connected', {
      driverId: client.driverId,
      timestamp: new Date().toISOString(),
    });

    // Send welcome message with current stats
    client.emit('driver:welcome', {
      message: 'Connected to KOPSI system',
      timestamp: new Date().toISOString(),
      onlineDrivers: this.driverSockets.size,
    });
  }

  private async handleOperatorConnection(client: AuthenticatedSocket) {
    this.operatorSockets.add(client);
    client.join('operators');
    this.logger.log(`Operator ${client.userId} authenticated and joined operators room`);

    // Send current system status
    client.emit('system:status', {
      connectedDrivers: this.driverSockets.size,
      connectedOperators: this.operatorSockets.size,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('driver:location_update')
  async handleDriverLocationUpdate(
    @MessageBody() data: { lat: number; lng: number; accuracy?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) return;

    // Update driver location
    driverSocket.location = { lat: data.lat, lng: data.lng };
    driverSocket.lastLocationUpdate = new Date();
    
    // Validate location data
    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      client.emit('error', { message: 'Invalid location coordinates' });
      return;
    }

    // Broadcast location update to operators
    this.server.to('operators').emit('driver:location_updated', {
      driverId: client.driverId,
      location: {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy || null,
      },
      timestamp: new Date().toISOString(),
    });

    // Acknowledge location update
    client.emit('driver:location_acknowledged', {
      success: true,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('driver:status_change')
  async handleDriverStatusChange(
    @MessageBody() data: { status: DriverStatus },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) return;

    driverSocket.isActive = data.status === DriverStatus.ACTIVE;
    
    // Notify operators
    this.server.to('operators').emit('driver:status_changed', {
      driverId: client.driverId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });

    // Acknowledge status change
    client.emit('driver:status_acknowledged', {
      success: true,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('driver:accept_order')
  async handleDriverAcceptOrder(
    @MessageBody() data: { orderId: string; estimatedArrival?: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const acceptanceData = {
      orderId: data.orderId,
      driverId: client.driverId,
      estimatedArrival: data.estimatedArrival || 5,
      acceptedAt: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order:driver_accepted', acceptanceData);
    
    // Acknowledge acceptance
    client.emit('order:acceptance_confirmed', {
      success: true,
      orderId: data.orderId,
      message: 'Order accepted successfully',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Driver ${client.driverId} accepted order ${data.orderId}`);
  }

  @SubscribeMessage('driver:reject_order')
  async handleDriverRejectOrder(
    @MessageBody() data: { orderId: string; reason?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const rejectionData = {
      orderId: data.orderId,
      driverId: client.driverId,
      reason: data.reason || 'No reason provided',
      rejectedAt: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order:driver_rejected', rejectionData);
    
    // Acknowledge rejection
    client.emit('order:rejection_confirmed', {
      success: true,
      orderId: data.orderId,
      message: 'Order rejection recorded',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Driver ${client.driverId} rejected order ${data.orderId}: ${data.reason}`);
  }

  @SubscribeMessage('driver:update_trip_status')
  async handleDriverUpdateTripStatus(
    @MessageBody() data: { 
      orderId: string; 
      status: 'arrived' | 'started' | 'completed';
      location?: { lat: number; lng: number };
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const statusData = {
      orderId: data.orderId,
      driverId: client.driverId,
      status: data.status,
      location: data.location,
      timestamp: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order:trip_status_updated', statusData);
    
    // Acknowledge status update
    client.emit('order:status_update_confirmed', {
      success: true,
      orderId: data.orderId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Driver ${client.driverId} updated trip status for order ${data.orderId}: ${data.status}`);
  }

  @SubscribeMessage('get_active_drivers')
  handleGetActiveDrivers(@ConnectedSocket() client: AuthenticatedSocket) {
    // Only allow operators to get driver list
    if (client.userRole !== 'ADMIN' && client.userRole !== 'SUPER_ADMIN') {
      client.emit('error', { message: 'Unauthorized access' });
      return;
    }

    const activeDrivers = Array.from(this.driverSockets.entries())
      .filter(([_, driverSocket]) => driverSocket.isActive)
      .map(([driverId, driverSocket]) => ({
        driverId,
        location: driverSocket.location,
        vehicleType: driverSocket.vehicleType,
        isOnline: true,
        lastLocationUpdate: driverSocket.lastLocationUpdate,
      }));

    client.emit('active_drivers_list', {
      drivers: activeDrivers,
      count: activeDrivers.length,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('operator:broadcast_message')
  async handleOperatorBroadcast(
    @MessageBody() data: { 
      message: string; 
      targetDrivers?: string[]; 
      priority?: 'low' | 'medium' | 'high' 
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Only allow operators to broadcast
    if (client.userRole !== 'ADMIN' && client.userRole !== 'SUPER_ADMIN') {
      client.emit('error', { message: 'Unauthorized access' });
      return;
    }

    const broadcastData = {
      message: data.message,
      priority: data.priority || 'medium',
      from: 'operator',
      timestamp: new Date().toISOString(),
    };

    if (data.targetDrivers && data.targetDrivers.length > 0) {
      // Send to specific drivers
      data.targetDrivers.forEach(driverId => {
        this.server.to(`driver:${driverId}`).emit('operator:message', broadcastData);
      });
    } else {
      // Broadcast to all connected drivers
      this.driverSockets.forEach((_, driverId) => {
        this.server.to(`driver:${driverId}`).emit('operator:message', broadcastData);
      });
    }

    client.emit('broadcast:confirmed', {
      success: true,
      targetCount: data.targetDrivers ? data.targetDrivers.length : this.driverSockets.size,
      timestamp: new Date().toISOString(),
    });
  }

  // Order events - called from OrdersService
  emitOrderCreated(order: any) {
    const orderData = {
      event: 'order.created',
      data: order,
      timestamp: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order.created', orderData);
    
    this.logger.log(`Order created event emitted: ${order.orderNumber}`);
  }

  emitOrderAssigned(order: any) {
    const orderData = {
      event: 'order.assigned',
      data: order,
      timestamp: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order.assigned', orderData);

    // Notify specific driver
    if (order.driverId) {
      this.server.to(`driver:${order.driverId}`).emit('order.assignment', orderData);
    }

    this.logger.log(`Order assigned event emitted: ${order.orderNumber} -> ${order.driver?.name}`);
  }

  emitOrderStatusUpdated(order: any) {
    const orderData = {
      event: 'order.status.updated',
      data: order,
      timestamp: new Date().toISOString(),
    };

    // Notify everyone
    this.server.emit('order.status.updated', orderData);

    // Specific notification to operators
    this.server.to('operators').emit('order.status.changed', {
      event: 'order.status.changed',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        driverId: order.driverId,
        driverName: order.driver?.name,
      },
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Order status updated: ${order.orderNumber} -> ${order.status}`);
  }

  emitDriverStatusChanged(driverId: string, status: DriverStatus) {
    const statusData = {
      event: 'driver.status.changed',
      data: {
        driverId,
        status,
      },
      timestamp: new Date().toISOString(),
    };

    // Update local driver socket status
    const driverSocket = this.driverSockets.get(driverId);
    if (driverSocket) {
      driverSocket.isActive = status === DriverStatus.ACTIVE;
    }

    // Notify operators and the driver
    this.server.to('operators').emit('driver.status.changed', statusData);
    this.server.to(`driver:${driverId}`).emit('driver.status.updated', statusData);

    this.logger.log(`Driver status changed: ${driverId} -> ${status}`);
  }

  // Enhanced driver notification methods
  notifyDriverAssignment(driverId: string, order: any) {
    const notificationData: OrderAssignmentData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      passengerName: order.passengerName,
      passengerPhone: order.passengerPhone,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      estimatedFare: Number(order.totalFare),
      estimatedDuration: order.estimatedDurationMinutes,
      vehicleType: order.requestedVehicleType,
      specialRequests: order.specialRequests,
      distanceKm: order.distanceMeters ? order.distanceMeters / 1000 : undefined,
    };

    const fullNotification = {
      event: 'new_order_assignment',
      data: notificationData,
      timestamp: new Date().toISOString(),
    };

    // Send to specific driver
    this.server.to(`driver:${driverId}`).emit('order.new_assignment', fullNotification);
    
    // Also send push-style notification
    this.server.to(`driver:${driverId}`).emit('notification', {
      type: 'order_assignment',
      title: 'New Trip Assignment',
      message: `You have been assigned a trip from ${order.pickupAddress} to ${order.dropoffAddress}`,
      priority: 'high',
      data: notificationData,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Driver assignment notification sent to: ${driverId}`);
  }

  notifyAvailableDrivers(order: any, radius: number = 5) {
    const notificationData = {
      event: 'new_order_available',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        estimatedFare: Number(order.totalFare),
        vehicleType: order.requestedVehicleType,
        pickupLocation: {
          lat: order.pickupLat,
          lng: order.pickupLng,
        },
        distanceKm: order.distanceMeters ? order.distanceMeters / 1000 : undefined,
        specialRequests: order.specialRequests,
      },
      timestamp: new Date().toISOString(),
    };

    // Filter drivers by vehicle type and proximity
    const eligibleDrivers = Array.from(this.driverSockets.entries())
      .filter(([_, driverSocket]) => {
        if (!driverSocket.isActive || !driverSocket.location) return false;
        
        // Check vehicle type compatibility
        if (driverSocket.vehicleType && driverSocket.vehicleType !== order.requestedVehicleType) {
          return false;
        }

        // Check proximity (simple distance calculation)
        const distance = this.calculateDistance(
          driverSocket.location.lat,
          driverSocket.location.lng,
          order.pickupLat,
          order.pickupLng
        );
        
        return distance <= radius;
      });

    // Notify eligible drivers
    eligibleDrivers.forEach(([driverId, driverSocket]) => {
      driverSocket.socket.emit('order.available', notificationData);
    });

    this.logger.log(`New order broadcast to ${eligibleDrivers.length} eligible drivers: ${order.orderNumber}`);
  }

  // Utility methods
  getConnectedDriversCount(): number {
    return Array.from(this.driverSockets.values()).filter(d => d.isActive).length;
  }

  getConnectedOperatorsCount(): number {
    return this.operatorSockets.size;
  }

  getDriversByVehicleType(vehicleType: VehicleType): string[] {
    return Array.from(this.driverSockets.entries())
      .filter(([_, driverSocket]) => 
        driverSocket.isActive && 
        (!driverSocket.vehicleType || driverSocket.vehicleType === vehicleType)
      )
      .map(([driverId]) => driverId);
  }

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

  // Health check method for monitoring
  getSystemHealth() {
    return {
      connectedDrivers: this.driverSockets.size,
      activeDrivers: this.getConnectedDriversCount(),
      connectedOperators: this.operatorSockets.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}