import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OrderStatus, DriverStatus } from '@prisma/client';

interface DriverSocket {
  socket: Socket;
  driverId: string;
  isActive: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('OrdersGateway');
  private driverSockets = new Map<string, DriverSocket>(); // driverId -> socket info
  private operatorSockets = new Set<Socket>(); // operator/admin sockets

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Listen for authentication
    client.on('authenticate', (data: { role: string; userId: string }) => {
      if (data.role === 'DRIVER') {
        this.driverSockets.set(data.userId, {
          socket: client,
          driverId: data.userId,
          isActive: true,
        });
        client.join(`driver:${data.userId}`);
        this.logger.log(`Driver ${data.userId} authenticated and joined room`);
      } else if (data.role === 'ADMIN' || data.role === 'SUPER_ADMIN') {
        this.operatorSockets.add(client);
        client.join('operators');
        this.logger.log(`Operator ${data.userId} authenticated and joined operators room`);
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove from driver sockets
    for (const [driverId, driverSocket] of this.driverSockets.entries()) {
      if (driverSocket.socket.id === client.id) {
        this.driverSockets.delete(driverId);
        this.logger.log(`Driver ${driverId} disconnected`);
        break;
      }
    }

    // Remove from operator sockets
    this.operatorSockets.delete(client);
  }

  @SubscribeMessage('driver:location_update')
  handleDriverLocationUpdate(
    @MessageBody() data: { lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    // Find driver by socket
    for (const [driverId, driverSocket] of this.driverSockets.entries()) {
      if (driverSocket.socket.id === client.id) {
        driverSocket.location = { lat: data.lat, lng: data.lng };
        
        // Broadcast location update to operators
        this.server.to('operators').emit('driver:location_updated', {
          driverId,
          location: data,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  @SubscribeMessage('driver:status_change')
  handleDriverStatusChange(
    @MessageBody() data: { status: DriverStatus },
    @ConnectedSocket() client: Socket,
  ) {
    for (const [driverId, driverSocket] of this.driverSockets.entries()) {
      if (driverSocket.socket.id === client.id) {
        driverSocket.isActive = data.status === DriverStatus.ACTIVE;
        
        // Notify operators
        this.server.to('operators').emit('driver:status_changed', {
          driverId,
          status: data.status,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  // Order events
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
    this.server.to(`driver:${order.driverId}`).emit('order.assignment', orderData);

    this.logger.log(`Order assigned event emitted: ${order.orderNumber} -> ${order.driver.name}`);
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

  // New methods for driver notifications
  notifyDriverAssignment(driverId: string, order: any) {
    const notificationData = {
      event: 'new_order_assignment',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        passengerName: order.passengerName,
        passengerPhone: order.passengerPhone,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        estimatedFare: Number(order.totalFare),
        estimatedDuration: order.estimatedDurationMinutes,
        specialRequests: order.specialRequests,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to specific driver
    this.server.to(`driver:${driverId}`).emit('order.new_assignment', notificationData);
    
    // Also send push-style notification
    this.server.to(`driver:${driverId}`).emit('notification', {
      type: 'order_assignment',
      title: 'New Trip Assignment',
      message: `You have been assigned a trip from ${order.pickupAddress} to ${order.dropoffAddress}`,
      data: notificationData.data,
    });

    this.logger.log(`Driver assignment notification sent to: ${driverId}`);
  }

  notifyAvailableDrivers(order: any) {
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
      },
      timestamp: new Date().toISOString(),
    };

    // Notify all active drivers of matching vehicle type
    for (const [driverId, driverSocket] of this.driverSockets.entries()) {
      if (driverSocket.isActive) {
        driverSocket.socket.emit('order.available', notificationData);
      }
    }

    this.logger.log(`New order broadcast to available drivers: ${order.orderNumber}`);
  }

  // Utility method to get connected drivers count
  getConnectedDriversCount(): number {
    return Array.from(this.driverSockets.values()).filter(d => d.isActive).length;
  }

  // Utility method to get connected operators count  
  getConnectedOperatorsCount(): number {
    return this.operatorSockets.size;
  }

  // Method for operators to get real-time driver locations
  @SubscribeMessage('get_active_drivers')
  handleGetActiveDrivers(@ConnectedSocket() client: Socket) {
    if (!this.operatorSockets.has(client)) {
      return { error: 'Unauthorized' };
    }

    const activeDrivers = Array.from(this.driverSockets.entries())
      .filter(([_, driverSocket]) => driverSocket.isActive)
      .map(([driverId, driverSocket]) => ({
        driverId,
        location: driverSocket.location,
        isOnline: true,
      }));

    client.emit('active_drivers_list', {
      drivers: activeDrivers,
      count: activeDrivers.length,
      timestamp: new Date().toISOString(),
    });
  }
}