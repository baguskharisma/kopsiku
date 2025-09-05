"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Car, MapPin, Clock, Route, Users, Wifi, WifiOff, MessageCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import { VEHICLE_TYPES, calculateVehicleFare } from "@/lib/vehicle-types";
import { formatCurrency } from "@/lib/format-currency";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import type { Location } from "@/lib/types";
import type { VehicleType } from "@prisma/client";
import { ScrollArea } from "./ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DriverOption {
  id: string;
  name: string;
  plate: string;
  phone: string;
  vehicleType?: VehicleType;
}

const DEFAULT_DRIVERS: DriverOption[] = [
  { id: 'BM-1856-QU', name: 'Endrizal', plate: 'BM 1856 QU', phone: '08126850120' },
  { id: 'BM-1858-QU', name: 'Syamsuddin', plate: 'BM 1858 QU', phone: '081270432500' },
  { id: 'BM-1860-QU', name: 'Safrizal', plate: 'BM 1860 QU', phone: '085274658457' },
  { id: 'BM-1862-QU', name: 'Mardianto', plate: 'BM 1862 QU', phone: '088279086838' },
  { id: 'BM-1863-QU', name: 'Syafrizal', plate: 'BM 1863 QU', phone: '081378334227' },
  { id: 'BM-1865-QU', name: 'Hotler Sibagariang', plate: 'BM 1865 QU', phone: '081371573112' },
  { id: 'BM-1394-JU', name: 'Zalmi', plate: 'BM 1394 JU', phone: '085351138940' },
  { id: 'BM-1399-JU', name: 'Jhon Kuntan', plate: 'BM 1399 JU', phone: '081364476663' },
  { id: 'BM-1902-QU', name: 'Ari Brewok', plate: 'BM 1902 QU', phone: '' },
  { id: 'BM-1904-QU', name: 'Yusnedi', plate: 'BM 1904 QU', phone: '08127658449' },
  { id: 'BM-1905-QU', name: 'Defrizal', plate: 'BM 1905 QU', phone: '08127634408' },
  { id: 'BM-1906-QU', name: 'Jaya Adha', plate: 'BM 1906 QU', phone: '085265456961' },
  { id: 'BM-1907-QU', name: 'Yakub Efendi', plate: 'BM 1907 QU', phone: '085264015429' },
  { id: 'BM-1924-QU', name: 'Ridwan', plate: 'BM 1924 QU', phone: '085271387541' },
  { id: 'BM-1930-QU', name: 'Hendrizal', plate: 'BM 1930 QU', phone: '085194379507' },
  { id: 'BM-1933-QU', name: 'Azwir', plate: 'BM 1933 QU', phone: '085278131464' },
  { id: 'BM-1955-QU', name: 'Harry Yanson Hutabarat', plate: 'BM 1955 QU', phone: '085271543750' },
  { id: 'BM-1956-QU', name: 'Sarmi', plate: 'BM 1956 QU', phone: '081371574888' },
  { id: 'BM-1957-QU', name: 'Nofrizal', plate: 'BM 1957 QU', phone: '085274237100' },
  { id: 'BM-1404-JU', name: 'Adam Cahyadi', plate: 'BM 1404 JU', phone: '085763579380' },
];

interface EnhancedBookingPanelProps {
  currentLocation: Coordinates | null;
  selectedDestination?: Location | null;
  onDestinationClick: () => void;
  onPickupClick: () => void;
  onBookRide: (rideData: any) => void;
  onRouteCalculated?: (route: RouteResult) => void;
  selectedPickup?: Location | null;
  availableDrivers?: DriverOption[];
  operatorId: string;
  operatorRole: 'ADMIN' | 'SUPER_ADMIN';
}

interface FareEstimate {
  distance: number;
  baseFare: number;
  additionalFare: number;
  totalFare: number;
  additionalKm: number;
  airportFare?: number;
}

