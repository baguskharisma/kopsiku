import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface UseRealtimeNotificationsProps {
  userRole: 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER';
  userId: string;
  enableToasts?: boolean;
  enableSounds?: boolean;
  autoReconnect?: boolean;
}

interface DriverLocation {
  driverId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  timestamp: string;
}

interface OrderNotification {
  event: string;
  data: any;
  timestamp: string;
}

interface SystemStatus {
  connectedDrivers: number;
  connectedOperators: number;
  timestamp: string;
}

export const useRealtimeNotifications = ({
  userRole,
  userId,
  enableToasts = true,
  enableSounds = true,
  autoReconnect = true,
}: UseRealtimeNotificationsProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDrivers, setConnectedDrivers] = useState(0);
  const [connectedOperators, setConnectedOperators] = useState(0);
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const playNotificationSound = useCallback(() => {
    if (!enableSounds) return;
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, [enableSounds]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (!enableToasts) return;
    
    const toastFunction = toast[type] || toast;
    toastFunction(title, {
      description: message,
      duration: 5000,
    });
  }, [enableToasts]);

  const connect = useCallback(() => {
    if (socket?.connected) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    
    if (!token) {
      setConnectionError('Authentication token not found');
      return;
    }

    const newSocket = io(`${backendUrl}/orders`, {
      auth: { token },
      query: { userId, role: userRole },
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
      // Authenticate after connection
      newSocket.emit('authenticate', { role: userRole, userId });
      
      showToast('Connected', 'Successfully connected to KOPSI system', 'success');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
      showToast('Disconnected', 'Connection to server lost', 'warning');
      
      // Auto-reconnect if not manually disconnected
      if (autoReconnect && reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          console.log(`🔄 Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          newSocket.connect();
        }, delay);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // System status events
    newSocket.on('system:status', (data: SystemStatus) => {
      setConnectedDrivers(data.connectedDrivers);
      setConnectedOperators(data.connectedOperators);
    });

    // Driver-specific events for operators
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      newSocket.on('driver:connected', (data) => {
        showToast('Driver Online', `Driver ${data.driverId} is now online`, 'info');
        setConnectedDrivers(prev => prev + 1);
      });

      newSocket.on('driver:disconnected', (data) => {
        showToast('Driver Offline', `Driver ${data.driverId} went offline`, 'warning');
        setConnectedDrivers(prev => Math.max(0, prev - 1));
      });

      newSocket.on('driver:location_updated', (data: DriverLocation) => {
        setDriverLocations(prev => new Map(prev.set(data.driverId, data)));
      });

      newSocket.on('driver:status_changed', (data) => {
        showToast('Driver Status Changed', `Driver ${data.driverId} is now ${data.status.toLowerCase()}`, 'info');
      });

      // Order events for operators
      newSocket.on('order.created', (data: OrderNotification) => {
        playNotificationSound();
        showToast('New Order', `Order ${data.data.orderNumber} created`, 'info');
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
      });

      newSocket.on('order.assigned', (data: OrderNotification) => {
        showToast('Order Assigned', `Order ${data.data.orderNumber} assigned to driver`, 'success');
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
      });

      newSocket.on('order.status.changed', (data: OrderNotification) => {
        showToast('Order Status Updated', `Order ${data.data.orderNumber} is now ${data.data.status}`, 'info');
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
      });

      newSocket.on('order:driver_accepted', (data) => {
        playNotificationSound();
        showToast('Order Accepted', `Driver accepted order ${data.orderId}`, 'success');
      });

      newSocket.on('order:driver_rejected', (data) => {
        showToast('Order Rejected', `Driver rejected order ${data.orderId}: ${data.reason}`, 'warning');
      });

      newSocket.on('order:trip_status_updated', (data) => {
        showToast('Trip Update', `Order ${data.orderId} status: ${data.status}`, 'info');
      });
    }

    // Driver-specific events
    if (userRole === 'DRIVER') {
      newSocket.on('driver:welcome', (data) => {
        showToast('Welcome', data.message, 'success');
      });

      newSocket.on('order.new_assignment', (data: OrderNotification) => {
        playNotificationSound();
        showToast('New Assignment', `You have a new trip assignment!`, 'info');
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
      });

      newSocket.on('order.available', (data: OrderNotification) => {
        playNotificationSound();
        showToast('New Order Available', 'A new order is available nearby', 'info');
        setNotifications(prev => [data, ...prev.slice(0, 9)]);
      });

      newSocket.on('notification', (data) => {
        playNotificationSound();
        showToast(data.title, data.message, data.priority === 'high' ? 'warning' : 'info');
      });

      newSocket.on('operator:message', (data) => {
        playNotificationSound();
        showToast('Message from Operator', data.message, data.priority === 'high' ? 'warning' : 'info');
      });

      newSocket.on('driver:location_acknowledged', (data) => {
        console.log('📍 Location update acknowledged:', data);
      });

      newSocket.on('driver:status_acknowledged', (data) => {
        console.log('🔄 Status change acknowledged:', data);
      });

      newSocket.on('order:acceptance_confirmed', (data) => {
        showToast('Order Accepted', data.message, 'success');
      });

      newSocket.on('order:rejection_confirmed', (data) => {
        showToast('Order Rejected', data.message, 'info');
      });

      newSocket.on('order:status_update_confirmed', (data) => {
        showToast('Status Updated', `Trip status updated to: ${data.status}`, 'success');
      });
    }

    // Error handling
    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      showToast('Error', error.message || 'An error occurred', 'error');
    });

    setSocket(newSocket);
    
    return newSocket;
  }, [userRole, userId, autoReconnect, enableToasts, enableSounds, playNotificationSound, showToast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setIsConnected(false);
    setConnectedDrivers(0);
    setConnectedOperators(0);
    setDriverLocations(new Map());
    setNotifications([]);
  }, [socket]);

  // Driver-specific functions
  const updateDriverLocation = useCallback((location: { lat: number; lng: number; accuracy?: number }) => {
    if (socket && userRole === 'DRIVER') {
      socket.emit('driver:location_update', location);
    }
  }, [socket, userRole]);

  const updateDriverStatus = useCallback((status: string) => {
    if (socket && userRole === 'DRIVER') {
      socket.emit('driver:status_change', { status });
    }
  }, [socket, userRole]);

  const acceptOrder = useCallback((orderId: string, estimatedArrival?: number) => {
    if (socket && userRole === 'DRIVER') {
      socket.emit('driver:accept_order', { orderId, estimatedArrival });
    }
  }, [socket, userRole]);

  const rejectOrder = useCallback((orderId: string, reason?: string) => {
    if (socket && userRole === 'DRIVER') {
      socket.emit('driver:reject_order', { orderId, reason });
    }
  }, [socket, userRole]);

  const updateTripStatus = useCallback((orderId: string, status: 'arrived' | 'started' | 'completed', location?: { lat: number; lng: number }) => {
    if (socket && userRole === 'DRIVER') {
      socket.emit('driver:update_trip_status', { orderId, status, location });
    }
  }, [socket, userRole]);

  // Operator-specific functions
  const refreshDriverLocations = useCallback(() => {
    if (socket && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      socket.emit('get_active_drivers');
    }
  }, [socket, userRole]);

  const broadcastMessage = useCallback((message: string, targetDrivers?: string[], priority?: 'low' | 'medium' | 'high') => {
    if (socket && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      socket.emit('operator:broadcast_message', { message, targetDrivers, priority });
    }
  }, [socket, userRole]);

  // Initialize connection
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, []);

  return {
    // Connection state
    isConnected,
    connectionError,
    socket,
    
    // System stats
    connectedDrivers,
    connectedOperators,
    driverLocations: Array.from(driverLocations.values()),
    notifications,
    
    // Connection control
    connect,
    disconnect,
    
    // Driver functions
    updateDriverLocation,
    updateDriverStatus,
    acceptOrder,
    rejectOrder,
    updateTripStatus,
    
    // Operator functions
    refreshDriverLocations,
    broadcastMessage,
    
    // Utility functions
    clearNotifications: () => setNotifications([]),
    playNotificationSound,
  };
};

// Hook untuk driver location tracking dengan geolocation
export const useDriverLocationTracking = () => {
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setLocationError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // Cache location for 1 minute
    };

    const successCallback = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
      setLocationError(null);
    };

    const errorCallback = (error: GeolocationPositionError) => {
      let errorMessage = 'Unknown location error';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }
      
      setLocationError(errorMessage);
      console.error('Location error:', errorMessage);
    };

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      options
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    currentLocation,
    locationError,
    isTracking,
    startTracking,
    stopTracking,
  };
};

// Hook untuk order management (driver)
export const useDriverOrderManagement = (driverId: string) => {
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActiveOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/orders/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(data.data);
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrderHistory = useCallback(async (limit: number = 10) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/orders/my-orders?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrderHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching order history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: string, additionalData?: any) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          status,
          reason: additionalData?.reason || `Status updated to ${status}`,
          metadata: additionalData?.metadata,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(data.data);
        return data;
      } else {
        throw new Error('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }, []);

  const acceptOrder = useCallback(async (orderId: string, estimatedArrival?: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ estimatedArrival }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(data.data);
        return data;
      } else {
        throw new Error('Failed to accept order');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      throw error;
    }
  }, []);

  const completeTrip = useCallback(async (orderId: string, finalData?: any) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(finalData),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(null); // Clear active order after completion
        return data;
      } else {
        throw new Error('Failed to complete trip');
      }
    } catch (error) {
      console.error('Error completing trip:', error);
      throw error;
    }
  }, []);

  const cancelOrder = useCallback(async (orderId: string, reason: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ reason }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveOrder(null); // Clear active order after cancellation
        return data;
      } else {
        throw new Error('Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    fetchActiveOrder();
    fetchOrderHistory();
  }, [fetchActiveOrder, fetchOrderHistory]);

  return {
    activeOrder,
    orderHistory,
    isLoading,
    fetchActiveOrder,
    fetchOrderHistory,
    updateOrderStatus,
    acceptOrder,
    completeTrip,
    cancelOrder,
  };
};

// Hook untuk operator dashboard management
export const useOperatorDashboard = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 20,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        page: filters.page.toString(),
        limit: filters.limit.toString(),
      });

      // Remove empty values
      Object.keys(filters).forEach(key => {
        if (!filters[key as keyof typeof filters]) {
          queryParams.delete(key);
        }
      });

      const response = await fetch(`/api/orders?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.data);
        setTotalOrders(data.meta.total);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.set('dateTo', filters.dateTo);

      const response = await fetch(`/api/orders/stats/dashboard?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, [filters.dateFrom, filters.dateTo]);

  const assignDriverToOrder = useCallback(async (orderId: string, driverId: string, fleetId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          driverId,
          fleetId,
          reason: reason || 'Manual assignment by operator',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Refresh orders list
        await fetchOrders();
        return data;
      } else {
        throw new Error('Failed to assign driver');
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      throw error;
    }
  }, [fetchOrders]);

  const bulkAssignOrders = useCallback(async (assignments: Array<{
    orderId: string;
    driverId: string;
    fleetId: string;
    reason?: string;
  }>) => {
    try {
      const response = await fetch(`/api/orders/bulk-assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ assignments }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Refresh orders list
        await fetchOrders();
        return data;
      } else {
        throw new Error('Failed to bulk assign orders');
      }
    } catch (error) {
      console.error('Error bulk assigning orders:', error);
      throw error;
    }
  }, [fetchOrders]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 })); // Reset to page 1 when filters change
  }, []);

  const nextPage = useCallback(() => {
    setFilters(prev => ({ ...prev, page: prev.page + 1 }));
  }, []);

  const previousPage = useCallback(() => {
    setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  }, []);

  // Initialize data and refresh when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  return {
    // Data
    orders,
    stats,
    totalOrders,
    isLoading,
    
    // Filters
    filters,
    updateFilters,
    
    // Pagination
    nextPage,
    previousPage,
    hasNextPage: filters.page * filters.limit < totalOrders,
    hasPreviousPage: filters.page > 1,
    
    // Actions
    fetchOrders,
    fetchDashboardStats,
    assignDriverToOrder,
    bulkAssignOrders,
    
    // Utilities
    refresh: () => {
      fetchOrders();
      fetchDashboardStats();
    },
  };
};

