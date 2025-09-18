import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Car,
  MapPin,
  Phone,
  Navigation,
  CheckCircle,
  XCircle,
  Clock,
  User,
  DollarSign,
  AlertTriangle,
  Wifi,
  WifiOff,
  Battery,
  Signal,
  Bell,
  MessageCircle,
  Zap,
  History,
  TrendingUp,
  Star,
  Route,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types
interface OrderData {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'DRIVER_ASSIGNED' | 'DRIVER_ACCEPTED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED';
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedFare: number;
  distanceKm: number;
  estimatedDuration: number;
  specialRequests?: string;
  vehicleType: 'MOTORCYCLE' | 'ECONOMY' | 'PREMIUM';
  fleetInfo?: {
    plateNumber: string;
    brand: string;
    model: string;
    color: string;
  };
}

interface DriverStats {
  totalTrips: number;
  completedTrips: number;
  totalEarnings: number;
  todayTrips: number;
  rating: number;
}

interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: string;
}

interface NotificationMessage {
  id: string;
  type: 'order_assignment' | 'system' | 'emergency' | 'operator';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  data?: any;
}

interface TripHistory {
  id: string;
  orderNumber: string;
  date: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  status: string;
  duration: number;
}

const DriverApp: React.FC = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isOnline, setIsOnline] = useState(true);
  
  // Order state
  const [currentOrder, setCurrentOrder] = useState<OrderData | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<OrderData | null>(null);
  const [orderTimeout, setOrderTimeout] = useState<number | null>(null);
  
  // Driver state
  const [driverStats, setDriverStats] = useState<DriverStats>({
    totalTrips: 127,
    completedTrips: 123,
    totalEarnings: 2850000,
    todayTrips: 8,
    rating: 4.8
  });
  
  // Location state
  const [location, setLocation] = useState({ lat: -6.2088, lng: 106.8456 });
  const [battery, setBattery] = useState(85);
  
  // Notification state
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Trip history
  const [tripHistory] = useState<TripHistory[]>([
    {
      id: '1',
      orderNumber: 'TXB-20250902-001',
      date: '2025-09-02T08:30:00Z',
      passengerName: 'Ahmad Rizki',
      pickupAddress: 'Jl. Sudirman No. 45, Pekanbaru',
      dropoffAddress: 'Sultan Syarif Kasim II Airport',
      fare: 125000,
      status: 'COMPLETED',
      duration: 35
    },
    {
      id: '2',
      orderNumber: 'TXB-20250902-002',
      date: '2025-09-02T10:15:00Z',
      passengerName: 'Siti Nurhaliza',
      pickupAddress: 'Mall Pekanbaru',
      dropoffAddress: 'Universitas Riau',
      fare: 45000,
      status: 'COMPLETED',
      duration: 18
    },
    {
      id: '3',
      orderNumber: 'TXB-20250902-003',
      date: '2025-09-02T12:45:00Z',
      passengerName: 'Budi Santoso',
      pickupAddress: 'RS Awal Bros',
      dropoffAddress: 'Pasar Bawah',
      fare: 35000,
      status: 'COMPLETED',
      duration: 15
    }
  ]);
  
  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mock auth token - in real app this would come from auth context
  const authToken = "mock-jwt-token";
  const driverId = "driver-123";

  // Demo: Simulate incoming order
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOnline && isConnected && !currentOrder && !incomingOrder) {
        const mockOrder: OrderData = {
          id: 'order-demo-' + Date.now(),
          orderNumber: 'TXB-20250902-004',
          status: 'DRIVER_ASSIGNED',
          passengerName: 'Maya Sari',
          passengerPhone: '+62 812-3456-7890',
          pickupAddress: 'Jl. Jenderal Sudirman No. 123, Pekanbaru, Riau',
          dropoffAddress: 'Sultan Syarif Kasim II Airport, Pekanbaru',
          pickupLat: -6.2088,
          pickupLng: 106.8456,
          dropoffLat: -6.1754,
          dropoffLng: 106.8352,
          estimatedFare: 150000,
          distanceKm: 25.5,
          estimatedDuration: 40,
          specialRequests: 'Please call when arrived. Passenger has luggage.',
          vehicleType: 'ECONOMY',
          fleetInfo: {
            plateNumber: 'BM 1856 QU',
            brand: 'Toyota',
            model: 'Avanza',
            color: 'Silver'
          }
        };
        handleNewOrderAssignment({ ...mockOrder, timeout: 120 });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isOnline, isConnected, currentOrder, incomingOrder]);

  // WebSocket connection management
  useEffect(() => {
    if (isOnline) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }
    
    return () => {
      disconnectWebSocket();
    };
  }, [isOnline]);

  // Location tracking
  useEffect(() => {
    if (isOnline && isConnected) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    
    return () => stopLocationTracking();
  }, [isOnline, isConnected]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnectionStatus('connecting');
    
    try {
      // Simulate WebSocket connection
      setTimeout(() => {
        setConnectionStatus('connected');
        setIsConnected(true);
        addNotification('Connected to KOPSI system', 'system', 'low');
      }, 2000);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const sendMessage = (event: string, data: any) => {
    console.log('Sending message:', { event, data });
    // In real app, this would send through WebSocket
  };

  const handleNewOrderAssignment = (orderData: any) => {
    const order: OrderData = {
      id: orderData.id || orderData.orderId,
      orderNumber: orderData.orderNumber,
      status: 'DRIVER_ASSIGNED',
      passengerName: orderData.passengerName,
      passengerPhone: orderData.passengerPhone,
      pickupAddress: orderData.pickupAddress,
      dropoffAddress: orderData.dropoffAddress,
      pickupLat: orderData.pickupLat,
      pickupLng: orderData.pickupLng,
      dropoffLat: orderData.dropoffLat,
      dropoffLng: orderData.dropoffLng,
      estimatedFare: orderData.estimatedFare,
      distanceKm: orderData.distanceKm || 0,
      estimatedDuration: orderData.estimatedDuration,
      specialRequests: orderData.specialRequests,
      vehicleType: orderData.vehicleType,
      fleetInfo: orderData.fleetInfo,
    };
    
    setIncomingOrder(order);
    
    // Set timeout countdown
    const timeout = orderData.timeout || 120; // seconds
    setOrderTimeout(timeout);
    
    const countdownInterval = setInterval(() => {
      setOrderTimeout((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          // Auto-reject if not responded
          if (incomingOrder) {
            handleRejectOrder('Timeout - no response');
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    addNotification('New trip assignment received!', 'order_assignment', 'high');
  };

  const startLocationTracking = () => {
    if (locationIntervalRef.current) return;
    
    const updateLocation = () => {
      // In a real app, use navigator.geolocation.getCurrentPosition
      // For demo, simulate small location changes
      const newLat = location.lat + (Math.random() - 0.5) * 0.001;
      const newLng = location.lng + (Math.random() - 0.5) * 0.001;
      
      setLocation({ lat: newLat, lng: newLng });
      
      // Send location update to server
      sendMessage('driver:location_update', {
        lat: newLat,
        lng: newLng,
        accuracy: 10,
        heading: Math.random() * 360,
        speed: currentOrder?.status === 'IN_PROGRESS' ? 30 + Math.random() * 20 : 0,
      });
    };
    
    // Update location immediately and then every 10 seconds
    updateLocation();
    locationIntervalRef.current = setInterval(updateLocation, 10000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const addNotification = (message: string, type: NotificationMessage['type'], priority: 'low' | 'medium' | 'high') => {
    const notification: NotificationMessage = {
      id: Date.now().toString(),
      type,
      title: type === 'order_assignment' ? 'New Trip' : 
             type === 'operator' ? 'Control Center' : 
             type === 'emergency' ? 'Emergency' : 'System',
      message,
      priority,
      timestamp: new Date().toISOString(),
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
    setUnreadCount(prev => prev + 1);
    
    // Auto-remove low priority notifications after 5 seconds
    if (priority === 'low') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Order handling functions
  const handleAcceptOrder = () => {
    if (!incomingOrder) return;
    
    sendMessage('driver:order_response', {
      orderId: incomingOrder.id,
      action: 'accept',
      estimatedArrival: 5,
      location: location,
    });
    
    setCurrentOrder({ ...incomingOrder, status: 'DRIVER_ACCEPTED' });
    setIncomingOrder(null);
    setOrderTimeout(null);
    addNotification('Trip accepted! Heading to pickup location.', 'system', 'medium');
  };

  const handleRejectOrder = (reason?: string) => {
    if (!incomingOrder) return;
    
    sendMessage('driver:order_response', {
      orderId: incomingOrder.id,
      action: 'reject',
      reason: reason || 'Driver declined',
    });
    
    setIncomingOrder(null);
    setOrderTimeout(null);
    addNotification('Trip declined.', 'system', 'low');
  };

  const updateTripStatus = (status: 'arriving' | 'arrived' | 'started' | 'completed', notes?: string) => {
    if (!currentOrder) return;
    
    sendMessage('driver:trip_update', {
      orderId: currentOrder.id,
      status,
      location: location,
      notes,
      odometerReading: status === 'completed' ? Math.floor(Math.random() * 1000) + 50000 : undefined,
    });
    
    // Update local status
    const statusMap = {
      'arriving': 'DRIVER_ARRIVING' as const,
      'arrived': 'DRIVER_ARRIVING' as const,
      'started': 'IN_PROGRESS' as const,
      'completed': 'COMPLETED' as const,
    };
    
    if (status === 'completed') {
      // Trip completed - update stats and clear current order
      setDriverStats(prev => ({
        ...prev,
        completedTrips: prev.completedTrips + 1,
        todayTrips: prev.todayTrips + 1,
        totalEarnings: prev.totalEarnings + (currentOrder?.estimatedFare || 0),
      }));
      
      setTimeout(() => {
        setCurrentOrder(null);
      }, 3000);
      
      addNotification('Trip completed! You are now available for new trips.', 'system', 'medium');
    } else {
      setCurrentOrder(prev => prev ? { ...prev, status: statusMap[status] } : null);
      
      const messages = {
        'arriving': 'Heading to pickup location',
        'arrived': 'Arrived at pickup location',
        'started': 'Trip started - en route to destination',
        'completed': 'Trip completed successfully',
      };
      
      addNotification(messages[status], 'system', 'low');
    }
  };

  const handleEmergency = (type: 'panic' | 'accident' | 'breakdown' | 'medical') => {
    sendMessage('driver:emergency', {
      type,
      location: location,
      message: `Emergency situation: ${type}`,
      orderId: currentOrder?.id,
    });
    
    addNotification(`Emergency alert sent: ${type}`, 'emergency', 'high');
  };

  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    if (newStatus) {
      connectWebSocket();
      addNotification('Going online...', 'system', 'medium');
    } else {
      disconnectWebSocket();
      addNotification('Going offline...', 'system', 'medium');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRIVER_ASSIGNED': return 'bg-blue-500';
      case 'DRIVER_ACCEPTED': return 'bg-green-500';
      case 'DRIVER_ARRIVING': return 'bg-yellow-500';
      case 'IN_PROGRESS': return 'bg-purple-500';
      case 'COMPLETED': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DRIVER_ASSIGNED': return 'Assignment Received';
      case 'DRIVER_ACCEPTED': return 'Accepted - Going to Pickup';
      case 'DRIVER_ARRIVING': return 'At Pickup Location';
      case 'IN_PROGRESS': return 'Trip in Progress';
      case 'COMPLETED': return 'Completed';
      default: return status;
    }
  };

  const getConnectionIcon = () => {
    if (connectionStatus === 'connected') {
      return <Wifi className="w-4 h-4 text-green-600" />;
    } else if (connectionStatus === 'connecting') {
      return <Zap className="w-4 h-4 text-yellow-600 animate-pulse" />;
    } else {
      return <WifiOff className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">KOPSI Driver</h1>
              <p className="text-sm text-gray-500">
                {currentOrder?.fleetInfo?.plateNumber || 'BM 1856 QU'} • Endrizal
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className="flex items-center" title={`Connection: ${connectionStatus}`}>
              {getConnectionIcon()}
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="relative"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </div>
            
            {/* Battery */}
            <div className="flex items-center">
              <Battery className="w-4 h-4 text-gray-600" />
              <span className="text-xs ml-1">{battery}%</span>
            </div>
            
            {/* Online/Offline Toggle */}
            <Button
              onClick={toggleOnlineStatus}
              variant={isOnline ? "default" : "outline"}
              size="sm"
              className={`${
                isOnline 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'border-red-600 text-red-600'
              } ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : (isOnline ? 'Online' : 'Offline')}
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      {notifications.length > 0 && (
        <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
          {notifications.slice(0, 3).map((notification) => (
            <Alert 
              key={notification.id} 
              className={`animate-slide-down ${
                notification.priority === 'high' ? 'border-red-500 bg-red-50' :
                notification.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex justify-between items-start">
                  <div>
                    <strong>{notification.title}:</strong> {notification.message}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Incoming Order Modal */}
      {incomingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md animate-bounce">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">New Trip Assignment!</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-blue-500">{incomingOrder.orderNumber}</Badge>
                  {orderTimeout && (
                    <Badge variant="destructive" className="animate-pulse">
                      {orderTimeout}s
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Passenger</p>
                  <p className="font-semibold">{incomingOrder.passengerName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Estimated Fare</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(incomingOrder.estimatedFare)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Pickup</p>
                    <p className="text-sm text-gray-600 break-words">{incomingOrder.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Destination</p>
                    <p className="text-sm text-gray-600 break-words">{incomingOrder.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="text-center">
                  <p className="text-gray-600">Distance</p>
                  <p className="font-semibold">{incomingOrder.distanceKm.toFixed(1)} km</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Duration</p>
                  <p className="font-semibold">{incomingOrder.estimatedDuration} min</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Type</p>
                  <p className="font-semibold">{incomingOrder.vehicleType}</p>
                </div>
              </div>

              {incomingOrder.specialRequests && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Special Request:</strong> {incomingOrder.specialRequests}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => handleRejectOrder('Driver declined')}
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={handleAcceptOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active">Active Trip</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            {currentOrder ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{currentOrder.orderNumber}</CardTitle>
                    <Badge className={getStatusColor(currentOrder.status)}>
                      {getStatusText(currentOrder.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Passenger Info */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-semibold">{currentOrder.passengerName}</p>
                        <p className="text-sm text-gray-600">{currentOrder.passengerPhone}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Route Info */}
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-green-600 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">Pickup</p>
                        <p className="text-sm text-gray-600">{currentOrder.pickupAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-red-600 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">Destination</p>
                        <p className="text-sm text-gray-600">{currentOrder.dropoffAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Distance</p>
                      <p className="font-semibold">{currentOrder.distanceKm} km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-semibold">{currentOrder.estimatedDuration} min</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Fare</p>
                      <p className="font-semibold">{formatCurrency(currentOrder.estimatedFare)}</p>
                    </div>
                  </div>

                  {/* Special Requests */}
                  {currentOrder.specialRequests && (
                    <Alert>
                      <MessageCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Special Request:</strong> {currentOrder.specialRequests}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {currentOrder.status === 'DRIVER_ACCEPTED' && (
                      <Button
                        onClick={() => updateTripStatus('arriving')}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Arrived at Pickup
                      </Button>
                    )}
                    
                    {currentOrder.status === 'DRIVER_ARRIVING' && (
                      <Button
                        onClick={() => updateTripStatus('started')}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <Car className="w-4 h-4 mr-2" />
                        Start Trip
                      </Button>
                    )}
                    
                    {currentOrder.status === 'IN_PROGRESS' && (
                      <Button
                        onClick={() => updateTripStatus('completed')}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Trip
                      </Button>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" className="flex-1 text-red-600 border-red-600">
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Trip
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 text-orange-600 border-orange-600"
                        onClick={() => handleEmergency('panic')}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Emergency
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Car className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">No active trips</p>
                  <p className="text-sm text-gray-500">
                    {isOnline && isConnected
                      ? 'Waiting for trip assignments...'
                      : isOnline
                      ? 'Connecting to system...'
                      : 'You are currently offline'}
                  </p>
                  {!isOnline && (
                    <Button onClick={toggleOnlineStatus} className="mt-4">
                      Go Online
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="booking" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Create New Order
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Create and assign orders to yourself as a driver
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Car className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Auto-Completion Mode</p>
                        <p className="text-xs text-green-600">
                          Orders created will be automatically marked as COMPLETED
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link href="/driver/booking">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Open Booking Panel
                    </Button>
                  </Link>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      Click above to access the full booking interface with map and location selection
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Trips Today</p>
                      <p className="text-2xl font-bold text-blue-600">{driverStats.todayTrips}</p>
                    </div>
                    <Car className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Today's Earnings</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(driverStats.todayTrips * 87500)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Trips</p>
                      <p className="text-2xl font-bold text-purple-600">{driverStats.completedTrips}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Rating</p>
                      <p className="text-2xl font-bold text-yellow-600">{driverStats.rating}⭐</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Excellent</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Earnings Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Earnings Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Earnings</span>
                    <span className="font-semibold text-lg">
                      {formatCurrency(driverStats.totalEarnings)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Today's Earnings</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(driverStats.todayTrips * 87500)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average per Trip</span>
                    <span className="font-semibold">
                      {formatCurrency(driverStats.totalEarnings / driverStats.completedTrips)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completion Rate</span>
                    <span className="font-semibold text-green-600">
                      {((driverStats.completedTrips / driverStats.totalTrips) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connection Status</span>
                    <Badge 
                      className={
                        connectionStatus === 'connected' ? 'bg-green-500' :
                        connectionStatus === 'connecting' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }
                    >
                      {connectionStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Online Status</span>
                    <Badge className={isOnline ? 'bg-green-500' : 'bg-gray-500'}>
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Location Tracking</span>
                    <Badge className={locationIntervalRef.current ? 'bg-green-500' : 'bg-gray-500'}>
                      {locationIntervalRef.current ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Current Location</span>
                    <span className="text-xs font-mono">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="w-5 h-5 mr-2" />
                  Recent Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tripHistory.map((trip) => (
                    <div key={trip.id} className="border rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{trip.orderNumber}</Badge>
                          <Badge 
                            className={trip.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-500'}
                          >
                            {trip.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(trip.date).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold text-sm">{trip.passengerName}</span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-3 h-3 text-green-600 mt-1 flex-shrink-0" />
                          <span className="text-xs text-gray-600 break-words">
                            {trip.pickupAddress}
                          </span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-3 h-3 text-red-600 mt-1 flex-shrink-0" />
                          <span className="text-xs text-gray-600 break-words">
                            {trip.dropoffAddress}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-600">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {trip.duration} min
                          </span>
                        </div>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(trip.fare)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Load More Button */}
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    Load More Trips
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">This Week</p>
                    <p className="text-xl font-bold text-blue-600">23</p>
                    <p className="text-xs text-gray-500">trips completed</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">This Month</p>
                    <p className="text-xl font-bold text-green-600">89</p>
                    <p className="text-xs text-gray-500">trips completed</p>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Weekly Target</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '76%' }}></div>
                      </div>
                      <span className="text-sm font-semibold">23/30</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Target</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '74%' }}></div>
                      </div>
                      <span className="text-sm font-semibold">89/120</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Emergency Buttons (Quick Access) */}
      {currentOrder && (
        <div className="fixed bottom-4 right-4 flex flex-col space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg border-orange-500 text-orange-600"
            onClick={() => handleEmergency('breakdown')}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Breakdown
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white shadow-lg border-red-500 text-red-600"
            onClick={() => handleEmergency('panic')}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Panic
          </Button>
        </div>
      )}

      {/* Navigation Button */}
      {currentOrder && (
        <div className="fixed bottom-4 left-4">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 shadow-lg"
            onClick={() => {
              // In real app, open Google Maps or Waze
              const destination = currentOrder.status === 'DRIVER_ACCEPTED' || currentOrder.status === 'DRIVER_ARRIVING'
                ? `${currentOrder.pickupLat},${currentOrder.pickupLng}`
                : `${currentOrder.dropoffLat},${currentOrder.dropoffLng}`;
              
              const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
              window.open(url, '_blank');
            }}
          >
            <Route className="w-5 h-5 mr-2" />
            Navigate
          </Button>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-bounce {
          animation: bounce 0.5s ease-out;
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% {
            transform: translateY(0);
          }
          40%, 43% {
            transform: translateY(-10px);
          }
          70% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </div>
  );
};

export default DriverApp;