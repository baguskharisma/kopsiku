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
    accuracy?: number;
    heading?: number;
    speed?: number;
  };
  vehicleType?: VehicleType;
  lastLocationUpdate?: Date;
  lastActivity?: Date;
  currentOrderId?: string;
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
  fleetInfo?: {
    plateNumber: string;
    brand: string;
    model: string;
    color: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;
  private logger = new Logger('OrdersGateway');

  // Connection maps
  private driverSockets = new Map<string, DriverSocket>(); // driverId -> socket info
  private operatorSockets = new Set<AuthenticatedSocket>(); // operator/admin sockets
  private orderTimeouts = new Map<string, NodeJS.Timeout>(); // orderId -> timeout

  // Constants
  private readonly ACCEPTANCE_TIMEOUT = 120; // seconds
  private readonly HEARTBEAT_INTERVAL = 30; // seconds
  private readonly LOCATION_UPDATE_INTERVAL = 10; // seconds

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.startHeartbeat();
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client attempting connection: ${client.id}`);

    try {
      // Extract token from auth header or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`No token provided for client ${client.id}`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.userRole = payload.role;

      // Handle different user types
      switch (payload.role) {
        case 'DRIVER':
          client.driverId = payload.sub;
          await this.handleDriverConnection(client);
          break;
        case 'ADMIN':
        case 'SUPER_ADMIN':
          await this.handleOperatorConnection(client);
          break;
        default:
          this.logger.warn(`Unsupported role: ${payload.role}`);
          client.emit('error', { message: 'Unsupported user role' });
          client.disconnect(true);
      }
    } catch (error) {
      this.logger.warn(
        `Authentication failed for client ${client.id}: ${error.message}`,
      );
      client.emit('error', { message: 'Invalid authentication token' });
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

  // CONNECTION HANDLERS

  private async handleDriverConnection(client: AuthenticatedSocket) {
    if (!client.driverId) return;

    this.driverSockets.set(client.driverId, {
      socket: client,
      driverId: client.driverId,
      isActive: true,
      lastActivity: new Date(),
    });

    client.join(`driver:${client.driverId}`);
    client.join('drivers'); // General drivers room

    this.logger.log(`Driver ${client.driverId} authenticated and joined rooms`);

    // Notify operators about new driver online
    this.server.to('operators').emit('driver:connected', {
      driverId: client.driverId,
      timestamp: new Date().toISOString(),
    });

    // Send welcome message with system status
    client.emit('driver:welcome', {
      message: 'Successfully connected to KOPSI system',
      timestamp: new Date().toISOString(),
      systemStatus: {
        onlineDrivers: this.driverSockets.size,
        serverTime: new Date().toISOString(),
      },
    });
  }

  private async handleOperatorConnection(client: AuthenticatedSocket) {
    this.operatorSockets.add(client);
    client.join('operators');
    this.logger.log(
      `Operator ${client.userId} authenticated and joined operators room`,
    );

    // Send current system status
    client.emit('system:status', {
      connectedDrivers: this.driverSockets.size,
      connectedOperators: this.operatorSockets.size,
      activeOrders: this.getActiveOrdersCount(),
      timestamp: new Date().toISOString(),
    });
  }

  // DRIVER MESSAGE HANDLERS

  @SubscribeMessage('driver:location_update')
  async handleDriverLocationUpdate(
    @MessageBody()
    data: {
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) {
      client.emit('error', { message: 'Driver ID not found' });
      return;
    }

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) {
      client.emit('error', { message: 'Driver session not found' });
      return;
    }

    // Validate location data
    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
      client.emit('error', { message: 'Invalid location coordinates' });
      return;
    }

    // Update driver location
    driverSocket.location = {
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      heading: data.heading,
      speed: data.speed,
    };
    driverSocket.lastLocationUpdate = new Date();
    driverSocket.lastActivity = new Date();

    // Broadcast location update to operators
    this.server.to('operators').emit('driver:location_updated', {
      driverId: client.driverId,
      location: driverSocket.location,
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
    @MessageBody() data: { status: DriverStatus; currentOrderId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) return;

    const previousStatus = driverSocket.isActive;
    driverSocket.isActive = data.status === DriverStatus.ACTIVE;
    driverSocket.lastActivity = new Date();
    driverSocket.currentOrderId = data.currentOrderId;

    // Notify operators about status change
    this.server.to('operators').emit('driver:status_changed', {
      driverId: client.driverId,
      status: data.status,
      previousStatus: previousStatus
        ? DriverStatus.ACTIVE
        : DriverStatus.OFFLINE,
      currentOrderId: data.currentOrderId,
      timestamp: new Date().toISOString(),
    });

    // Acknowledge status change
    client.emit('driver:status_acknowledged', {
      success: true,
      status: data.status,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Driver ${client.driverId} status changed to ${data.status}`,
    );
  }

  @SubscribeMessage('driver:order_response')
  async handleDriverOrderResponse(
    @MessageBody()
    data: {
      orderId: string;
      action: 'accept' | 'reject';
      reason?: string;
      estimatedArrival?: number;
      location?: { lat: number; lng: number };
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) return;

    driverSocket.lastActivity = new Date();

    // Clear any existing timeout for this order
    const timeout = this.orderTimeouts.get(data.orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.orderTimeouts.delete(data.orderId);
    }

    const responseData = {
      orderId: data.orderId,
      driverId: client.driverId,
      action: data.action,
      reason: data.reason,
      estimatedArrival: data.estimatedArrival,
      location: data.location,
      respondedAt: new Date().toISOString(),
    };

    if (data.action === 'accept') {
      // Update current order
      driverSocket.currentOrderId = data.orderId;

      // Notify operators
      this.server.to('operators').emit('order:driver_accepted', responseData);

      // Acknowledge acceptance
      client.emit('order:response_acknowledged', {
        success: true,
        orderId: data.orderId,
        action: 'accepted',
        message: 'Order accepted successfully',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Notify operators about rejection
      this.server.to('operators').emit('order:driver_rejected', responseData);

      // Acknowledge rejection
      client.emit('order:response_acknowledged', {
        success: true,
        orderId: data.orderId,
        action: 'rejected',
        message: 'Order rejection recorded',
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.log(
      `Driver ${client.driverId} ${data.action}ed order ${data.orderId}`,
    );
  }

  @SubscribeMessage('driver:trip_update')
  async handleDriverTripUpdate(
    @MessageBody()
    data: {
      orderId: string;
      status: 'arriving' | 'arrived' | 'started' | 'completed';
      location?: { lat: number; lng: number };
      notes?: string;
      odometerReading?: number;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const driverSocket = this.driverSockets.get(client.driverId);
    if (!driverSocket) return;

    driverSocket.lastActivity = new Date();

    const updateData = {
      orderId: data.orderId,
      driverId: client.driverId,
      status: data.status,
      location: data.location,
      notes: data.notes,
      odometerReading: data.odometerReading,
      timestamp: new Date().toISOString(),
    };

    // Update current order status
    if (data.status === 'completed') {
      driverSocket.currentOrderId = undefined;
    }

    // Notify operators
    this.server.to('operators').emit('order:trip_updated', updateData);

    // Acknowledge update
    client.emit('trip:update_acknowledged', {
      success: true,
      orderId: data.orderId,
      status: data.status,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Driver ${client.driverId} updated trip ${data.orderId}: ${data.status}`,
    );
  }

  @SubscribeMessage('driver:emergency')
  async handleDriverEmergency(
    @MessageBody()
    data: {
      type: 'panic' | 'accident' | 'breakdown' | 'medical';
      location?: { lat: number; lng: number };
      message?: string;
      orderId?: string;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!client.driverId) return;

    const emergencyData = {
      driverId: client.driverId,
      type: data.type,
      location: data.location,
      message: data.message,
      orderId: data.orderId,
      timestamp: new Date().toISOString(),
      priority: 'EMERGENCY',
    };

    // Broadcast emergency to all operators with high priority
    this.server.to('operators').emit('emergency:driver_alert', emergencyData);

    // Log emergency
    this.logger.error(
      `EMERGENCY: Driver ${client.driverId} reported ${data.type}`,
    );

    // Acknowledge emergency
    client.emit('emergency:acknowledged', {
      success: true,
      message: 'Emergency alert sent to control center',
      timestamp: new Date().toISOString(),
    });
  }

  // OPERATOR MESSAGE HANDLERS

  @SubscribeMessage('operator:get_drivers')
  handleGetActiveDrivers(@ConnectedSocket() client: AuthenticatedSocket) {
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
        lastActivity: driverSocket.lastActivity,
        currentOrderId: driverSocket.currentOrderId,
      }));

    client.emit('drivers:list', {
      drivers: activeDrivers,
      count: activeDrivers.length,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('operator:broadcast_message')
  async handleOperatorBroadcast(
    @MessageBody()
    data: {
      message: string;
      targetDrivers?: string[];
      priority?: 'low' | 'medium' | 'high';
      type?: 'info' | 'warning' | 'alert';
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (client.userRole !== 'ADMIN' && client.userRole !== 'SUPER_ADMIN') {
      client.emit('error', { message: 'Unauthorized access' });
      return;
    }

    const broadcastData = {
      message: data.message,
      priority: data.priority || 'medium',
      type: data.type || 'info',
      from: 'control_center',
      operatorId: client.userId,
      timestamp: new Date().toISOString(),
    };

    let targetCount = 0;

    if (data.targetDrivers && data.targetDrivers.length > 0) {
      // Send to specific drivers
      data.targetDrivers.forEach((driverId) => {
        if (this.driverSockets.has(driverId)) {
          this.server
            .to(`driver:${driverId}`)
            .emit('operator:message', broadcastData);
          targetCount++;
        }
      });
    } else {
      // Broadcast to all connected drivers
      this.server.to('drivers').emit('operator:message', broadcastData);
      targetCount = this.driverSockets.size;
    }

    client.emit('broadcast:confirmed', {
      success: true,
      targetCount,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Operator ${client.userId} broadcast message to ${targetCount} drivers`,
    );
  }

  // ORDER EVENT METHODS (Called from OrdersService)

  emitOrderCreated(order: any) {
    const orderData = {
      event: 'order.created',
      data: this.transformOrderForEmit(order),
      timestamp: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order:created', orderData);

    this.logger.log(`Order created event emitted: ${order.orderNumber}`);
  }

  emitOrderAssigned(order: any) {
    const orderData = {
      event: 'order.assigned',
      data: this.transformOrderForEmit(order),
      timestamp: new Date().toISOString(),
    };

    // Notify operators
    this.server.to('operators').emit('order:assigned', orderData);

    // Notify specific driver if they're connected
    if (order.driverId && this.driverSockets.has(order.driverId)) {
      this.server
        .to(`driver:${order.driverId}`)
        .emit('order:assignment', orderData);
    }

    this.logger.log(
      `Order assigned event emitted: ${order.orderNumber} -> Driver ${order.driverId}`,
    );
  }

  emitOrderStatusUpdated(order: any) {
    const orderData = {
      event: 'order.status.updated',
      data: this.transformOrderForEmit(order),
      timestamp: new Date().toISOString(),
    };

    // Notify everyone
    this.server.emit('order:status_updated', orderData);

    this.logger.log(
      `Order status updated: ${order.orderNumber} -> ${order.status}`,
    );
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
      driverSocket.lastActivity = new Date();
    }

    // Notify operators and the driver
    this.server.to('operators').emit('driver:status_changed', statusData);
    this.server
      .to(`driver:${driverId}`)
      .emit('driver:status_updated', statusData);

    this.logger.log(`Driver status changed: ${driverId} -> ${status}`);
  }

  // Enhanced driver notification methods
  notifyDriverAssignment(driverId: string, order: any) {
    const driverSocket = this.driverSockets.get(driverId);
    if (!driverSocket) {
      this.logger.warn(`Cannot notify driver ${driverId} - not connected`);
      return;
    }

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
      distanceKm: order.distanceMeters
        ? order.distanceMeters / 1000
        : undefined,
      fleetInfo: order.fleet
        ? {
            plateNumber: order.fleet.plateNumber,
            brand: order.fleet.brand,
            model: order.fleet.model,
            color: order.fleet.color,
          }
        : undefined,
    };

    // Send detailed order assignment
    driverSocket.socket.emit('order:new_assignment', {
      event: 'new_order_assignment',
      data: notificationData,
      timeout: this.ACCEPTANCE_TIMEOUT,
      timestamp: new Date().toISOString(),
    });

    // Also send push-style notification
    driverSocket.socket.emit('notification', {
      type: 'order_assignment',
      title: 'New Trip Assignment',
      message: `Trip from ${order.pickupAddress.substring(0, 30)}... to ${order.dropoffAddress.substring(0, 30)}...`,
      priority: 'high',
      data: notificationData,
      timestamp: new Date().toISOString(),
    });

    // Set timeout for acceptance
    this.setOrderTimeout(order.id, driverId);

    this.logger.log(
      `Driver assignment notification sent to: ${driverId} for order: ${order.orderNumber}`,
    );
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
        distanceKm: order.distanceMeters
          ? order.distanceMeters / 1000
          : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // Filter drivers by vehicle type and proximity
    const eligibleDrivers = this.getEligibleDrivers(
      order.requestedVehicleType,
      { lat: order.pickupLat, lng: order.pickupLng },
      radius,
    );

    // Notify eligible drivers
    eligibleDrivers.forEach((driverId) => {
      this.server
        .to(`driver:${driverId}`)
        .emit('order:available', notificationData);
    });

    this.logger.log(
      `New order broadcast to ${eligibleDrivers.length} eligible drivers: ${order.orderNumber}`,
    );
  }

  // UTILITY METHODS

  private startHeartbeat() {
    setInterval(() => {
      // Check for inactive drivers
      const now = new Date();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

      this.driverSockets.forEach((driverSocket, driverId) => {
        if (
          driverSocket.lastActivity &&
          now.getTime() - driverSocket.lastActivity.getTime() >
            inactiveThreshold
        ) {
          this.logger.warn(
            `Driver ${driverId} appears inactive, sending heartbeat`,
          );
          driverSocket.socket.emit('heartbeat', {
            timestamp: now.toISOString(),
          });
        }
      });

      // Send system status to operators
      this.server.to('operators').emit('system:heartbeat', {
        connectedDrivers: this.driverSockets.size,
        activeDrivers: this.getActiveDriversCount(),
        connectedOperators: this.operatorSockets.size,
        timestamp: now.toISOString(),
      });
    }, this.HEARTBEAT_INTERVAL * 1000);
  }

  private setOrderTimeout(orderId: string, driverId: string) {
    const timeout = setTimeout(() => {
      this.logger.warn(
        `Order ${orderId} acceptance timeout for driver ${driverId}`,
      );

      // Notify operators
      this.server.to('operators').emit('order:acceptance_timeout', {
        orderId,
        driverId,
        timestamp: new Date().toISOString(),
      });

      // Remove from timeouts map
      this.orderTimeouts.delete(orderId);
    }, this.ACCEPTANCE_TIMEOUT * 1000);

    this.orderTimeouts.set(orderId, timeout);
  }

  private getEligibleDrivers(
    vehicleType: VehicleType,
    pickupLocation: { lat: number; lng: number },
    radius: number,
  ): string[] {
    return Array.from(this.driverSockets.entries())
      .filter(([driverId, driverSocket]) => {
        if (!driverSocket.isActive || driverSocket.currentOrderId) return false;
        if (!driverSocket.location) return false;

        // Check vehicle type compatibility
        if (
          driverSocket.vehicleType &&
          driverSocket.vehicleType !== vehicleType
        ) {
          return false;
        }

        // Check proximity
        const distance = this.calculateDistance(
          driverSocket.location.lat,
          driverSocket.location.lng,
          pickupLocation.lat,
          pickupLocation.lng,
        );

        return distance <= radius;
      })
      .map(([driverId]) => driverId);
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
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

  private transformOrderForEmit(order: any) {
    return {
      ...order,
      baseFare: Number(order.baseFare || 0),
      distanceFare: Number(order.distanceFare || 0),
      totalFare: Number(order.totalFare || 0),
    };
  }

  private getActiveDriversCount(): number {
    return Array.from(this.driverSockets.values()).filter(
      (d) => d.isActive && !d.currentOrderId,
    ).length;
  }

  private getActiveOrdersCount(): number {
    return Array.from(this.driverSockets.values()).filter(
      (d) => d.currentOrderId,
    ).length;
  }

  // Public methods for external services
  getConnectedDriversCount(): number {
    return this.driverSockets.size;
  }

  getConnectedOperatorsCount(): number {
    return this.operatorSockets.size;
  }

  isDriverConnected(driverId: string): boolean {
    return this.driverSockets.has(driverId);
  }

  getDriverLocation(driverId: string) {
    const driverSocket = this.driverSockets.get(driverId);
    return driverSocket?.location || null;
  }

  getSystemHealth() {
    return {
      connectedDrivers: this.driverSockets.size,
      activeDrivers: this.getActiveDriversCount(),
      connectedOperators: this.operatorSockets.size,
      activeOrders: this.getActiveOrdersCount(),
      pendingTimeouts: this.orderTimeouts.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
