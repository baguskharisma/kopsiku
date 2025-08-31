import { useEffect, useState, useRef } from 'react';
import { websocketService, OrderNotification, DriverLocation } from '@/lib/websocket-service';
import { toast } from 'sonner';

export interface RealtimeNotification {
  id: string;
  type: 'order' | 'driver' | 'system';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read?: boolean;
}

export interface UseRealtimeNotificationsOptions {
  userRole: 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER' | 'CUSTOMER';
  userId: string;
  enableToasts?: boolean;
  enableSounds?: boolean;
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [connectedDrivers, setConnectedDrivers] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map<string, DriverLocation>());

  const soundRef = useRef<HTMLAudioElement | null>(null);
  const { userRole, userId, enableToasts = true, enableSounds = true } = options;

  useEffect(() => {
    // Initialize audio for notifications
    if (enableSounds && typeof window !== 'undefined') {
      soundRef.current = new Audio('/notification.mp3');
      soundRef.current.volume = 0.5;
    }
  }, [enableSounds]);

  useEffect(() => {
    // Authenticate with WebSocket
    websocketService.authenticate(userRole, userId);

    // Monitor connection status
    const checkConnection = () => {
      setIsConnected(websocketService.isSocketConnected());
    };

    const connectionInterval = setInterval(checkConnection, 5000);
    checkConnection(); // Initial check

    return () => {
      clearInterval(connectionInterval);
    };
  }, [userRole, userId]);

  // Add notification helper
  const addNotification = (notification: Omit<RealtimeNotification, 'id'>) => {
    const newNotification: RealtimeNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Keep only last 50

    // Show toast notification
    if (enableToasts) {
      toast.info(notification.title, {
        description: notification.message,
        duration: 5000,
      });
    }

    // Play sound
    if (enableSounds && soundRef.current) {
      soundRef.current.play().catch(console.warn);
    }
  };

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Order events for operators
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      // New order created
      unsubscribers.push(
        websocketService.on('order.created', (data: OrderNotification) => {
          addNotification({
            type: 'order',
            title: 'New Order Created',
            message: `Order ${data.data.orderNumber} from ${data.data.pickupAddress}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Order assigned to driver
      unsubscribers.push(
        websocketService.on('order.assigned', (data: OrderNotification) => {
          addNotification({
            type: 'order',
            title: 'Order Assigned',
            message: `${data.data.orderNumber} assigned to ${data.data.driver?.name}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Order status changed
      unsubscribers.push(
        websocketService.on('order.status.changed', (data: OrderNotification) => {
          addNotification({
            type: 'order',
            title: 'Order Status Updated',
            message: `${data.data.orderNumber}: ${data.data.status}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Driver status changes
      unsubscribers.push(
        websocketService.on('driver.status.changed', (data: any) => {
          addNotification({
            type: 'driver',
            title: 'Driver Status Changed',
            message: `Driver status: ${data.data.status}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Driver location updates
      unsubscribers.push(
        websocketService.on('driver:location_updated', (data: DriverLocation) => {
          setDriverLocations(prev => {
            const updated = new Map(prev);
            updated.set(data.driverId, data);
            return updated;
          });
        })
      );

      // Active drivers list
      unsubscribers.push(
        websocketService.on('active_drivers_list', (data: any) => {
          setConnectedDrivers(data.count);
          
          // Update driver locations
          const locationMap = new Map<string, DriverLocation>();
          data.drivers.forEach((driver: any) => {
            if (driver.location) {
              locationMap.set(driver.driverId, {
                driverId: driver.driverId,
                location: driver.location,
                timestamp: data.timestamp,
              });
            }
          });
          setDriverLocations(locationMap);
        })
      );

      // Request active drivers on connect
      if (websocketService.isSocketConnected()) {
        websocketService.getActiveDrivers();
      }
    }

    // Driver-specific events
    if (userRole === 'DRIVER') {
      // New order assignment
      unsubscribers.push(
        websocketService.on('order.new_assignment', (data: OrderNotification) => {
          addNotification({
            type: 'order',
            title: 'New Trip Assignment',
            message: `${data.data.pickupAddress} → ${data.data.dropoffAddress}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Available orders (for manual assignment)
      unsubscribers.push(
        websocketService.on('order.available', (data: OrderNotification) => {
          addNotification({
            type: 'order',
            title: 'Trip Available',
            message: `${data.data.pickupAddress} → ${data.data.dropoffAddress}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // Driver status updates
      unsubscribers.push(
        websocketService.on('driver.status.updated', (data: any) => {
          addNotification({
            type: 'system',
            title: 'Status Updated',
            message: `Your status: ${data.data.status}`,
            data: data.data,
            timestamp: data.timestamp,
          });
        })
      );

      // General notifications
      unsubscribers.push(
        websocketService.on('notification', (data: any) => {
          addNotification({
            type: data.type || 'system',
            title: data.title,
            message: data.message,
            data: data.data,
            timestamp: new Date().toISOString(),
          });
        })
      );
    }

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [userRole, enableToasts, enableSounds]);

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Driver utilities (for driver role)
  const updateLocation = (lat: number, lng: number) => {
    if (userRole === 'DRIVER') {
      websocketService.updateDriverLocation(lat, lng);
    }
  };

  const updateDriverStatus = (status: string) => {
    if (userRole === 'DRIVER') {
      websocketService.updateDriverStatus(status);
    }
  };

  // Operator utilities
  const refreshDriverLocations = () => {
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      websocketService.getActiveDrivers();
    }
  };

  return {
    // Notifications
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
    
    // Connection status
    isConnected,
    connectedDrivers,
    
    // Driver locations (for operators)
    driverLocations: Array.from(driverLocations.values()),
    refreshDriverLocations,
    
    // Driver utilities
    updateLocation,
    updateDriverStatus,
  };
}