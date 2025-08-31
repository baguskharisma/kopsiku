import React, { useState, useEffect, useRef } from 'react';
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
  Signal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data for demonstration
interface OrderData {
  id: string;
  orderNumber: string;
  status: 'DRIVER_ASSIGNED' | 'DRIVER_ACCEPTED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED';
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
}

interface DriverStats {
  totalTrips: number;
  completedTrips: number;
  totalEarnings: number;
  todayTrips: number;
  rating: number;
}

const DriverApp: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderData | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<OrderData | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats>({
    totalTrips: 127,
    completedTrips: 123,
    totalEarnings: 2850000,
    todayTrips: 8,
    rating: 4.8
  });
  const [location, setLocation] = useState({ lat: -6.2088, lng: 106.8456 });
  const [battery, setBattery] = useState(85);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Mock WebSocket connection simulation
  useEffect(() => {
    // Simulate connection
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 1000);

    // Simulate incoming order
    const orderTimer = setTimeout(() => {
      if (isOnline && !currentOrder) {
        const mockOrder: OrderData = {
          id: 'order-123',
          orderNumber: 'TXB-20241201-001',
          status: 'DRIVER_ASSIGNED',
          passengerName: 'Budi Santoso',
          passengerPhone: '+628123456789',
          pickupAddress: 'Bandara Sultan Syarif Kasim II - Terminal Domestik',
          dropoffAddress: 'Jl. Sudirman No. 123, Pekanbaru',
          pickupLat: -6.2088,
          pickupLng: 106.8456,
          dropoffLat: -6.2297,
          dropoffLng: 106.8251,
          estimatedFare: 75000,
          distanceKm: 24.8,
          estimatedDuration: 35,
          specialRequests: 'Mohon tunggu di zona pickup A3',
          vehicleType: 'ECONOMY'
        };
        setIncomingOrder(mockOrder);
        addNotification('Pesanan baru diterima!');
      }
    }, 3000);

    return () => {
      clearTimeout(connectTimer);
      clearTimeout(orderTimer);
    };
  }, [isOnline, currentOrder]);

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1));
    }, 5000);
  };

  const acceptOrder = () => {
    if (incomingOrder) {
      setCurrentOrder({ ...incomingOrder, status: 'DRIVER_ACCEPTED' });
      setIncomingOrder(null);
      addNotification('Pesanan diterima! Menuju ke lokasi pickup.');
    }
  };

  const rejectOrder = () => {
    setIncomingOrder(null);
    addNotification('Pesanan ditolak.');
  };

  const updateOrderStatus = (newStatus: OrderData['status']) => {
    if (currentOrder) {
      setCurrentOrder({ ...currentOrder, status: newStatus });
      
      const statusMessages = {
        'DRIVER_ARRIVING': 'Tiba di lokasi pickup',
        'IN_PROGRESS': 'Perjalanan dimulai',
        'COMPLETED': 'Perjalanan selesai!'
      } as const;

      if (Object.prototype.hasOwnProperty.call(statusMessages, newStatus)) {
        addNotification(statusMessages[newStatus as keyof typeof statusMessages]);
      }

      if (newStatus === 'COMPLETED') {
        setTimeout(() => {
          setCurrentOrder(null);
          setDriverStats(prev => ({
            ...prev,
            completedTrips: prev.completedTrips + 1,
            todayTrips: prev.todayTrips + 1,
            totalEarnings: prev.totalEarnings + (currentOrder?.estimatedFare || 0)
          }));
        }, 2000);
      }
    }
  };

  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
    addNotification(isOnline ? 'Anda sekarang offline' : 'Anda sekarang online');
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
      case 'DRIVER_ASSIGNED': return 'Pesanan Masuk';
      case 'DRIVER_ACCEPTED': return 'Menuju Pickup';
      case 'DRIVER_ARRIVING': return 'Tiba di Pickup';
      case 'IN_PROGRESS': return 'Dalam Perjalanan';
      case 'COMPLETED': return 'Selesai';
      default: return status;
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
              <p className="text-sm text-gray-500">BM 1856 QU • Endrizal</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className="flex items-center">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600" />
              )}
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
              className={`${isOnline ? 'bg-green-600 hover:bg-green-700' : 'border-red-600 text-red-600'}`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="p-4 space-y-2">
          {notifications.map((notification, index) => (
            <Alert key={index} className="animate-slide-down">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{notification}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Incoming Order Modal */}
      {incomingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md animate-bounce">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="text-lg">Pesanan Baru!</span>
                <Badge className="bg-blue-500">{incomingOrder.orderNumber}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Penumpang</p>
                  <p className="font-semibold">{incomingOrder.passengerName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Estimasi</p>
                  <p className="font-semibold">{formatCurrency(incomingOrder.estimatedFare)}</p>
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
                    <p className="text-sm font-medium">Tujuan</p>
                    <p className="text-sm text-gray-600 break-words">{incomingOrder.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              {incomingOrder.specialRequests && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {incomingOrder.specialRequests}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={rejectOrder}
                  variant="outline"
                  className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Tolak
                </Button>
                <Button
                  onClick={acceptOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Terima
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Pesanan Aktif</TabsTrigger>
            <TabsTrigger value="stats">Statistik</TabsTrigger>
            <TabsTrigger value="history">Riwayat</TabsTrigger>
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
                        <p className="font-medium">Tujuan</p>
                        <p className="text-sm text-gray-600">{currentOrder.dropoffAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Jarak</p>
                      <p className="font-semibold">{currentOrder.distanceKm} km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Waktu</p>
                      <p className="font-semibold">{currentOrder.estimatedDuration} min</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Tarif</p>
                      <p className="font-semibold">{formatCurrency(currentOrder.estimatedFare)}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {currentOrder.status === 'DRIVER_ACCEPTED' && (
                      <Button
                        onClick={() => updateOrderStatus('DRIVER_ARRIVING')}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Tiba di Pickup
                      </Button>
                    )}
                    
                    {currentOrder.status === 'DRIVER_ARRIVING' && (
                      <Button
                        onClick={() => updateOrderStatus('IN_PROGRESS')}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <Car className="w-4 h-4 mr-2" />
                        Mulai Perjalanan
                      </Button>
                    )}
                    
                    {currentOrder.status === 'IN_PROGRESS' && (
                      <Button
                        onClick={() => updateOrderStatus('COMPLETED')}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Selesaikan Perjalanan
                      </Button>
                    )}

                    <Button variant="outline" className="w-full text-red-600 border-red-600">
                      <XCircle className="w-4 h-4 mr-2" />
                      Batalkan Pesanan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Car className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">Tidak ada pesanan aktif</p>
                  <p className="text-sm text-gray-500">
                    {isOnline ? 'Menunggu pesanan masuk...' : 'Anda sedang offline'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Trip Hari Ini</p>
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
                      <p className="text-sm text-gray-600">Pendapatan Hari Ini</p>
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
                      <p className="text-sm text-gray-600">Total Trip</p>
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
                <CardTitle>Ringkasan Pendapatan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Total Pendapatan</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(driverStats.totalEarnings)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rata-rata per Trip</span>
                    <span className="font-semibold">
                      {formatCurrency(Math.round(driverStats.totalEarnings / driverStats.completedTrips))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trip Sukses</span>
                    <span className="font-semibold">
                      {Math.round((driverStats.completedTrips / driverStats.totalTrips) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Weekly Chart Placeholder */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-500 text-sm">Grafik Pendapatan Mingguan</p>
                  <div className="flex items-end justify-center space-x-2 mt-4">
                    {[40, 65, 45, 80, 70, 90, 60].map((height, index) => (
                      <div
                        key={index}
                        className="bg-blue-500 rounded-t"
                        style={{ height: `${height}px`, width: '20px' }}
                      ></div>
                    ))}
                  </div>
                  <div className="flex justify-center space-x-4 mt-2 text-xs text-gray-600">
                    <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            {/* Recent Orders History */}
            <Card>
              <CardHeader>
                <CardTitle>Riwayat Pesanan Terakhir</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      id: 1,
                      orderNumber: 'TXB-20241130-089',
                      passenger: 'Ahmad Rizki',
                      from: 'Mall SKA Pekanbaru',
                      to: 'Universitas Riau',
                      fare: 65000,
                      status: 'completed',
                      time: '14:30'
                    },
                    {
                      id: 2,
                      orderNumber: 'TXB-20241130-085',
                      passenger: 'Siti Aminah',
                      from: 'Bandara SSK II',
                      to: 'Hotel Pangeran Pekanbaru',
                      fare: 85000,
                      status: 'completed',
                      time: '12:15'
                    },
                    {
                      id: 3,
                      orderNumber: 'TXB-20241130-078',
                      passenger: 'Budi Santoso',
                      from: 'RS Awal Bros',
                      to: 'Jl. Sudirman',
                      fare: 45000,
                      status: 'completed',
                      time: '10:45'
                    },
                    {
                      id: 4,
                      orderNumber: 'TXB-20241130-072',
                      passenger: 'Linda Sari',
                      from: 'Pasar Bawah',
                      to: 'Bandara SSK II',
                      fare: 95000,
                      status: 'cancelled',
                      time: '09:20'
                    },
                  ].map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">{order.orderNumber}</p>
                          <span className="text-xs text-gray-500">{order.time}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{order.passenger}</p>
                        <div className="text-xs text-gray-500">
                          <p className="truncate">{order.from}</p>
                          <p className="truncate">→ {order.to}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end ml-4">
                        <span className="font-semibold text-sm">{formatCurrency(order.fare)}</span>
                        <Badge 
                          variant={order.status === 'completed' ? 'default' : 'destructive'}
                          className="text-xs mt-1"
                        >
                          {order.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full mt-4">
                  Lihat Semua Riwayat
                </Button>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performa Bulan Ini</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">98.5%</p>
                    <p className="text-sm text-gray-600">Acceptance Rate</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">4.2</p>
                    <p className="text-sm text-gray-600">Avg Trip/Day</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">2.8%</p>
                    <p className="text-sm text-gray-600">Cancellation Rate</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">32h</p>
                    <p className="text-sm text-gray-600">Online Time</p>
                  </div>
                </div>

                {/* Achievement Badges */}
                <div className="mt-6">
                  <p className="font-medium mb-3">Pencapaian</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-gold text-white">🏆 Top Performer</Badge>
                    <Badge className="bg-blue-500">⭐ 5 Star Rating</Badge>
                    <Badge className="bg-green-500">✅ Reliable Driver</Badge>
                    <Badge className="bg-purple-500">🚗 100+ Trips</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex justify-around items-center py-2">
          <Button variant="ghost" size="sm" className="flex flex-col items-center">
            <MapPin className="w-5 h-5" />
            <span className="text-xs mt-1">Lokasi</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex flex-col items-center">
            <Phone className="w-5 h-5" />
            <span className="text-xs mt-1">Support</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex flex-col items-center relative">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs mt-1">Darurat</span>
            {notifications.length > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white">{notifications.length}</span>
              </div>
            )}
          </Button>
          
          <Button variant="ghost" size="sm" className="flex flex-col items-center">
            <User className="w-5 h-5" />
            <span className="text-xs mt-1">Profil</span>
          </Button>
        </div>
      </div>

      {/* Add padding to prevent content from being hidden behind bottom nav */}
      <div className="h-20"></div>
    </div>
  );
};

export default DriverApp;