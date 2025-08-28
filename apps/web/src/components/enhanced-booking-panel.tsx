"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Car, MapPin, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import { VEHICLE_TYPES, calculateVehicleFare } from "@/lib/vehicle-types";
import { formatCurrency } from "@/lib/format-currency";
import type { Location } from "@/lib/types";
import type { VehicleType } from "@prisma/client";
import { ScrollArea } from "./ui/scroll-area";

interface EnhancedBookingPanelProps {
  currentLocation: Coordinates | null;
  selectedDestination?: Location | null;
  onDestinationClick: () => void;
  onPickupClick: () => void;
  onBookRide: (rideData: any) => void;
  onRouteCalculated?: (route: RouteResult) => void;
  selectedPickup?: Location | null;
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
  selectedPickup
}: EnhancedBookingPanelProps) {
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType>("ECONOMY");
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const lastRouteCalculationRef = useRef<string>("");

  // NEW: passenger inputs
  const [passengerName, setPassengerName] = useState<string>("");
  const [passengerPhone, setPassengerPhone] = useState<string>("");

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

        console.log('📍 Route calculated:', route);
        
        // Validate route data
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
        
        // Clear route data on error
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

      const rideData = {
        pickupAddress: selectedPickup?.address || "Lokasi Saat Ini",
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        dropoffAddress: selectedDestination.address,
        dropoffLat: selectedDestination.lat,
        dropoffLng: selectedDestination.lng,
        requestedVehicleType: selectedVehicleType,
        distanceMeters: Math.round(fareEstimate.distance * 1000),
        estimatedDurationMinutes: routeData?.duration || Math.round(fareEstimate.distance * 2.5),
        baseFare: Math.round(fareEstimate.baseFare * 100), // Convert to cents
        distanceFare: Math.round(fareEstimate.additionalFare * 100),
        airportFare: Math.round((fareEstimate.airportFare || 0) * 100),
        totalFare: Math.round(finalFare * 100),
        paymentMethod: "CASH" as const,
        passengerName: "Guest User", // In real app, get from auth
        passengerPhone: "08123456789", // In real app, get from auth
        routeData: routeData, // Pass route data to the booking
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rideData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Booking failed:", errorData);
        throw new Error(errorData.message || "Failed to book ride");
      }
      return { rideData, response: await response.json() };
    },
    onSuccess: (data) => {
      toast.success("Ride Booked!", {
        description: "Your driver is on the way",
      });
      onBookRide(data.rideData);
    },
    onError: (error) => {
      toast.error("Booking Failed", {
        description: "Please try again",
      });
    },
  });

  const getVehiclePrice = (basePrice: number, vehicleId: VehicleType) => {
    return calculateVehicleFare(basePrice, vehicleId);
  };

  const handleBookRide = () => {
    if (selectedDestination && fareEstimate && currentLocation) {
      bookRideMutation.mutate();
    }
  };

  // disable if missing required data or ongoing ops
  const isBookDisabled =
    !selectedDestination ||
    !currentLocation ||
    bookRideMutation.isPending ||
    isCalculatingRoute ||
    passengerName.trim() === "" ||
    passengerPhone.trim() === "";

  return (
    <div className="bg-white rounded-t-3xl shadow-2xl relative z-10 h-[560px]" data-testid="enhanced-booking-panel">
      {/* Drag Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
      </div>

      <ScrollArea className="p-6 pb-8 h-full">
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
          {/* Pickup */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-start p-4 rounded-xl h-auto"
            onClick={onPickupClick}
            data-testid="button-select-pickup"
          >
            <MapPin className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
            <div className="flex flex-col items-start w-full min-w-0">
            <p
                className={`font-medium w-full break-words whitespace-normal text-start ${
                selectedPickup ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {selectedPickup ? selectedPickup.name : "Dari mana?"}
            </p>
            {selectedPickup && (
              <p className="text-xs text-gray-500 w-full break-words whitespace-normal text-start">
                {selectedPickup.address}
              </p>
            )}
            </div>
          </Button>

          {/* Destination */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-start p-4 rounded-xl h-auto"
            onClick={onDestinationClick}
            data-testid="button-select-destination"
          >
            <MapPin className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
            <div className="flex flex-col items-start w-full min-w-0">
            <p
                className={`font-medium w-full break-words whitespace-normal text-start ${
                selectedDestination ? "text-gray-900" : "text-gray-400"
              }`}
            >
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
                        {vehicle.features.slice(0, 2).join(" • ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900" data-testid={`text-${vehicle.id}-price`}>
                        {fareEstimate ? formatCurrency(getVehiclePrice(fareEstimate.totalFare, vehicle.id)) : "..."}
                      </p>
                      <p className="text-xs text-gray-500">{vehicle.estimatedArrival}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NEW: Passenger Info Inputs */}
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
          </div>
        )}

        {/* Book Ride Button */}
        <Button 
          className="w-full bg-gray-900 text-white py-4 rounded-xl font-semibold disabled:bg-gray-300 disabled:text-gray-500 h-auto hover:bg-gray-800"
          disabled={isBookDisabled}
          onClick={handleBookRide}
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
  );
}