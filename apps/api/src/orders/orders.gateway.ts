import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger } from '@nestjs/common';
  import { OrderStatus, DriverStatus } from '@prisma/client';
  
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
  
    handleConnection(client: Socket) {
      this.logger.log(`Client connected: ${client.id}`);
    }
  
    handleDisconnect(client: Socket) {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  
    emitOrderCreated(order: any) {
      this.server.emit('order.created', {
        event: 'order.created',
        data: order,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Order created event emitted: ${order.orderNumber}`);
    }
  
    emitOrderAssigned(order: any) {
      this.server.emit('order.assigned', {
        event: 'order.assigned',
        data: order,
        timestamp: new Date().toISOString(),
      });
  
      // Send to specific driver
      this.server.to(`driver:${order.driverId}`).emit('order.assignment', {
        event: 'order.assignment',
        data: order,
        timestamp: new Date().toISOString(),
      });
  
      this.logger.log(`Order assigned event emitted: ${order.orderNumber} -> ${order.driver.name}`);
    }
  
    emitOrderStatusUpdated(order: any) {
      this.server.emit('order.status.updated', {
        event: 'order.status.updated',
        data: order,
        timestamp: new Date().toISOString(),
      });
  
      // Send to operator room
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
      this.server.emit('driver.status.changed', {
        event: 'driver.status.changed',
        data: {
          driverId,
          status,
        },
        timestamp: new Date().toISOString(),
      });
  
      this.logger.log(`Driver status changed: ${driverId} -> ${status}`);
    }
  }