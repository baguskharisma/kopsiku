"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Car, MapPin, Clock, Route, Users, Wifi, WifiOff, MessageCircle, Download, Star, RefreshCw } from "lucide-react";
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
import { Badge } from "./ui/badge";

// Interface for real driver data from backend
interface AvailableDriver {
  fleet: {
    id: string;
    vehicleType: VehicleType;
    status: string;
    plateNumber: string;
    brand: string;
    model: string;
    color: string;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    driverProfile: {
      id: string;
      rating: number;
      driverStatus: 'ACTIVE' | 'BUSY' | 'OFFLINE';
      currentLat: number | null;
      currentLng: number | null;
      isVerified: boolean;
      totalTrips: number;
      completedTrips: number;
    };
  };
  distance?: number; // Distance from pickup location in KM
}

interface EnhancedBookingPanelProps {
  currentLocation: Coordinates | null;
  selectedDestination?: Location | null;
  onDestinationClick: () => void;
  onPickupClick: () => void;
  onBookRide: (rideData: any) => void;
  onRouteCalculated?: (route: RouteResult) => void;
  selectedPickup?: Location | null;
  // Real-time props
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
  operatorId,
  operatorRole,
}: EnhancedBookingPanelProps) {
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>("ECONOMY");
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const lastRouteCalculationRef = useRef<string>("");

  // Passenger inputs
  const [passengerName, setPassengerName] = useState<string>("");
  const [passengerPhone, setPassengerPhone] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Real-time notifications
  const { 
    isConnected, 
    connectedDrivers, 
    driverLocations,
    refreshDriverLocations,
    notifications 
  } = useRealtimeNotifications({
    userRole: operatorRole,
    userId: operatorId,
    enableToasts: true,
    enableSounds: true,
  });

  // Get pickup location for driver search
  const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;

  // Fetch available drivers based on vehicle type and pickup location
  const { 
    data: availableDrivers = [], 
    isLoading: loadingDrivers, 
    refetch: refetchDrivers,
    error: driversError 
  } = useQuery({
    queryKey: ['availableDrivers', selectedVehicleType, pickupLocation],
    queryFn: async () => {
      if (!pickupLocation) return [];
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(
        `${backendUrl}/api/orders/operator/available-drivers?vehicleType=${selectedVehicleType}&pickupLat=${pickupLocation.lat}&pickupLng=${pickupLocation.lng}&radius=15`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`, // Add auth token
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch available drivers');
      }

      const data = await response.json();
      return data.data as AvailableDriver[];
    },
    enabled: !!pickupLocation && !!selectedVehicleType,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Auto-refresh drivers every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchDrivers();
      refreshDriverLocations();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchDrivers, refreshDriverLocations]);

  // Calculate route and fare when pickup or destination changes
  useEffect(() => {
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

        console.log('🛣️ Route calculated:', route);
        
        if (route && route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 1) {
          setRouteData(route);
          if (onRouteCalculated) {
            onRouteCalculated(route);
          }
          console.log('✅ Route data set successfully');
        } else {
          console.warn('⚠️ Invalid route data received:', route);
          setRouteData(null);
        }

        const pickupAddress = selectedPickup?.address || "Lokasi Saat Ini";
        const destinationAddress = selectedDestination.address;
        
        const response = await fetch("/api/fare/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            distance: route.distance, 
            pickupAddress,
            destinationAddress
          }),
        });

        if (response.ok) {
          const fare = await response.json();
          setFareEstimate(fare);
          lastRouteCalculationRef.current = routeKey;
        }
      } catch (error) {
        console.error("Route calculation error:", error);
        toast.error("Route Error", {
          description: "Unable to calculate route. Using straight-line distance.",
        });

        const distance = gpsService.calculateDistance(
          pickupLocation,
          { lat: selectedDestination.lat, lng: selectedDestination.lng }
        );

        const pickupAddress = selectedPickup?.address || "Lokasi Saat Ini";
        const destinationAddress = selectedDestination.address;
        
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
    selectedPickup?.id, 
    selectedDestination?.id, 
    currentLocation ? `${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)}` : null,
    onRouteCalculated
  ]);

  // Function to generate receipt data
  const generateReceiptData = () => {
    const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;
    const selectedVehicle = VEHICLE_TYPES.find(v => v.id === selectedVehicleType);
    const finalFare = fareEstimate ? calculateVehicleFare(fareEstimate.totalFare, selectedVehicleType) : 0;
    const selectedDriver = availableDrivers.find(d => d.driver.id === selectedDriverId);

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
        from: selectedPickup?.address || "Lokasi Saat Ini",
        to: selectedDestination?.address || "",
      },
      passenger: {
        name: passengerName,
        phone: passengerPhone,
      },
      fare: {
        distanceKm: routeData ? routeData.distance : fareEstimate?.distance || 0,
        farePerKm: fareEstimate ? Math.round(fareEstimate.additionalFare / (fareEstimate.additionalKm || 1)) : 0,
        baseFare: fareEstimate?.baseFare || 0,
        airportCharge: fareEstimate?.airportFare || 0,
      },
      driver: selectedDriver ? {
        name: selectedDriver.driver.name,
        plate: selectedDriver.fleet.plateNumber,
        phone: selectedDriver.driver.phone,
      } : null,
      vehicle: selectedDriver ? {
        type: selectedVehicle?.name,
        brand: selectedDriver.fleet.brand,
        model: selectedDriver.fleet.model,
        color: selectedDriver.fleet.color,
      } : { type: selectedVehicle?.name },
      totalFare: finalFare,
    };
  };

  // Enhanced function to download receipt as PNG with real driver data
  const handleDownloadReceipt = async () => {
    const receiptData = generateReceiptData();

    // Base for thermal 58mm
    const BASE_WIDTH = 384;
    const SCALE = 2;
    const width = BASE_WIDTH * SCALE;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;

    tempCanvas.width = width;
    tempCanvas.height = 4000 * SCALE;

    if (!tempCtx) {
      toast.error("Canvas Error", {
        description: "Unable to create canvas context for receipt generation",
      });
      return;
    }

    try {
      // Background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, width, tempCanvas.height);

      // Layout constants scaled
      let yPos = 18 * SCALE;
      const leftMargin = 12 * SCALE;
      const rightMargin = width - 12 * SCALE;
      const contentWidth = width - leftMargin - 12 * SCALE;

      // Font sizes
      const FS_XS = 18 * SCALE;
      const FS_SM = 19 * SCALE;
      const FS_MD = 20 * SCALE;
      const FS_BOLD_SM = 20 * SCALE;
      const FS_BOLD_MD = 22 * SCALE;

      // Spacing parameters
      const LINE_GAP = 18 * SCALE;
      const EXTRA_VALUE_GAP = 8 * SCALE;
      const EXTRA_BLOCK_GAP = 12 * SCALE;
      const EXTRA_LOGO_TITLE_GAP = 18 * SCALE;

      // Helper functions
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

      const drawKeyValue = (
        key: string,
        value: string,
        y: number,
        opts?: {
          keySize?: number;
          valueSize?: number;
          valueLineHeight?: number;
          valueMaxWidth?: number;
        }
      ) => {
        const keySize = opts?.keySize ?? FS_BOLD_SM;
        const valueSize = opts?.valueSize ?? FS_MD;
        const valueLineHeight = opts?.valueLineHeight ?? Math.round(valueSize + (10 * SCALE));
        const valueMaxWidth = opts?.valueMaxWidth ?? (contentWidth - (80 * SCALE));

        // Prepare wrapped lines for value
        tempCtx.font = fontStr(valueSize, 'normal');
        let words = value.split(' ');
        let line = '';
        const lines: string[] = [];
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = tempCtx.measureText(testLine);
          if (metrics.width > valueMaxWidth && line !== '') {
            lines.push(line.trim());
            line = words[i] + ' ';
          } else {
            line = testLine;
          }
        }
        if (line.trim()) lines.push(line.trim());

        // Draw key (left)
        tempCtx.font = fontStr(keySize, 'bold');
        tempCtx.textAlign = 'left';
        tempCtx.fillStyle = '#000000';
        tempCtx.fillText(key, leftMargin, y);

        // Draw value lines (right-aligned)
        tempCtx.font = fontStr(valueSize, 'normal');
        tempCtx.textAlign = 'right';
        const valueStartY = y + EXTRA_VALUE_GAP;
        for (let i = 0; i < lines.length; i++) {
          tempCtx.fillText(lines[i], rightMargin, valueStartY + i * valueLineHeight);
        }

        return valueStartY + lines.length * valueLineHeight + LINE_GAP;
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

      // Load logo and QR images (placeholder implementations)
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

      const loadQRImage = (): Promise<HTMLImageElement> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            const fallbackCanvas = document.createElement('canvas');
            const fallbackCtx = fallbackCanvas.getContext('2d')!;
            const s = 120 * SCALE;
            fallbackCanvas.width = s;
            fallbackCanvas.height = s;
            fallbackCtx.fillStyle = '#ffffff';
            fallbackCtx.fillRect(0, 0, s, s);
            fallbackCtx.fillStyle = '#000000';
            for (let i = 0; i < 12; i++) {
              for (let j = 0; j < 12; j++) {
                if ((i + j) % 3 === 0) fallbackCtx.fillRect(i * (10 * SCALE), j * (10 * SCALE), 10 * SCALE, 10 * SCALE);
              }
            }
            const fallbackImg = new Image();
            fallbackImg.src = fallbackCanvas.toDataURL();
            fallbackImg.onload = () => resolve(fallbackImg);
          };
          img.src = '/qrcode.png';
        });

      // --- START DRAWING ---
      tempCtx.fillStyle = '#000000';
      yPos = drawText(receiptData.date, leftMargin, yPos, FS_XS, 'normal', 'left');
      
      // Time on same baseline
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

      // Detail Perjalanan
      yPos = drawText('Detail Perjalanan:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      yPos = drawKeyValue('Dari', receiptData.travel.from, yPos, {
        keySize: FS_BOLD_SM,
        valueSize: FS_MD,
        valueLineHeight: Math.round(FS_MD + (12 * SCALE)),
        valueMaxWidth: contentWidth - (60 * SCALE),
      });

      yPos = drawKeyValue('Tujuan', receiptData.travel.to, yPos, {
        keySize: FS_BOLD_SM,
        valueSize: FS_MD,
        valueLineHeight: Math.round(FS_MD + (12 * SCALE)),
        valueMaxWidth: contentWidth - (60 * SCALE),
      });

      yPos += 8 * SCALE;
      yPos = drawLine(yPos);

      // Detail Penumpang
      yPos = drawText('Detail Penumpang:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      yPos = drawKeyValue('Nama', receiptData.passenger.name, yPos);
      yPos = drawKeyValue('HP', receiptData.passenger.phone, yPos);

      yPos += 8 * SCALE;
      yPos = drawLine(yPos);

      // Detail Tarif
      yPos = drawText('Detail Tarif:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      yPos = drawKeyValue('Jarak (KM)', receiptData.fare.distanceKm.toFixed(1), yPos);
      yPos = drawKeyValue('Tarif / KM', `Rp ${receiptData.fare.farePerKm.toLocaleString()}`, yPos);

      // Subtotal
      tempCtx.font = fontStr(FS_BOLD_SM, 'bold');
      tempCtx.textAlign = 'left';
      tempCtx.fillText('Subtotal', leftMargin, yPos);
      tempCtx.textAlign = 'right';
      tempCtx.fillText(`Rp ${Math.round(receiptData.fare.distanceKm * receiptData.fare.farePerKm).toLocaleString()}`, rightMargin, yPos);
      yPos += (20 * SCALE) + EXTRA_BLOCK_GAP;

      yPos = drawKeyValue('Tarif Dasar', `Rp ${receiptData.fare.baseFare.toLocaleString()}`, yPos);
      yPos = drawKeyValue('Airport Charge', `Rp ${receiptData.fare.airportCharge.toLocaleString()}`, yPos);

      yPos += 8 * SCALE;
      yPos = drawLine(yPos);
      yPos += 10 * SCALE;

      // TOTAL
      tempCtx.font = fontStr(28 * SCALE, 'bold');
      tempCtx.textAlign = 'left';
      tempCtx.fillText('TOTAL', leftMargin, yPos);
      tempCtx.textAlign = 'right';
      tempCtx.fillText(`Rp ${receiptData.totalFare.toLocaleString()}`, rightMargin, yPos);
      yPos += (28 * SCALE);

      // Driver info (using real data)
      if (receiptData.driver) {
        yPos = drawText('Informasi Driver:', leftMargin, yPos, FS_BOLD_SM, 'bold');
        yPos = drawText(`Nama: ${receiptData.driver.name}`, leftMargin, yPos, FS_SM, 'normal');
        yPos = drawText(`Plat: ${receiptData.driver.plate}`, leftMargin, yPos, FS_SM, 'normal');
        yPos = drawText(`HP: ${receiptData.driver.phone}`, leftMargin, yPos, FS_SM, 'normal');
        
        if (receiptData.vehicle) {
          yPos = drawText(`Kendaraan: ${receiptData.vehicle.brand} ${receiptData.vehicle.model} (${receiptData.vehicle.color})`, leftMargin, yPos, FS_SM, 'normal');
        }
        yPos += 12 * SCALE;
      }

      // QR Code
      yPos += 12 * SCALE;
      const qrSize = 96 * SCALE;
      const qrX = width / 2 - qrSize / 2;
      try {
        const qrImg = await loadQRImage();
        tempCtx.drawImage(qrImg, qrX, yPos, qrSize, qrSize);
      } catch (error) {
        console.error("Failed to load QR code image:", error);
        tempCtx.fillStyle = '#f0f0f0';
        tempCtx.fillRect(qrX, yPos, qrSize, qrSize);
        tempCtx.strokeStyle = '#cccccc';
        tempCtx.strokeRect(qrX, yPos, qrSize, qrSize);
        tempCtx.fillStyle = '#666666';
        tempCtx.font = fontStr(FS_SM, 'normal');
        tempCtx.textAlign = 'center';
        tempCtx.fillText('QR Code', width / 2, yPos + qrSize / 2);
      }
      yPos += qrSize + (14 * SCALE);

      // Footer note
      tempCtx.fillStyle = '#000000';
      tempCtx.font = `bold ${Math.round(14 * SCALE)}px Arial, sans-serif`;
      tempCtx.textAlign = 'left';
      const noteText = 'Catatan: Penumpang akan dibebankan biaya tunggu sebesar Rp 45.000 apabila singgah lebih dari 15 menit atau merubah tujuan perjalanan dalam kota Pekanbaru.';
      
      // Simple text wrapping for footer
      const words = noteText.split(' ');
      let line = '';
      const lineHeight = Math.round(14 * SCALE);
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = tempCtx.measureText(testLine);
        if (metrics.width > contentWidth && line !== '') {
          tempCtx.fillText(line.trim(), leftMargin, yPos);
          line = words[i] + ' ';
          yPos += lineHeight;
        } else {
          line = testLine;
        }
      }
      if (line) {
        tempCtx.fillText(line.trim(), leftMargin, yPos);
        yPos += lineHeight;
      }
      yPos += 22 * SCALE;

      // Final crop
      const actualHeight = Math.max(yPos + (12 * SCALE), 200 * SCALE);
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d')!;
      finalCanvas.width = width;
      finalCanvas.height = actualHeight;

      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, width, actualHeight);
      finalCtx.drawImage(tempCanvas, 0, 0, width, actualHeight, 0, 0, width, actualHeight);

      // Save PNG
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
            description: "Receipt KOPSI telah disimpan dengan data driver terbaru.",
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

  // Function to open WhatsApp
  const openWhatsApp = () => {
    const cleanPhone = passengerPhone.replace(/[\s\-\+]/g, '').replace(/^0/, '62').replace(/^62/, '62');
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast.success("WhatsApp Dibuka!", {
      description: `Pesan konfirmasi telah disiapkan untuk ${passengerName}`,
      duration: 3000,
    });

    // Reset form
    setPassengerName("");
    setPassengerPhone("");
    setSelectedDriverId(null);
    setSelectedFleetId(null);
    setShowConfirmDialog(false);
    
    // Call the original onBookRide callback
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
        selectedDriverId,
        selectedFleetId,
      };
      onBookRide(rideData);
    }
  };

  // Mutation for creating order using real backend
  const bookRideMutation = useMutation({
    mutationFn: async () => {
      const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;

      if (!selectedDestination || !fareEstimate || !pickupLocation) {
        throw new Error("Missing required data for booking");
      }

      if (!selectedDriverId || !selectedFleetId) {
        throw new Error("Please select a driver first");
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Step 1: Create order
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
        distanceMeters: Math.round((fareEstimate.distance || 0) * 1000),
        estimatedDurationMinutes: routeData?.duration || Math.round((fareEstimate.distance || 0) * 2.5),
        baseFare: Math.round(fareEstimate.baseFare * 100), // Convert to cents
        distanceFare: Math.round(fareEstimate.additionalFare * 100),
        airportFare: Math.round((fareEstimate.airportFare || 0) * 100),
        totalFare: Math.round(calculateVehicleFare(fareEstimate.totalFare, selectedVehicleType) * 100),
        paymentMethod: "CASH" as const,
        routeData: routeData ? {
          coordinates: routeData.coordinates,
          distance: routeData.distance,
          duration: routeData.duration,
        } : undefined,
        specialRequests: `Operator booking for ${passengerName}`,
        tripType: "INSTANT" as const,
      };

      // Create order
      const createResponse = await fetch(`${backendUrl}/api/orders/operator/create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || "Failed to create order");
      }
      
      const createResult = await createResponse.json();
      const orderId = createResult.data.id;

      // Step 2: Assign driver
      const assignData = {
        driverId: selectedDriverId,
        fleetId: selectedFleetId,
        reason: `Assigned by operator to driver from available list`,
      };

      const assignResponse = await fetch(`${backendUrl}/api/orders/operator/${orderId}/assign`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(assignData),
      });

      if (!assignResponse.ok) {
        const errorData = await assignResponse.json();
        throw new Error(errorData.message || "Failed to assign driver");
      }

      const assignResult = await assignResponse.json();
      
      return { 
        order: createResult.data, 
        assignedOrder: assignResult.data,
        orderData 
      };
    },
    onSuccess: (data) => {
      toast.success("Pesanan Berhasil Dibuat!", {
        description: `Order ${data.order?.orderNumber || ''} telah dibuat dan driver ${availableDrivers.find(d => d.driver.id === selectedDriverId)?.driver.name} telah ditugaskan.`,
        duration: 5000,
      });
      
      // Reset form
      setPassengerName("");
      setPassengerPhone("");
      setSelectedDriverId(null);
      setSelectedFleetId(null);
      
      onBookRide(data.orderData);
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

  // Handle driver selection
  const handleDriverSelect = (driverId: string, fleetId: string) => {
    setSelectedDriverId(driverId);
    setSelectedFleetId(fleetId);
  };

  const isBookDisabled =
    !selectedDestination ||
    !currentLocation ||
    bookRideMutation.isPending ||
    isCalculatingRoute ||
    passengerName.trim() === "" ||
    passengerPhone.trim() === "" ||
    !selectedDriverId ||
    !selectedFleetId;

  return (
    <>
      <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 h-[400px]" data-testid="enhanced-booking-panel">
        {/* Drag Handle */}
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
                    {availableDrivers.length} driver tersedia untuk {VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchDrivers();
                  refreshDriverLocations();
                }}
                disabled={loadingDrivers}
                className="h-8 px-3 text-xs"
              >
                {loadingDrivers ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Users className="h-3 w-3 mr-1" />
                )}
                Refresh
              </Button>
            </div>
            
            {driversError && (
              <div className="mt-2 text-xs text-red-600">
                Error loading drivers: {driversError.message}
              </div>
            )}
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
                  {selectedPickup ? selectedPickup.name : "Dari mana?"}
                </p>
                {selectedPickup && (
                  <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
                    {selectedPickup.address}
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
                  {selectedDestination ? selectedDestination.name : "Mau ke mana?"}
                </p>
                {selectedDestination && (
                  <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
                    {selectedDestination.address}
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
                          {availableDrivers.filter(d => d.fleet.vehicleType === vehicle.id).length} driver tersedia
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

            {/* Available Drivers Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Pilih Driver Tersedia ({availableDrivers.filter(d => d.fleet.vehicleType === selectedVehicleType).length} driver)
              </label>
              
              {loadingDrivers ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-gray-500">Memuat driver tersedia...</span>
                </div>
              ) : availableDrivers.filter(d => d.fleet.vehicleType === selectedVehicleType).length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {availableDrivers
                    .filter(d => d.fleet.vehicleType === selectedVehicleType)
                    .map((driver) => (
                      <div
                        key={driver.driver.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedDriverId === driver.driver.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        onClick={() => handleDriverSelect(driver.driver.id, driver.fleet.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900">{driver.driver.name}</p>
                              {driver.driver.driverProfile.isVerified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                                <span className="text-xs text-gray-600">
                                  {driver.driver.driverProfile.rating.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">
                              {driver.fleet.brand} {driver.fleet.model} • {driver.fleet.plateNumber} • {driver.fleet.color}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-gray-400">
                                {driver.driver.driverProfile.completedTrips} trips selesai
                              </span>
                              {driver.distance && (
                                <span className="text-xs text-gray-400">
                                  {driver.distance.toFixed(1)} km dari pickup
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2">
                            <div className={`w-3 h-3 rounded-full ${
                              driver.driver.driverProfile.driverStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                            }`}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">Tidak ada driver {VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name} yang tersedia saat ini</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => refetchDrivers()}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Coba Lagi
                  </Button>
                </div>
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Base fare</span>
                <span className="text-sm" data-testid="text-base-fare">
                  {formatCurrency(fareEstimate.baseFare)}
                </span>
              </div>
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
              
              {selectedDriverId && (
                <div className="mt-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Driver yang dipilih</span>
                    <span className="text-sm font-medium text-gray-900">
                      {availableDrivers.find(d => d.driver.id === selectedDriverId)?.driver.name}
                    </span>
                  </div>
                </div>
              )}
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
                : loadingDrivers
                  ? "Loading drivers..."
                  : selectedDestination && currentLocation && fareEstimate
                    ? selectedDriverId
                      ? `Book dengan ${availableDrivers.find(d => d.driver.id === selectedDriverId)?.driver.name} • ${formatCurrency(getVehiclePrice(fareEstimate.totalFare, selectedVehicleType))}`
                      : `Pilih Driver • ${formatCurrency(getVehiclePrice(fareEstimate.totalFare, selectedVehicleType))}`
                    : !currentLocation
                      ? "Getting your location..."
                      : "Choose destination to book"
            }
          </Button>
        </ScrollArea>
      </div>

      {/* Enhanced Confirmation Dialog with Real Driver Data */}
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
                  <p><strong>Dari :</strong> {selectedPickup?.address || "Lokasi Saat Ini"}</p>
                  <p><strong>Tujuan :</strong> {selectedDestination?.address}</p>
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
                    <div className="flex justify-between">
                      <strong>Jarak Tempuh (KM)</strong>
                      <span>{(routeData ? routeData.distance : fareEstimate.distance).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Tarif Per KM</strong>
                      <span>Rp {fareEstimate.additionalKm > 0 ? Math.round(fareEstimate.additionalFare / fareEstimate.additionalKm).toLocaleString() : '0'}</span>
                    </div>
                    <div className="flex justify-between ml-auto w-1/2 border-t pt-1">
                      <strong>Subtotal</strong>
                      <strong>Rp {fareEstimate.additionalFare.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <strong>Tarif Dasar</strong>
                      <span>Rp {fareEstimate.baseFare.toLocaleString()}</span>
                    </div>
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

              {/* Enhanced Driver Info with Real Data */}
              {selectedDriverId && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <h4 className="font-semibold text-sm text-gray-900 mb-2">Driver & Kendaraan :</h4>
                  {(() => {
                    const selectedDriver = availableDrivers.find(d => d.driver.id === selectedDriverId);
                    if (!selectedDriver) return <p className="text-xs">Driver tidak ditemukan</p>;
                    
                    return (
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <strong>{selectedDriver.driver.name}</strong>
                          {selectedDriver.driver.driverProfile.isVerified && (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span>{selectedDriver.driver.driverProfile.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <p><strong>Nomor HP:</strong> {selectedDriver.driver.phone}</p>
                        <p><strong>Kendaraan:</strong> {selectedDriver.fleet.brand} {selectedDriver.fleet.model}</p>
                        <p><strong>Plat Nomor:</strong> {selectedDriver.fleet.plateNumber}</p>
                        <p><strong>Warna:</strong> {selectedDriver.fleet.color}</p>
                        <p><strong>Total Trip:</strong> {selectedDriver.driver.driverProfile.completedTrips} trip selesai</p>
                        {selectedDriver.distance && (
                          <p><strong>Jarak dari Pickup:</strong> {selectedDriver.distance.toFixed(1)} km</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* System Notes */}
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 italic">
                  <strong>Catatan:</strong> Penumpang akan dibebankan biaya tunggu sebesar Rp 45.000 apabila singgah lebih dari 15 menit atau merubah tujuan perjalanan dalam kota Pekanbaru.
                </p>
              </div>

              <p className="text-gray-600 text-xs text-center border-t pt-2">
                Konfirmasi pesanan akan dikirim melalui WhatsApp ke nomor penumpang dan driver akan segera dihubungi.
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