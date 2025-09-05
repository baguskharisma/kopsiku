"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { gpsService, type Coordinates } from "@/lib/gps-service";
import type { Location } from "@/lib/types";

import EnhancedBookingPanel from "@/components/enhanced-booking-panel";
import GPSLocationPicker from "@/components/gps-location-picker";
import LiveRideTracking from "@/components/live-ride-tracking";
// ðŸ”§ FIX: Import yang benar - gunakan wrapper component, bukan client component langsung
import LeafletMap from "@/components/leaflet-map";
import BottomNavigation from "@/components/bottom-navigation";

export default function TaxiAppMainPage() {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Location | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<Location | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showRideTracking, setShowRideTracking] = useState(false);
  const [rideData, setRideData] = useState<any>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(true);

  // Get initial location on component mount
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        const location = await gpsService.getCurrentPosition();
        setCurrentLocation(location);
      } catch (error) {
        console.error("Failed to get initial location:", error);
      } finally {
        setIsGettingLocation(false);
      }
    };

    initializeLocation();
  }, []);

  const handleLocationUpdate = (coords: Coordinates) => {
    setCurrentLocation(coords);
  };

  const handleDestinationSelect = (location: Location) => {
    setSelectedDestination(location);
    setShowLocationPicker(false);
  };

  const handlePickupSelect = (location: Location) => {
    setSelectedPickup(location);
    setShowPickupPicker(false);
  };

  const handleBookRide = (rideBookingData: any) => {
    setRideData(rideBookingData);
    setShowRideTracking(true);
  };

  const handleBackToMain = () => {
    setShowRideTracking(false);
    setRideData(null);
    setSelectedDestination(null);
    setSelectedPickup(null);
    setRouteData(null);
  };

  const handleRouteCalculated = (route: any) => {
    setRouteData(route);
  };

  if (isGettingLocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col bg-gray-50 relative overflow-hidden max-w-md mx-auto" data-testid="taxi-app-main">
        {/* Header */}
        {/* <header className="bg-white shadow-sm p-4 z-20 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900">Kopsi'Ku</h1>
          </div>
        </header> */}
  
        {/* Content area: map fills remainder */}
        <div className="flex-1 relative min-h-0">
          {/* Map full area */}
          <div className="absolute inset-0 z-0" style={{ pointerEvents: 'auto' }}>
            <LeafletMap
              currentLocation={currentLocation}
              destination={selectedDestination}
              routeData={routeData}
              selectedPickup={selectedPickup}
              onLocationUpdate={handleLocationUpdate}
              className="w-full h-full"
              // Pass pick mode & click handler if you want click-to-select without opening modal
              mapClickMode={showPickupPicker ? "pickup" : showLocationPicker ? "destination" : null}
              onMapClick={async (coords: any, type: any) => {
                // Only accept click if mode active
                if (type === "pickup") {
                  const address = await gpsService.reverseGeocode(coords).catch(() => null);
                  handlePickupSelect({ 
                    id: `map-${Date.now()}`, 
                    lat: coords.lat, 
                    lng: coords.lng, 
                    address: address || `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`, 
                    name: "Pickup Location", 
                    category: "CUSTOM", 
                    icon: "building", 
                    isActive: true, 
                    searchCount: 0, 
                    display_name: "",
                    formatted_address: "",
                    createdAt: new Date(), 
                    updatedAt: new Date() 
                  });
                } else if (type === "destination") {
                  const address = await gpsService.reverseGeocode(coords).catch(() => null);
                  handleDestinationSelect({ 
                    id: `map-${Date.now()}`, 
                    lat: coords.lat, 
                    lng: coords.lng, 
                    address: address || `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`, 
                    name: "Destination", 
                    category: "CUSTOM", 
                    icon: "building", 
                    isActive: true, 
                    searchCount: 0, 
                    display_name: "",
                    formatted_address: "",
                    createdAt: new Date(), 
                    updatedAt: new Date() 
                  });
                }
              }}
            />
          </div>
  
          {/* Booking Panel (bottom sheet) */}
          <div className="absolute left-0 right-0 bottom-0 z-10">
            <EnhancedBookingPanel
              currentLocation={currentLocation}
              selectedDestination={selectedDestination}
              selectedPickup={selectedPickup}
              onDestinationClick={() => setShowLocationPicker(true)}
              onPickupClick={() => setShowPickupPicker(true)}
              onBookRide={handleBookRide}
              onRouteCalculated={handleRouteCalculated} 
              operatorId={""} 
              operatorRole={"ADMIN"}              
            />
          </div>
        </div>
  
        {/* Modals */}
        {showLocationPicker && (
          <GPSLocationPicker
            onClose={() => setShowLocationPicker(false)}
            onSelectDestination={handleDestinationSelect}
            currentLocation={currentLocation}
            mode="destination"
          />
        )}
  
        {showPickupPicker && (
          <GPSLocationPicker
            onClose={() => setShowPickupPicker(false)}
            onSelectDestination={handlePickupSelect}
            currentLocation={currentLocation}
            mode="pickup"
          />
        )}
  
        {showRideTracking && (
          <LiveRideTracking
            onBack={handleBackToMain}
            currentLocation={currentLocation}
            destination={selectedDestination}
            rideData={rideData}
          />
        )}
  
        {/* <Toaster position="top-center" richColors expand duration={4000} /> */}
      </div>
      {/* <BottomNavigation currentTab="home" data-testid="bottom-navigation" /> */}
    </QueryClientProvider>
  );
}