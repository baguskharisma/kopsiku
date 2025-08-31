import { io, Socket } from 'socket.io-client';

export interface OrderNotification {
  event: string;
  data: any;
  timestamp: string;
}

export interface DriverLocation {
  driverId: string;
  location: {
    lat: number;
    lng: number;
  };
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private userRole: string | null = null;
  private userId: string | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.socket?.connected) {
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    this.socket = io(`${backendUrl}/orders`, {
      transports: ['websocket'],
      upgrade: false,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      
      // Authenticate if user info available
      if (this.userRole && this.userId) {
        this.authenticate(this.userRole, this.userId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error: unknown) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
    });

    // Set up automatic event forwarding
    this.setupEventForwarding();
  }

  authenticate(role: string, userId: string) {
    this.userRole = role;
    this.userId = userId;
    
    if (this.socket?.connected) {
      this.socket.emit('authenticate', { role, userId });
      console.log(`Authenticated as ${role} with ID ${userId}`);
    }
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    // Order events for operators
    this.socket.on('order.created', (data: OrderNotification) => {
      this.emit('order.created', data);
    });

    this.socket.on('order.assigned', (data: OrderNotification) => {
      this.emit('order.assigned', data);
    });

    this.socket.on('order.status.updated', (data: OrderNotification) => {
      this.emit('order.status.updated', data);
    });

    this.socket.on('order.status.changed', (data: OrderNotification) => {
      this.emit('order.status.changed', data);
    });

    // Driver-specific events
    this.socket.on('order.new_assignment', (data: OrderNotification) => {
      this.emit('order.new_assignment', data);
    });

    this.socket.on('order.available', (data: OrderNotification) => {
      this.emit('order.available', data);
    });

    this.socket.on('notification', (data: any) => {
      this.emit('notification', data);
    });

    // Driver status events
    this.socket.on('driver.status.changed', (data: any) => {
      this.emit('driver.status.changed', data);
    });

    this.socket.on('driver.status.updated', (data: any) => {
      this.emit('driver.status.updated', data);
    });

    // Driver location events
    this.socket.on('driver:location_updated', (data: DriverLocation) => {
      this.emit('driver:location_updated', data);
    });

    this.socket.on('active_drivers_list', (data: any) => {
      this.emit('active_drivers_list', data);
    });
  }

  // Event emitter methods
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Driver location updates
  updateDriverLocation(lat: number, lng: number) {
    if (this.socket?.connected && this.userRole === 'DRIVER') {
      this.socket.emit('driver:location_update', { lat, lng });
    }
  }

  // Driver status updates
  updateDriverStatus(status: string) {
    if (this.socket?.connected && this.userRole === 'DRIVER') {
      this.socket.emit('driver:status_change', { status });
    }
  }

  // Get active drivers (for operators)
  getActiveDrivers() {
    if (this.socket?.connected && (this.userRole === 'ADMIN' || this.userRole === 'SUPER_ADMIN')) {
      this.socket.emit('get_active_drivers');
    }
  }

  // Connection status
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  // Reconnect
  reconnect() {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
}

// Singleton instance
export const websocketService = new WebSocketService();