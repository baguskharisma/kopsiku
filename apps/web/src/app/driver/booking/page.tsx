"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { gpsService, type Coordinates } from "@/lib/gps-service";
import type { Location } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

import EnhancedBookingPanel from "@/components/enhanced-booking-panel";
import GPSLocationPicker from "@/components/gps-location-picker";
import LiveRideTracking from "@/components/live-ride-tracking";
import LeafletMap from "@/components/leaflet-map";
import BottomNavigation from "@/components/bottom-navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Car } from "lucide-react";

export default function DriverBookingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Location | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<Location | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showRideTracking, setShowRideTracking] = useState(false);
  const [rideData, setRideData] = useState<any>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(true);

  // Redirect if not authenticated or not a driver
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      if (user?.role !== 'DRIVER') {
        router.push('/');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

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

    if (isAuthenticated && user?.role === 'DRIVER') {
      initializeLocation();
    }
  }, [isAuthenticated, user]);

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

  const handleRouteCalculated = (route: any) => {
    setRouteData(route);
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if not authenticated or not a driver
  if (!isAuthenticated || user?.role !== 'DRIVER') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Access denied. This page is only accessible to authenticated drivers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative h-screen overflow-hidden">
        <Toaster />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Car className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Driver Booking</h1>
                <p className="text-sm text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium text-green-600">Active</p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="absolute inset-0 pt-20 pb-[400px]">
          <LeafletMap
            center={currentLocation}
            onLocationUpdate={handleLocationUpdate}
            selectedDestination={selectedDestination}
            selectedPickup={selectedPickup}
            route={routeData}
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
            onRouteCalculated={handleRouteCalculated}
            operatorId={user.id}
            operatorRole="DRIVER"
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

      {showRideTracking && rideData && (
        <LiveRideTracking
          onBack={() => setShowRideTracking(false)}
          currentLocation={currentLocation}
          destination={selectedDestination}
          rideData={rideData}
        />
      )}
    </QueryClientProvider>
  );
}