export default function EnhancedBookingPanel({ 
  currentLocation, 
  selectedDestination, 
  onDestinationClick, 
  onPickupClick,
  onBookRide,
  onRouteCalculated,
  selectedPickup,
  availableDrivers = DEFAULT_DRIVERS,
  operatorId,
  operatorRole,
}: EnhancedBookingPanelProps) {
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>("ECONOMY");
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [passengerName, setPassengerName] = useState<string>("");
  const [passengerPhone, setPassengerPhone] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const lastRouteCalculationRef = useRef<string>("");

  // Fix hydration mismatch dengan client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Real-time notifications dengan error handling
  const { 
    isConnected = false, 
    connectedDrivers = 0, 
    driverLocations = {},
    refreshDriverLocations = () => {},
    notifications = []
  } = useRealtimeNotifications({
    userRole: operatorRole,
    userId: operatorId,
    enableToasts: true,
    enableSounds: true,
  }) || {};

  // Route calculation dengan improved error handling
  useEffect(() => {
    if (!isClient) return;

    const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;

    if (!pickupLocation || !selectedDestination) {
      setRouteData(null);
      setFareEstimate(null);
      if (onRouteCalculated) {
        onRouteCalculated(null as any);
      }
      return;
    }

    if (typeof pickupLocation.lat !== 'number' || typeof pickupLocation.lng !== 'number' ||
        typeof selectedDestination.lat !== 'number' || typeof selectedDestination.lng !== 'number') {
      return;
    }

    const routeKey = `${pickupLocation.lat.toFixed(4)},${pickupLocation.lng.toFixed(4)}-${selectedDestination.lat.toFixed(4)},${selectedDestination.lng.toFixed(4)}`;

    if (lastRouteCalculationRef.current === routeKey) {
      return;
    }

    const calculateRoute = async () => {
      setIsCalculatingRoute(true);
      try {
        console.log('🗺️ Calculating route from:', pickupLocation, 'to:', { lat: selectedDestination.lat, lng: selectedDestination.lng });

        const route = await gpsService.getRoute(
          pickupLocation,
          { lat: selectedDestination.lat, lng: selectedDestination.lng }
        );

        if (route && route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 1) {
          setRouteData(route);
          if (onRouteCalculated) {
            onRouteCalculated(route);
          }
        } else {
          setRouteData(null);
        }

        const pickupAddress = selectedPickup?.address || "Lokasi Saat Ini";
        const destinationAddress = selectedDestination.address;

        // Improved API call dengan timeout dan error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
          const response = await fetch("/api/fare/estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              distance: route.distance, 
              pickupAddress,
              destinationAddress
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const fare = await response.json();
            setFareEstimate(fare);
            lastRouteCalculationRef.current = routeKey;
          } else {
            console.error("Fare estimate failed:", response.status, response.statusText);
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error("Fare estimate timeout");
          } else {
            console.error("Fare estimate error:", fetchError);
          }
          throw fetchError;
        }
      } catch (error) {
        console.error("Route calculation error:", error);
        
        // Fallback ke straight-line distance
        const distance = gpsService.calculateDistance(
          pickupLocation,
          { lat: selectedDestination.lat, lng: selectedDestination.lng }
        );

        const pickupAddress = selectedPickup?.address || "Lokasi Saat Ini";
        const destinationAddress = selectedDestination.address;

        try {
          const response = await fetch("/api/fare/estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              distance, 
              pickupAddress,
              destinationAddress
            }),
          });

          if (response.ok) {
            const fare = await response.json();
            setFareEstimate(fare);
            lastRouteCalculationRef.current = routeKey;
          }
        } catch (fallbackError) {
          console.error("Fallback fare estimate error:", fallbackError);
          // Set minimal fare estimate sebagai fallback terakhir
          setFareEstimate({
            distance,
            baseFare: 15000,
            additionalFare: Math.max(0, (distance - 3) * 5000),
            totalFare: 15000 + Math.max(0, (distance - 3) * 5000),
            additionalKm: Math.max(0, distance - 3),
            airportFare: 0,
          });
        }

        setRouteData(null);
        if (onRouteCalculated) {
          onRouteCalculated(null as any);
        }
      } finally {
        setIsCalculatingRoute(false);
      }
    };

    const timeoutId = setTimeout(calculateRoute, 2000);
    return () => clearTimeout(timeoutId);
  }, [
    isClient,
    selectedPickup?.id, 
    selectedDestination?.id, 
    currentLocation ? `${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)}` : null,
    onRouteCalculated
  ]);

  // Driver locations refresh dengan error handling
  useEffect(() => {
    if (!isClient) return;

    const interval = setInterval(() => {
      try {
        refreshDriverLocations();
      } catch (error) {
        console.error("Driver location refresh error:", error);
      }
    }, 30000);

    // Initial fetch dengan delay untuk memastikan client sudah ready
    setTimeout(() => {
      try {
        refreshDriverLocations();
      } catch (error) {
        console.error("Initial driver location fetch error:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isClient, refreshDriverLocations]);

  // Improved receipt download function
  const handleDownloadReceipt = async () => {
    if (!isClient) return;

    const receiptData = generateReceiptData();

    const BASE_WIDTH = 384;
    const SCALE = 2;
    const width = BASE_WIDTH * SCALE;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      toast.error("Canvas Error", {
        description: "Unable to create canvas context for receipt generation",
      });
      return;
    }

    tempCanvas.width = width;
    tempCanvas.height = 4000 * SCALE;

    try {
      // Background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, width, tempCanvas.height);

      let yPos = 18 * SCALE;
      const leftMargin = 12 * SCALE;
      const rightMargin = width - 12 * SCALE;

      const FS_XS = 18 * SCALE;
      const FS_SM = 19 * SCALE;
      const FS_MD = 20 * SCALE;
      const FS_BOLD_SM = 20 * SCALE;
      const FS_BOLD_MD = 22 * SCALE;

      const LINE_GAP = 18 * SCALE;
      const EXTRA_VALUE_GAP = 8 * SCALE;
      const EXTRA_BLOCK_GAP = 12 * SCALE;
      const EXTRA_LOGO_TITLE_GAP = 18 * SCALE;

      const fontStr = (size: number, weight: 'normal' | 'bold' = 'normal') =>
        `${weight === 'bold' ? 'bold ' : ''}${Math.round(size)}px Arial, sans-serif`;

      const drawText = (
        text: string,
        x: number,
        y: number,
        size: number = FS_SM,
        weight: 'normal' | 'bold' = 'normal',
        align: 'left' | 'center' | 'right' = 'left'
      ) => {
        tempCtx.font = fontStr(size, weight);
        tempCtx.textAlign = align;
        tempCtx.fillStyle = '#000000';
        tempCtx.fillText(text, x, y);
        return y + Math.round(size) + LINE_GAP;
      };

      const drawLine = (y: number) => {
        tempCtx.strokeStyle = '#cccccc';
        tempCtx.lineWidth = Math.max(1 * SCALE, 1);
        tempCtx.beginPath();
        tempCtx.moveTo(leftMargin, y);
        tempCtx.lineTo(rightMargin, y);
        tempCtx.stroke();
        return y + (14 * SCALE);
      };

      // Load logo dengan fallback
      const loadLogoImage = (): Promise<HTMLImageElement> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            const fallbackCanvas = document.createElement('canvas');
            const fallbackCtx = fallbackCanvas.getContext('2d')!;
            const s = 64 * SCALE;
            fallbackCanvas.width = s;
            fallbackCanvas.height = s;
            fallbackCtx.fillStyle = '#1e40af';
            fallbackCtx.beginPath();
            fallbackCtx.arc(s / 2, s / 2, (s / 2) - (4 * SCALE), 0, 2 * Math.PI);
            fallbackCtx.fill();
            fallbackCtx.fillStyle = '#ffffff';
            fallbackCtx.font = `${Math.round(12 * SCALE)}px Arial`;
            fallbackCtx.textAlign = 'center';
            fallbackCtx.fillText('KOPSI', s / 2, s / 2 + (6 * SCALE));
            const fallbackImg = new Image();
            fallbackImg.src = fallbackCanvas.toDataURL();
            fallbackImg.onload = () => resolve(fallbackImg);
          };
          img.src = '/logo-kopsi-pekanbaru.jpeg';
        });

      // Header
      tempCtx.fillStyle = '#000000';
      yPos = drawText(receiptData.date, leftMargin, yPos, FS_XS, 'normal', 'left');
      tempCtx.font = fontStr(FS_XS, 'normal');
      tempCtx.textAlign = 'right';
      tempCtx.fillText(receiptData.time, rightMargin, yPos - (Math.round(FS_XS) + LINE_GAP));
      tempCtx.textAlign = 'left';

      // Logo
      yPos += 6 * SCALE;
      const logoImg = await loadLogoImage();
      const logoSize = 48 * SCALE;
      tempCtx.drawImage(logoImg, width / 2 - logoSize / 2, yPos, logoSize, logoSize);
      yPos += logoSize + (12 * SCALE) + EXTRA_LOGO_TITLE_GAP;

      // Company name
      yPos = drawText('KOPSI PEKANBARU', width / 2, yPos, FS_BOLD_MD, 'bold', 'center');
      yPos += 6 * SCALE;

      // Divider
      yPos = drawLine(yPos);

      // Content sections...
      yPos = drawText('Detail Perjalanan:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      // Final crop dan save
      const actualHeight = Math.max(yPos + (12 * SCALE), 200 * SCALE);
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCanvas.width = width;
      finalCanvas.height = actualHeight;

      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, width, actualHeight);
      finalCtx.drawImage(tempCanvas, 0, 0, width, actualHeight, 0, 0, width, actualHeight);

      finalCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt-kopsi-${receiptData.passenger.name.replace(/\s+/g, '-')}-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast.success("Receipt Downloaded!", {
            description: "Receipt KOPSI telah disimpan.",
          });
        } else {
          toast.error("Error", { description: "Gagal menghasilkan file gambar" });
        }
      }, 'image/png');

    } catch (error) {
      console.error("Error generating receipt:", error);
      toast.error("Error", {
        description: "Gagal membuat receipt. Silakan coba lagi.",
      });
    }
  };

  const generateReceiptData = () => {
    const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;
    const selectedVehicle = VEHICLE_TYPES.find(v => v.id === selectedVehicleType);
    const finalFare = fareEstimate ? calculateVehicleFare(fareEstimate.totalFare, selectedVehicleType) : 0;
    const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);

    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const timeString = currentDate.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return {
      date: dateString,
      time: timeString,
      travel: {
        from: selectedPickup?.display_name || "Lokasi Saat Ini",
        to: selectedDestination?.display_name || "",
      },
      passenger: {
        name: passengerName,
        phone: passengerPhone,
      },
      fare: {
        distanceKm: routeData ? routeData.distance : fareEstimate?.distance || 0,
        farePerKm: fareEstimate ? Math.round(fareEstimate.additionalFare * (fareEstimate.additionalKm || 1)) : 0,
        subTotal: fareEstimate?.additionalFare || 0,
        baseFare: fareEstimate?.baseFare || 0,
        airportCharge: fareEstimate?.airportFare || 0,
      },
      driver: selectedDriver,
      vehicleType: selectedVehicle?.name,
      totalFare: finalFare,
    };
  };

  const openWhatsApp = () => {
    const cleanPhone = passengerPhone.replace(/[\s\-\+]/g, '').replace(/^0/, '62').replace(/^62/, '62');
    const whatsappUrl = `https://wa.me/${cleanPhone}`;

    window.open(whatsappUrl, '_blank');

    toast.success("WhatsApp Dibuka!", {
      description: `Pesan konfirmasi telah disiapkan untuk ${passengerName}`,
      duration: 3000,
    });

    setPassengerName("");
    setPassengerPhone("");
    setSelectedDriverId(null);
    setShowConfirmDialog(false);

    const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;
    if (pickupLocation && selectedDestination && fareEstimate) {
      const rideData = {
        passengerName,
        passengerPhone,
        pickupAddress: selectedPickup?.address || "Lokasi Saat Ini",
        pickupCoordinates: pickupLocation,
        dropoffAddress: selectedDestination.address,
        dropoffCoordinates: {
          lat: selectedDestination.lat,
          lng: selectedDestination.lng,
        },
        requestedVehicleType: selectedVehicleType,
        totalFare: calculateVehicleFare(fareEstimate.totalFare, selectedVehicleType),
      };
      onBookRide(rideData);
    }
  };

  const bookRideMutation = useMutation({
    mutationFn: async () => {
      const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;

      if (!selectedDestination || !fareEstimate || !pickupLocation) {
        throw new Error("Missing required data for booking");
      }

      const selectedVehicle = VEHICLE_TYPES.find(v => v.id === selectedVehicleType);
      const finalFare = calculateVehicleFare(fareEstimate.totalFare, selectedVehicleType);

      let pickupAddress;

      if (selectedPickup) {
        pickupAddress = selectedPickup.address;
      } else {
        try {
          pickupAddress = await gpsService.reverseGeocode(currentLocation!);
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
          pickupAddress = `${currentLocation!.lat}, ${currentLocation!.lng}`;
        }
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      const orderData = {
        passengerName: passengerName || "Guest User",
        passengerPhone: passengerPhone || "",
        pickupAddress: selectedPickup?.address || "Lokasi Saat Ini",
        pickupCoordinates: {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        },
        dropoffAddress: selectedDestination.address,
        dropoffCoordinates: {
          lat: selectedDestination.lat,
          lng: selectedDestination.lng,
        },
        requestedVehicleType: selectedVehicleType,
        distanceMeters: Math.round(fareEstimate.distance * 1000),
        estimatedDurationMinutes: routeData?.duration || Math.round(fareEstimate.distance * 2.5),
        baseFare: Math.round(fareEstimate.baseFare * 100),
        distanceFare: Math.round(fareEstimate.additionalFare * 100),
        airportFare: Math.round((fareEstimate.airportFare || 0) * 100),
        totalFare: Math.round(finalFare * 100),
        paymentMethod: "CASH" as const,
        routeData: routeData ? {
          coordinates: routeData.coordinates,
          distance: routeData.distance,
          duration: routeData.duration,
        } : undefined,
        specialRequests: selectedDriverId ? `Preferred driver: ${selectedDriverId}` : undefined,
      };

      const response = await fetch(`${backendUrl}/api/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Booking failed:", errorData);
        throw new Error(errorData.message || "Failed to book ride");
      }

      const result = await response.json();
      return { rideData: orderData, response: result };
    },
    onSuccess: (data) => {
      toast.success("Pesanan Berhasil Dibuat!", {
        description: `Order ${data.response.data?.orderNumber || ''} telah dibuat dan driver akan segera ditugaskan.`,
        duration: 5000,
      });

      setPassengerName("");
      setPassengerPhone("");
      setSelectedDriverId(null);

      onBookRide(data.rideData);
    },
    onError: (error) => {
      console.error("Booking error:", error);
      toast.error("Gagal Membuat Pesanan", {
        description: error.message || "Silakan coba lagi",
      });
    },
  });

  const getVehiclePrice = (basePrice: number, vehicleId: VehicleType) => {
    return calculateVehicleFare(basePrice, vehicleId);
  };

  const handleBookRideClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmBooking = () => {
    openWhatsApp();
  };

  const isBookDisabled =
    !selectedDestination ||
    !currentLocation ||
    bookRideMutation.isPending ||
    isCalculatingRoute ||
    passengerName.trim() === "" ||
    passengerPhone.trim() === "";

  // Render loading state untuk server-side rendering
  if (!isClient) {
    return (
      <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 h-[400px] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 h-[400px]" data-testid="enhanced-booking-panel">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        <ScrollArea className="p-6 pb-8 h-full">
          {/* Connection Status & Driver Info */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-600 mr-2" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600 mr-2" />
                )}
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {isConnected ? 'Terhubung ke System' : 'Tidak Terhubung'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {connectedDrivers} driver online
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshDriverLocations}
                className="h-8 px-3 text-xs"
              >
                <Users className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Route Info */}
          {routeData && routeData.coordinates && Array.isArray(routeData.coordinates) && routeData.coordinates.length > 1 && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4" data-testid="route-info">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Route className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">Estimasi perjalanan</p>
                    <p className="text-sm text-gray-500">
                      {routeData.distance.toFixed(1)} km • {Math.round(routeData.duration)} min
                    </p>
                  </div>
                </div>
                {isCalculatingRoute && (
                  <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                )}
              </div>
            </div>
          )}

          {/* Location Inputs */}
          <div className="space-y-3 mb-6">
  <Button
    variant="outline"
    className="w-full flex items-center justify-start p-4 rounded-xl h-auto"
    onClick={onPickupClick}
    data-testid="button-select-pickup"
  >
    <MapPin className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
    <div className="flex flex-col items-start w-full min-w-0">
      <p className={`font-medium w-full break-words whitespace-normal text-start ${
        selectedPickup ? "text-gray-900" : "text-gray-400"
      }`}>
        {selectedPickup ? selectedPickup.display_name : "Dari mana?"}
      </p>
      {selectedPickup && (
        <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
          {selectedPickup.formatted_address}
        </p>
      )}
    </div>
  </Button>

  <Button
    variant="outline"
    className="w-full flex items-center justify-start p-4 rounded-xl h-auto"
    onClick={onDestinationClick}
    data-testid="button-select-destination"
  >
    <MapPin className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
    <div className="flex flex-col items-start w-full min-w-0">
      <p className={`font-medium w-full break-words whitespace-normal text-start ${
        selectedDestination ? "text-gray-900" : "text-gray-400"
      }`}>
        {selectedDestination ? selectedDestination.display_name : "Mau ke mana?"}
      </p>
      {selectedDestination && (
        <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
          {selectedDestination.formatted_address}
        </p>
      )}
    </div>
  </Button>
</div>

          {/* Vehicle Type Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" data-testid="text-choose-ride">
              Pilih jenis kendaraan
            </h3>
            <div className="space-y-3">
              {VEHICLE_TYPES.map((vehicle) => (
                <div 
                  key={vehicle.id}
                  className={`flex items-center p-4 rounded-xl cursor-pointer border-2 transition-colors ${
                    selectedVehicleType === vehicle.id 
                      ? "border-blue-600 bg-blue-50" 
                      : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setSelectedVehicleType(vehicle.id)}
                  data-testid={`ride-type-${vehicle.id}`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${
                    vehicle.id === "MOTORCYCLE" ? "bg-gray-900" : 
                    vehicle.id === "ECONOMY" ? "bg-[#fcba03]" : "bg-amber-600"
                  }`}>
                    <Car className="text-white h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{vehicle.name}</p>
                        <p className="text-sm text-gray-500">{vehicle.description}</p>
                        <p className="text-xs text-gray-400">
                          {vehicle.features.slice(0, 2).join(" • ")}
                        </p>
                      </div>
                      {fareEstimate && (
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(getVehiclePrice(fareEstimate.totalFare, vehicle.id))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {vehicle.multiplier > 1 && `${vehicle.multiplier}x`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger Info Inputs */}
          <div className="space-y-3 mb-6">
            <div>
              <label htmlFor="passenger-name" className="text-sm font-medium text-gray-700 block mb-1">
                Nama Penumpang
              </label>
              <input
                id="passenger-name"
                data-testid="input-passenger-name"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                placeholder="Nama penumpang"
                className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="text"
              />
            </div>

            <div>
              <label htmlFor="passenger-phone" className="text-sm font-medium text-gray-700 block mb-1">
                Nomor HP Penumpang
              </label>
              <input
                id="passenger-phone"
                data-testid="input-passenger-phone"
                value={passengerPhone}
                onChange={(e) => setPassengerPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="tel"
              />
            </div>

            {/* Driver Selection */}
            <div>
              <label htmlFor="driver-select" className="text-sm font-medium text-gray-700 block mb-1">
                Driver yang tersedia
              </label>
              <select
                id="driver-select"
                data-testid="select-driver"
                value={selectedDriverId || ""}
                onChange={(e) => setSelectedDriverId(e.target.value || null)}
                className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Pilih Driver</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.plate}
                  </option>
                ))}
              </select>
              {availableDrivers.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">Tidak ada Driver tersedia saat ini.</p>
              )}
            </div>
          </div>

          {/* Fare Breakdown */}
          {fareEstimate && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6" data-testid="fare-breakdown">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Distance</span>
                <span className="text-sm font-medium" data-testid="text-distance">
                  {routeData ? routeData.distance.toFixed(1) : fareEstimate.distance.toFixed(1)} km
                </span>
              </div>
              {routeData && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Estimated time</span>
                  <span className="text-sm" data-testid="text-duration">
                    {Math.round(routeData.duration)} minutes
                  </span>
                </div>
              )}
              {/* <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Base fare</span>
                <span className="text-sm" data-testid="text-base-fare">
                  {formatCurrency(fareEstimate.baseFare)}
                </span>
              </div> */}
              {fareEstimate.additionalKm > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">
                    Additional {fareEstimate.additionalKm.toFixed(1)} km
                  </span>
                  <span className="text-sm" data-testid="text-additional-fare">
                    {formatCurrency(fareEstimate.additionalFare)}
                  </span>
                </div>
              )}
              {fareEstimate.airportFare !== undefined && fareEstimate.airportFare > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Airport fare</span>
                  <span className="text-sm" data-testid="text-airport-fare">
                    {formatCurrency(fareEstimate.airportFare)}
                  </span>
                </div>
              )}
              <hr className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">Total Fare</span>
                <span className="font-semibold text-gray-900 text-lg" data-testid="text-total-fare">
                  {formatCurrency(getVehiclePrice(fareEstimate.totalFare, selectedVehicleType))}
                </span>
              </div>
            </div>
          )}

          {/* Book Ride Button */}
          <Button 
            className="w-full bg-gray-900 text-white py-4 mb-4 rounded-xl font-semibold disabled:bg-gray-300 disabled:text-gray-500 h-auto hover:bg-gray-800"
            disabled={isBookDisabled}
            onClick={handleBookRideClick}
            data-testid="button-book-ride"
          >
            {bookRideMutation.isPending 
              ? "Booking..." 
              : isCalculatingRoute
                ? "Calculating route..."
                : selectedDestination && currentLocation && fareEstimate
                  ? `Book ${VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name} • ${formatCurrency(getVehiclePrice(fareEstimate.totalFare, selectedVehicleType))}`
                  : !currentLocation
                    ? "Getting your location..."
                    : "Choose destination to book"
            }
          </Button>
        </ScrollArea>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex justify-between items-center">
              <AlertDialogTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-green-600" />
                Konfirmasi Pesanan
              </AlertDialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReceipt}
                className="h-8 px-2"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
            <AlertDialogDescription className="text-left space-y-3">
              {/* Header with Date and Time */}
              <div className="flex justify-between items-center text-xs text-gray-500 border-b pb-2">
                <span>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <div className="text-center">
                  <p className="font-bold text-sm text-gray-900">KOPSI PEKANBARU</p>
                </div>
                <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
              </div>

              {/* Detail Perjalanan */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Detail Perjalanan :</h4>
                <div className="space-y-1 text-xs">
                  <p><strong>Dari :</strong> {selectedPickup?.display_name || "Lokasi Saat Ini"}</p>
                  <p><strong>Tujuan :</strong> {selectedDestination?.display_name}</p>
                </div>
              </div>

              {/* Detail Penumpang */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-900 mb-2">Detail Penumpang :</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <strong>Nama Penumpang</strong>
                    <strong>{passengerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <strong>Nomor Handphone</strong>
                    <strong>{passengerPhone}</strong>
                  </div>
                </div>
              </div>

              {/* Detail Tarif */}
              {fareEstimate && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-semibold text-sm text-gray-900 mb-2">Detail Tarif :</h4>
                  <div className="space-y-1 text-xs">
                    {/* <div className="flex justify-between">
                      <strong>Jarak Tempuh (KM)</strong>
                      <span>{(routeData ? routeData.distance : fareEstimate.distance).toFixed(1)}</span>
                    </div> */}
                    {/* <div className="flex justify-between">
                      <strong>Tarif Per KM</strong>
                      <span>Rp {fareEstimate.additionalKm > 0 ? Math.round(fareEstimate.additionalFare / fareEstimate.additionalKm).toLocaleString() : '0'}</span>
                    </div> */}
                    <div className="flex justify-between ml-auto w-1/2 border-t pt-1">
                      <strong>Subtotal</strong>
                      <strong>Rp {fareEstimate.additionalFare.toLocaleString()}</strong>
                    </div>
                    {/* <div className="flex justify-between">
                      <strong>Tarif Dasar</strong>
                      <span>Rp {fareEstimate.baseFare.toLocaleString()}</span>
                    </div> */}
                    <div className="flex justify-between">
                      <strong>Airport Charge</strong>
                      <span>Rp {(fareEstimate.airportFare || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between ml-auto w-1/2 border-t pt-1 font-semibold">
                      <strong>TOTAL</strong>
                      <strong>Rp {getVehiclePrice(fareEstimate.totalFare, selectedVehicleType).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {selectedDriverId && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">Driver yang Dipilih :</h4>
                  <p className="text-xs">
                    <strong>{availableDrivers.find(d => d.id === selectedDriverId)?.name}</strong> - {availableDrivers.find(d => d.id === selectedDriverId)?.plate}
                  </p>
                </div>
              )}

              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 italic">
                  <strong>Catatan:</strong> Penumpang akan dibebankan biaya tunggu sebesar Rp 45.000 apabila singgah lebih dari 15 menit atau merubah tujuan perjalanan dalam kota Pekanbaru.
                </p>
              </div>

              <p className="text-gray-600 text-xs text-center border-t pt-2">
                Konfirmasi pesanan akan dikirim melalui WhatsApp ke nomor penumpang.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmBooking}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Ya, Kirim via WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}