"use client";

import { useState, useEffect, useRef } from "react";
import { Car, MapPin, Route, Users, Wifi, WifiOff, MessageCircle, Download, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import { VEHICLE_TYPES, calculateVehicleFare } from "@/lib/vehicle-types";
import { formatCurrency } from "@/lib/format-currency";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { calculateFare } from "@/lib/fare-calculator";
import type { Location } from "@/lib/types";
import type { VehicleType } from "@prisma/client";

// Types
interface DriverOption {
  id: string;
  name: string;
  plate: string;
  phone: string;
  vehicleType?: VehicleType;
  fleetId?: string;
  rating?: number;
  status?: string;
  currentLocation?: {
    lat?: number | null;
    lng?: number | null;
  };
}

interface EnhancedBookingPanelProps {
  currentLocation: Coordinates | null;
  selectedDestination?: Location | null;
  onDestinationClick: () => void;
  onPickupClick: () => void;
  onRouteCalculated?: (route: RouteResult) => void;
  selectedPickup?: Location | null;
  operatorId: string;
  operatorRole: 'ADMIN' | 'SUPER_ADMIN' | 'DRIVER';
}

interface FareEstimate {
  distance: number;
  baseFare: number;
  additionalFare: number;
  totalFare: number;
  additionalKm: number;
  airportFare?: number;
}

// Helper Functions
function buildFarePayload(
  distanceKm: number,
  pickupAddress: string,
  destinationAddress: string,
  selectedVehicleType: VehicleType
) {
  if (distanceKm <= 0) {
    throw new Error("Invalid distance for fare calculation");
  }

  const fareResult = calculateFare(distanceKm, pickupAddress, destinationAddress);

  const actualBaseFare = fareResult.baseFare;
  const actualDistanceFare = fareResult.additionalFare - fareResult.baseFare;
  const actualAirportFare = fareResult.airportFare;
  const actualTotalFare = fareResult.totalFare;

  const baseCents = Math.round(actualBaseFare * 100);
  const distanceCents = Math.round(actualDistanceFare * 100);
  const airportCents = Math.round(actualAirportFare * 100);
  const totalCents = Math.round(actualTotalFare * 100);

  // Apply vehicle type multiplier
  const finalFareCurrency = calculateVehicleFare(actualTotalFare, selectedVehicleType);

  return {
    baseCents,
    distanceCents,
    airportCents,
    totalCents,
    finalFareCurrency,
    farePerKm: fareResult.farePerKm,
    additionalKm: fareResult.additionalKm,
  };
}

export default function EnhancedBookingPanel({ 
  currentLocation, 
  selectedDestination, 
  onDestinationClick, 
  onPickupClick,
  onRouteCalculated,
  selectedPickup,
  operatorId,
  operatorRole,
}: EnhancedBookingPanelProps) {
  // State Management
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>("ECONOMY");
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const lastRouteCalculationRef = useRef<string>("");

  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const [passengerName, setPassengerName] = useState<string>("");
  const [passengerPhone, setPassengerPhone] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Dialog states
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [driverMessageSent, setDriverMessageSent] = useState(false);
  const [customerMessageSent, setCustomerMessageSent] = useState(false);
  const [lastOrderData, setLastOrderData] = useState<any>(null);

  // Real-time notifications
  const { 
    isConnected, 
    connectedDrivers, 
    refreshDriverLocations,
  } = useRealtimeNotifications({
    userRole: operatorRole,
    userId: operatorId,
    enableToasts: true,
    enableSounds: true,
  });

  // Helper Functions
  const computeDurationEstimate = (routeData: RouteResult | null, fareEstimate: FareEstimate | null) => {
    const routeDuration = routeData && typeof routeData.duration === 'number' && !Number.isNaN(routeData.duration)
      ? Math.round(routeData.duration)
      : null;

    if (routeDuration !== null) {
      return routeDuration;
    }

    const distanceKm = fareEstimate && typeof fareEstimate.distance === 'number' && !Number.isNaN(fareEstimate.distance)
      ? fareEstimate.distance
      : 0;

    return Math.max(1, Math.round(distanceKm * 2.5));
  };

  const getVehiclePrice = (basePrice: number, vehicleId: VehicleType) => {
    return calculateVehicleFare(basePrice, vehicleId);
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
        from: selectedPickup?.display_name || selectedPickup?.name || "Lokasi Saat Ini",
        to: selectedDestination?.display_name || selectedDestination?.name || "Lokasi Saat Ini",
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

  const generateDriverWhatsAppMessage = (orderData: any, tripDetails: any) => {
    const currentDate = new Date();
    const timeString = currentDate.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    return `*ORDER BARU - KOPSI PEKANBARU*
${timeString}

Selamat! Anda mendapat order baru.

*DETAIL ORDER*
• No. Order: ${orderData.orderNumber}
• Status: DRIVER_ASSIGNED
• Jenis: ${VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name}

*PENUMPANG*
• Nama: ${tripDetails.passengerName}
• HP: ${tripDetails.passengerPhone}

*PERJALANAN*
• Dari: ${tripDetails.pickupAddress}
• Tujuan: ${tripDetails.dropoffAddress}
• Jarak: ${routeData ? routeData.distance.toFixed(1) : fareEstimate?.distance.toFixed(1)} km
• Estimasi: ${routeData ? Math.round(routeData.duration) : Math.round((fareEstimate?.distance || 0) * 2.5)} menit

*TARIF*
• Total: ${formatCurrency(calculateVehicleFare(fareEstimate?.totalFare || 0, selectedVehicleType))}
• Pembayaran: Tunai

Semoga perjalanan lancar!
*KOPSI PEKANBARU*`;
  };

  // API Functions
  const fetchAvailableDrivers = async (vehicleType?: VehicleType) => {
    setLoadingDrivers(true);
    try {
      const response = await fetch(`/api/drivers?vehicleType=${vehicleType || 'ECONOMY'}`);
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
          const drivers = result.data.map((driver: any) => ({
            id: driver.id,
            name: driver.name,
            plate: driver.plate || driver.fleets?.[0]?.plateNumber || 'N/A',
            phone: driver.phone,
            vehicleType: driver.vehicleType || driver.fleets?.[0]?.vehicleType,
            fleetId: driver.fleetId || driver.fleets?.[0]?.id,
            rating: driver.rating || 0,
            status: driver.status || 'UNKNOWN',
            currentLocation: driver.currentLocation,
          }));
          
          setAvailableDrivers(drivers);

          if (drivers.length === 0) {
            toast.info("Debug Info", {
              description: `Backend mengembalikan 0 drivers untuk ${vehicleType}. Cek console untuk detail.`,
              duration: 6000,
            });
          } else {
            toast.success("Drivers Loaded", {
              description: `${drivers.length} driver ditemukan`,
              duration: 2000,
            });
          }
        } else {
          toast.error("Error", {
            description: "Format response API tidak valid",
          });
        }
      } else {
        toast.error("Error", {
          description: `API error: ${response.status}`,
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "Network error saat memuat driver",
      });
    } finally {
      setLoadingDrivers(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchAvailableDrivers(selectedVehicleType);
  }, [selectedVehicleType]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshDriverLocations();
    }, 30000);

    refreshDriverLocations();
    return () => clearInterval(interval);
  }, [refreshDriverLocations]);

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

  // Enhanced function to download receipt as PNG
  const handleDownloadReceipt = async () => {
    const receiptData = generateReceiptData();

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
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, width, tempCanvas.height);

      let yPos = 18 * SCALE;
      const leftMargin = 12 * SCALE;
      const rightMargin = width - 12 * SCALE;
      const contentWidth = width - leftMargin - 12 * SCALE;

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

      const wrapText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        size: number = FS_SM,
        lineHeight: number = Math.round(FS_MD + (8 * SCALE)),
        align: 'left' | 'center' | 'right' = 'left'
      ) => {
        tempCtx.font = fontStr(size, 'normal');
        tempCtx.textAlign = align;
        const words = text.split(' ');
        let line = '';
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = tempCtx.measureText(testLine);
          if (metrics.width > maxWidth && line !== '') {
            tempCtx.fillText(line.trim(), x, y);
            line = words[i] + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        if (line) {
          tempCtx.fillText(line.trim(), x, y);
          y += lineHeight;
        }
        return y;
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

        tempCtx.font = fontStr(keySize, 'bold');
        tempCtx.textAlign = 'left';
        tempCtx.fillStyle = '#000000';
        tempCtx.fillText(key, leftMargin, y);

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

      // --- START DRAW ---
      tempCtx.fillStyle = '#000000';
      yPos = drawText(receiptData.date, leftMargin, yPos, FS_XS, 'normal', 'left');
      tempCtx.font = fontStr(FS_XS, 'normal');
      tempCtx.textAlign = 'right';
      tempCtx.fillText(receiptData.time, rightMargin, yPos - (Math.round(FS_XS) + LINE_GAP));
      tempCtx.textAlign = 'left';

      yPos += 6 * SCALE;
      const logoImg = await loadLogoImage();
      const logoSize = 48 * SCALE;
      tempCtx.drawImage(logoImg, width / 2 - logoSize / 2, yPos, logoSize, logoSize);
      yPos += logoSize + (12 * SCALE) + EXTRA_LOGO_TITLE_GAP;

      yPos = drawText('KOPSI PEKANBARU', width / 2, yPos, FS_BOLD_MD, 'bold', 'center');
      yPos += 6 * SCALE;

      yPos = drawLine(yPos);

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

      yPos = drawText('Detail Penumpang:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      yPos = drawKeyValue('Nama', receiptData.passenger.name, yPos, {
        keySize: FS_BOLD_SM,
        valueSize: FS_MD,
        valueLineHeight: Math.round(FS_MD + (10 * SCALE)),
      });

      yPos = drawKeyValue('HP', receiptData.passenger.phone, yPos, {
        keySize: FS_BOLD_SM,
        valueSize: FS_MD,
        valueLineHeight: Math.round(FS_MD + (10 * SCALE)),
      });

      yPos += 8 * SCALE;
      yPos = drawLine(yPos);

      yPos = drawText('Detail Tarif:', leftMargin, yPos, FS_BOLD_SM, 'bold');
      yPos += 8 * SCALE;

      tempCtx.font = fontStr(FS_BOLD_SM, 'bold');
      tempCtx.textAlign = 'left';
      tempCtx.fillText('Subtotal', leftMargin, yPos);
      tempCtx.textAlign = 'right';
      tempCtx.fillText(`Rp ${Math.round(receiptData.fare.subTotal).toLocaleString()}`, rightMargin, yPos);
      yPos += (20 * SCALE);

      yPos += EXTRA_BLOCK_GAP;

      yPos = drawKeyValue('Airport Charge', `Rp ${receiptData.fare.airportCharge.toLocaleString()}`, yPos, {
        keySize: FS_BOLD_SM,
        valueSize: FS_MD,
        valueLineHeight: Math.round(FS_MD + (10 * SCALE)),
      });

      yPos += 8 * SCALE;
      yPos = drawLine(yPos);
      yPos += 10 * SCALE;

      tempCtx.font = fontStr(28 * SCALE, 'bold');
      tempCtx.textAlign = 'left';
      tempCtx.fillText('TOTAL', leftMargin, yPos);
      tempCtx.textAlign = 'right';
      tempCtx.fillText(`Rp ${receiptData.totalFare.toLocaleString()}`, rightMargin, yPos);
      yPos += (28 * SCALE);

      if (receiptData.driver) {
        yPos = drawText('Informasi Driver:', leftMargin, yPos, FS_BOLD_SM, 'bold');
        yPos = drawText(`Nama: ${receiptData.driver.name}`, leftMargin, yPos, FS_SM, 'normal');
        yPos = drawText(`Plat: ${receiptData.driver.plate}`, leftMargin, yPos, FS_SM, 'normal');
        yPos = drawText(`HP: ${receiptData.driver.phone}`, leftMargin, yPos, FS_SM, 'normal');
        yPos += 12 * SCALE;
      }

      yPos += 12 * SCALE;
      const qrSize = 96 * SCALE;
      const qrX = width / 2 - qrSize / 2;
      try {
        const qrImg = await loadQRImage();
        tempCtx.drawImage(qrImg, qrX, yPos, qrSize, qrSize);
      } catch (error) {
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
      yPos = wrapText(noteText, leftMargin, yPos, contentWidth, 12 * SCALE, Math.round(14 * SCALE), 'left');
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

  // Booking Functions
  const handleBookRideClick = async () => {
    setIsBookingInProgress(true);
    
    try {
      const pickupLocation = selectedPickup ? { lat: selectedPickup.lat, lng: selectedPickup.lng } : currentLocation;

      if (!selectedDestination || !fareEstimate || !pickupLocation) {
        toast.error("Data tidak lengkap", {
          description: "Pastikan semua data sudah terisi dengan benar",
        });
        setIsBookingInProgress(false);
        return;
      }

      const distanceKm = Number(fareEstimate.distance ?? 0);
      if (distanceKm <= 0) {
        toast.error("Error Kalkulasi Jarak", {
          description: "Jarak perjalanan tidak valid. Silakan pilih ulang lokasi.",
        });
        setIsBookingInProgress(false);
        return;
      }

      const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);
      const pickupAddr = selectedPickup?.address || "Lokasi Saat Ini";
      const destinationAddr = selectedDestination.address;

      let farePayload;
      try {
        farePayload = buildFarePayload(distanceKm, pickupAddr, destinationAddr, selectedVehicleType);
      } catch (error) {
        toast.error("Error Kalkulasi Tarif", {
          description: "Terjadi kesalahan saat menghitung tarif. Silakan coba lagi.",
        });
        setIsBookingInProgress(false);
        return;
      }

      const cleanedPhone = passengerPhone.replace(/[\s\-\+]/g, '').replace(/^0/, '62');
      if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
        toast.error("Nomor HP Tidak Valid", {
          description: "Nomor HP harus antara 10-15 digit",
        });
        setIsBookingInProgress(false);
        return;
      }

      const orderData = {
        passengerName: passengerName.trim(),
        passengerPhone: cleanedPhone,
        pickupAddress: pickupAddr.substring(0, 500),
        pickupCoordinates: {
          lat: Number(pickupLocation.lat),
          lng: Number(pickupLocation.lng),
        },
        dropoffAddress: destinationAddr.substring(0, 500),
        dropoffCoordinates: {
          lat: Number(selectedDestination.lat),
          lng: Number(selectedDestination.lng),
        },
        requestedVehicleType: selectedVehicleType,
        distanceMeters: Math.round(distanceKm * 1000),
        estimatedDurationMinutes: Math.round(computeDurationEstimate(routeData, fareEstimate)),
        baseFare: Math.round(farePayload.baseCents),      // Tidak dibagi 100
        distanceFare: Math.round(farePayload.distanceCents), // Tidak dibagi 100
        airportFare: farePayload.airportCents > 0 ? Math.round(farePayload.airportCents) : undefined,
        totalFare: Math.round(farePayload.totalCents),    // Tidak dibagi 100
        paymentMethod: "CASH" as const,
        specialRequests: operatorRole !== 'DRIVER' && selectedDriverId ?
          `Preferred driver: ${selectedDriver?.name} (${selectedDriver?.plate})`.substring(0, 1000) :
          operatorRole === 'DRIVER' ? 'Driver auto-assignment' : undefined,
      };

      toast.loading("Membuat pesanan...", { id: "creating-order" });
      
      const orderResponse = await fetch("/api/orders/operator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      const orderResult = await orderResponse.json();
      const orderId = orderResult.data.id;

      toast.success("Order berhasil dibuat!", { id: "creating-order" });

      let finalOrderData = orderResult.data;

      // Only assign driver manually if user is not DRIVER role (DRIVER role auto-assigns on backend)
      if (operatorRole !== 'DRIVER' && selectedDriverId && selectedDriver && selectedDriver.fleetId) {
        toast.loading("Menugaskan driver...", { id: "assigning-driver" });

        try {
          const assignResponse = await fetch(`/api/orders/operator/${orderId}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              driverId: selectedDriverId,
              fleetId: selectedDriver.fleetId,
              reason: `Driver assigned by operator to ${passengerName}`,
            }),
          });

          if (assignResponse.ok) {
            const assignResult = await assignResponse.json();
            finalOrderData = assignResult.data;
            toast.success("Driver berhasil ditugaskan!", { id: "assigning-driver" });
          } else {
            const assignErrorData = await assignResponse.json();
            toast.error("Gagal menugaskan driver", {
              id: "assigning-driver",
              description: assignErrorData.message || "Driver assignment failed"
            });
          }
        } catch (assignError) {
          toast.error("Gagal menugaskan driver", {
            id: "assigning-driver",
            description: assignError instanceof Error ? assignError.message : "Unknown error"
          });
        }
      } else if (operatorRole === 'DRIVER') {
        // For DRIVER role, the order is auto-completed
        toast.success("Order berhasil dibuat dan otomatis selesai! Status Anda tetap ACTIVE.", { id: "creating-order" });
      } else if (operatorRole === 'ADMIN') {
        // For ADMIN role, the order is also auto-completed
        toast.success("Order berhasil dibuat dan otomatis selesai!", { id: "creating-order" });
      }
      
      setLastOrderData({ 
        orderResult: finalOrderData, 
        tripData: orderData, 
        driver: selectedDriver,
        cleanedPhone: cleanedPhone
      });
      
      setShowBookingDialog(true);
    } catch (error) {
      console.error("Error creating order:", error);
      
      toast.dismiss("creating-order");
      toast.dismiss("assigning-driver");
      
      toast.error("Gagal Membuat Order", {
        description: error instanceof Error ? error.message : "Silakan coba lagi",
        duration: 5000,
      });
    } finally {
      setIsBookingInProgress(false);
    }
  };

  // WhatsApp Functions
  const sendToDriver = () => {
    if (!lastOrderData?.driver) return;
    
    const driverMessage = generateDriverWhatsAppMessage(lastOrderData.orderResult, lastOrderData.tripData);
    const driverPhone = lastOrderData.driver.phone.replace(/[\s\-\+]/g, '').replace(/^0/, '62');
    const driverWhatsAppUrl = `https://wa.me/${driverPhone}?text=${encodeURIComponent(driverMessage)}`;
    window.open(driverWhatsAppUrl, '_blank');
    
    setDriverMessageSent(true);
    toast.success("Template pesan driver telah disiapkan!", {
      description: `Pesan order dikirim ke ${lastOrderData.driver.name}`,
    });
  };

  const sendToCustomer = () => {
    if (!lastOrderData) return;
    
    const customerWhatsAppUrl = `https://wa.me/${lastOrderData.cleanedPhone}`;
    window.open(customerWhatsAppUrl, '_blank');
    
    setCustomerMessageSent(true);
    toast.success("WhatsApp customer dibuka!", {
      description: "Silakan kirim pesan konfirmasi manual ke customer",
    });
  };

  const resetForm = () => {
    setShowBookingDialog(false);
    setPassengerName("");
    setPassengerPhone("");
    setSelectedDriverId(null);
    setDriverMessageSent(false);
    setCustomerMessageSent(false);
    setLastOrderData(null);
    fetchAvailableDrivers(selectedVehicleType);
  };

  const isBookDisabled =
    !selectedDestination ||
    !currentLocation ||
    isCalculatingRoute ||
    passengerName.trim() === "" ||
    passengerPhone.trim() === "" ||
    isBookingInProgress;

  return (
    <>
      <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 h-[400px]" data-testid="enhanced-booking-panel">
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        <ScrollArea className="p-6 pb-8 h-full">
          {/* Connection Status & Driver Info */}
          {/* <div className="bg-gray-50 rounded-xl p-3 mb-4">
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
          </div> */}

          {/* Route Info */}
          {routeData && routeData.coordinates && Array.isArray(routeData.coordinates) && routeData.coordinates.length > 1 && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4" data-testid="route-info">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Route className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">Estimasi perjalanan</p>
                    <p className="text-sm text-gray-500">
                      {routeData.distance.toFixed(1)} km | {Math.round(routeData.duration)} min
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
                  {selectedPickup?.display_name ?? selectedPickup?.name ?? "Dari mana?"}
                </p>
                {selectedPickup && (
                  <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
                    {selectedPickup.formatted_address ?? selectedPickup.address}
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
                  {selectedDestination?.display_name ?? selectedDestination?.name ?? "Mau ke mana?"}
                </p>
                {selectedDestination && (
                  <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
                    {selectedDestination.formatted_address ?? selectedDestination.address}
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
                          {vehicle.features.slice(0, 2).join(" | ")}
                        </p>
                      </div>
                      {/* {fareEstimate && (
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(getVehiclePrice(fareEstimate.totalFare, vehicle.id))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {vehicle.multiplier > 1 && `${vehicle.multiplier}x`}
                          </p>
                        </div>
                      )} */}
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

            {/* Driver Selection - Hidden for DRIVER role */}
            {operatorRole !== 'DRIVER' && (
              <div>
                <label htmlFor="driver-select" className="text-sm font-medium text-gray-700 block mb-1">
                  Driver yang tersedia {loadingDrivers && "(Loading...)"}
                </label>
                <select
                  id="driver-select"
                  data-testid="select-driver"
                  value={selectedDriverId || ""}
                  onChange={(e) => setSelectedDriverId(e.target.value || null)}
                  className="w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={loadingDrivers}
                >
                  <option value="">Pilih Driver</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} | {d.plate}
                    </option>
                  ))}
                </select>
                {availableDrivers.length === 0 && !loadingDrivers && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tidak ada driver tersedia untuk kendaraan {VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name}
                  </p>
                )}
                {loadingDrivers && (
                  <p className="text-xs text-blue-500 mt-1">Memuat data driver...</p>
                )}
              </div>
            )}

            {/* Auto-completion info for DRIVER role */}
            {/* {operatorRole === 'DRIVER' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center">
                  <Car className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Auto-Completion Mode</p>
                    <p className="text-xs text-green-600">
                      Order akan otomatis dibuat dengan status "SELESAI" untuk kendaraan {VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name}
                    </p>
                  </div>
                </div>
              </div>
            )} */}
          </div>

          {/* Fare Breakdown */}
          {/* {fareEstimate && (
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
          )} */}

          {/* Book Ride Button */}
          <Button 
            className="w-full bg-gray-900 text-white py-4 mb-4 rounded-xl font-semibold disabled:bg-gray-300 disabled:text-gray-500 h-auto hover:bg-gray-800"
            disabled={isBookDisabled}
            onClick={handleBookRideClick}
            data-testid="button-book-ride"
          >
            {isBookingInProgress
              ? "Memproses pesanan..."
              : isCalculatingRoute
                ? "Calculating route..."
                : selectedDestination && currentLocation && fareEstimate
                  ? `Book ${VEHICLE_TYPES.find(v => v.id === selectedVehicleType)?.name} ${formatCurrency(getVehiclePrice(fareEstimate.totalFare, selectedVehicleType))}`
                  : !currentLocation
                    ? "Getting your location..."
                    : "Choose destination to book"
            }
          </Button>
        </ScrollArea>
      </div>

      {/* Booking Confirmation & Action Dialog */}
      <AlertDialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex justify-between items-center">
              <AlertDialogTitle className="flex items-center text-green-600">
                <Check className="h-5 w-5 mr-2" />
                Order Berhasil Dibuat!
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              Order #{lastOrderData?.orderResult?.orderNumber} telah tercatat di sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {/* Order Details Section */}
          <div className="space-y-4 mb-4">
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
                <p><strong>Dari :</strong> {selectedPickup?.display_name || selectedPickup?.name || "Lokasi Saat Ini"}</p>
                <p><strong>Tujuan :</strong> {selectedDestination?.display_name ?? selectedDestination?.name}</p>
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
                  <div className="flex justify-between ml-auto w-1/2 border-t pt-1">
                    <strong>Subtotal</strong>
                    <strong>Rp {fareEstimate.additionalFare.toLocaleString()}</strong>
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

            {/* Additional Info */}
            {lastOrderData?.driver && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-900 mb-1">Driver yang Ditugaskan :</h4>
                <p className="text-xs">
                  <strong>{lastOrderData.driver.name}</strong> - {lastOrderData.driver.plate}
                </p>
              </div>
            )}

            {/* Auto-completion info for DRIVER role */}
            {operatorRole === 'DRIVER' && lastOrderData?.orderResult && (
              <div className="bg-green-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-900 mb-1">Status Order :</h4>
                <p className="text-xs text-green-700">
                  ✅ Order berhasil dibuat dan otomatis diselesaikan.
                  Status driver Anda tetap: <strong>ACTIVE</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Anda dapat langsung membuat order baru.
                </p>
              </div>
            )}

            {/* Auto-completion info for ADMIN role */}
            {operatorRole === 'ADMIN' && lastOrderData?.orderResult && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="font-semibold text-sm text-gray-900 mb-1">Status Order :</h4>
                <p className="text-xs text-blue-700">
                  ✅ Order berhasil dibuat dan otomatis diselesaikan.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Order langsung berstatus COMPLETED tanpa perlu proses manual.
                </p>
              </div>
            )}

            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 italic">
                <strong>Catatan:</strong> Penumpang akan dibebankan biaya tunggu sebesar Rp 45.000 apabila singgah lebih dari 15 menit atau merubah tujuan perjalanan dalam kota Pekanbaru.
              </p>
            </div>
          </div>
          
          {/* Action Buttons Section */}
          <div className="space-y-3 py-2 border-t pt-4">
            {/* Download Receipt Option */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
              <div className="flex-1">
                <p className="font-medium text-sm">Download Receipt</p>
                <p className="text-xs text-gray-500">Simpan bukti pesanan</p>
              </div>
              <Button
                onClick={handleDownloadReceipt}
                size="sm"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
            
            {/* Step 1: Send to Driver FIRST (if available) */}
            {lastOrderData?.driver && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">1. Kirim ke Driver</p>
                  <p className="text-xs text-gray-500">
                    {lastOrderData.driver.name} - {lastOrderData.driver.plate}
                  </p>
                </div>
                <Button
                  onClick={sendToDriver}
                  size="sm"
                  variant={driverMessageSent ? "outline" : "default"}
                  disabled={driverMessageSent}
                >
                  {driverMessageSent ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Sent
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      WhatsApp
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Step 2: Send to Customer SECOND */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-sm">{lastOrderData?.driver ? '2' : '1'}. Kirim ke Penumpang</p>
                <p className="text-xs text-gray-500">Buka WhatsApp tanpa template pesan</p>
              </div>
              <Button
                onClick={sendToCustomer}
                size="sm"
                variant={customerMessageSent ? "outline" : "default"}
                disabled={customerMessageSent || (lastOrderData?.driver && !driverMessageSent)}
              >
                {customerMessageSent ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={resetForm}>
              Tutup & Buat Order Baru
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}