// Hook untuk driver performance tracking
export const useDriverPerformance = (driverId?: string) => {
  const [performance, setPerformance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPerformance = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.set('dateFrom', dateFrom);
      if (dateTo) queryParams.set('dateTo', dateTo);

      const endpoint = driverId ? `/api/orders/stats/driver` : `/api/orders/stats/driver`;
      const response = await fetch(`${endpoint}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPerformance(data.data);
      }
    } catch (error) {
      console.error('Error fetching driver performance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return {
    performance,
    isLoading,
    fetchPerformance,
    refresh: fetchPerformance,
  };
};

// Utility hook for formatting and calculations
export const useOrderUtils = () => {
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatDistance = useCallback((meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }, []);

  const formatDuration = useCallback((minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  }, []);

  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-500',
      DRIVER_ASSIGNED: 'bg-blue-500',
      DRIVER_ACCEPTED: 'bg-green-500',
      DRIVER_ARRIVING: 'bg-orange-500',
      IN_PROGRESS: 'bg-purple-500',
      COMPLETED: 'bg-green-600',
      CANCELLED_BY_CUSTOMER: 'bg-red-500',
      CANCELLED_BY_DRIVER: 'bg-red-500',
      CANCELLED_BY_SYSTEM: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  }, []);

  const getStatusText = useCallback((status: string) => {
    const texts: Record<string, string> = {
      PENDING: 'Menunggu Driver',
      DRIVER_ASSIGNED: 'Driver Ditugaskan',
      DRIVER_ACCEPTED: 'Driver Menerima',
      DRIVER_ARRIVING: 'Driver Menuju Pickup',
      IN_PROGRESS: 'Dalam Perjalanan',
      COMPLETED: 'Selesai',
      CANCELLED_BY_CUSTOMER: 'Dibatalkan Penumpang',
      CANCELLED_BY_DRIVER: 'Dibatalkan Driver',
      CANCELLED_BY_SYSTEM: 'Dibatalkan Sistem',
    };
    return texts[status] || status;
  }, []);

  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }, []);

  return {
    formatCurrency,
    formatDistance,
    formatDuration,
    getStatusColor,
    getStatusText,
    calculateDistance,
  };
};