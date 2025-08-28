"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Phone, MessageCircle, Share, AlertTriangle, Check, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import LeafletMap from "./leaflet-map";
import type { Location } from "@/lib/types";

interface LiveRideTrackingProps {
  onBack: () => void;
  currentLocation: Coordinates | null;
  destination?: Location | null;
  rideData?: any;
}

export default function LiveRideTracking({ 
  onBack, 
  currentLocation, 
  destination, 
  rideData 
}: LiveRideTrackingProps) {
  const [userPosition, setUserPosition] = useState<Coordinates | null>(currentLocation);
  const [driverPosition, setDriverPosition] = useState<Coordinates | null>(null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [rideStatus, setRideStatus] = useState<string>("requested");
  const [estimatedArrival, setEstimatedArrival] = useState<number>(3); // minutes
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);

  // Mock driver movement simulation
  const simulateDriverMovement = useCallback(() => {
    if (!userPosition) return;

    // Start driver near user's location but slightly offset
    const initialDriverPos = {
      lat: userPosition.lat + 0.01, // ~1km away
      lng: userPosition.lng + 0.005,
    };

    setDriverPosition(initialDriverPos);

    // Simulate driver moving towards user
    const moveDriver = () => {
      setDriverPosition(prev => {
        if (!prev || !userPosition) return prev;

        const distanceToUser = gpsService.calculateDistance(prev, userPosition);
        
        if (distanceToUser < 0.1) { // Arrived (100m)
          setRideStatus("arrived");
          setEstimatedArrival(0);
          return prev;
        }

        // Move 10% closer to user position each update
        const newLat = prev.lat + (userPosition.lat - prev.lat) * 0.1;
        const newLng = prev.lng + (userPosition.lng - prev.lng) * 0.1;

        // Update estimated arrival based on distance
        const newDistance = gpsService.calculateDistance({ lat: newLat, lng: newLng }, userPosition);
        setEstimatedArrival(Math.max(1, Math.round(newDistance * 2))); // 2 min per km

        return { lat: newLat, lng: newLng };
      });
    };

    // Move driver every 2 seconds
    const interval = setInterval(moveDriver, 2000);
    return () => clearInterval(interval);
  }, [userPosition]);

  // Start GPS tracking
  const startLocationTracking = useCallback(async () => {
    try {
      setIsTrackingLocation(true);
      await gpsService.startWatching();
      
      const unsubscribe = gpsService.onPositionUpdate((position) => {
        setUserPosition(position);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Location tracking error:", error);
      toast.error("Location Tracking", {
        description: "Unable to track your location continuously",
      });
      setIsTrackingLocation(false);
    }
  }, []);

  // Calculate route to destination
  useEffect(() => {
    if (!userPosition || !destination) return;

    const calculateRoute = async () => {
      try {
        const route = await gpsService.getRoute(
          userPosition,
          { lat: destination.lat, lng: destination.lng }
        );
        setRouteData(route);
      } catch (error) {
        console.error("Route calculation error:", error);
      }
    };

    calculateRoute();
  }, [userPosition, destination]);

  // Initialize tracking and driver simulation
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let driverCleanup: (() => void) | undefined;

    const initialize = async () => {
      // Start location tracking
      unsubscribe = await startLocationTracking();
      
      // Start driver simulation
      driverCleanup = simulateDriverMovement();
    };

    initialize();

    return () => {
      if (unsubscribe) unsubscribe();
      if (driverCleanup) driverCleanup();
      gpsService.stopWatching();
    };
  }, [startLocationTracking, simulateDriverMovement]);

  const getStatusInfo = () => {
    switch (rideStatus) {
      case "requested":
        return {
          message: "Looking for driver",
          subMessage: "We're finding the best driver for you",
          color: "bg-amber-600",
        };
      case "confirmed":
        return {
          message: "Driver assigned",
          subMessage: `Estimated arrival: ${estimatedArrival} mins`,
          color: "bg-blue-600",
        };
      case "arrived":
        return {
          message: "Driver has arrived",
          subMessage: "Your driver is waiting for you",
          color: "bg-green-600",
        };
      case "in_progress":
        return {
          message: "On the way",
          subMessage: "Enjoy your ride!",
          color: "bg-green-600",
        };
      default:
        return {
          message: "Driver arriving",
          subMessage: `Estimated arrival: ${estimatedArrival} mins`,
          color: "bg-blue-600",
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleShareTrip = async () => {
    if (navigator.share && userPosition) {
      try {
        await navigator.share({
          title: "Kopsiku",
          text: "",
          url: `https://maps.google.com/?q=${userPosition.lat},${userPosition.lng}`,
        });
      } catch (error) {
        // Fallback to copy link
        try {
          await navigator.clipboard.writeText(`https://maps.google.com/?q=${userPosition.lat},${userPosition.lng}`);
          toast.success("Link Copied", {
            description: "Trip location link copied to clipboard",
          });
        } catch (clipboardError) {
          toast.error("Share Failed", {
            description: "Unable to share trip location",
          });
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-40 transform transition-transform duration-300" data-testid="live-ride-tracking">
      {/* Status Header */}
      <div className={`${statusInfo.color} p-4 text-center`} data-testid="status-header">
        <p className="text-white font-medium" data-testid="text-ride-status">
          {statusInfo.message}
        </p>
        <p className="text-white text-sm opacity-90" data-testid="text-status-time">
          {statusInfo.subMessage}
        </p>
      </div>

      {/* Live Map View */}
      <div className="h-64" data-testid="live-tracking-map">
        <LeafletMap
          currentLocation={userPosition}
          destination={destination}
          driverLocation={driverPosition}
          routeData={routeData}
          showRoute={true}
          className="h-full"
        />
      </div>

      {/* Driver Info Panel */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4" data-testid="driver-info">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">BS</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900" data-testid="text-driver-name">
                  {rideData?.driverName || "Budi Santoso"}
                </p>
                <p className="text-sm text-gray-500" data-testid="text-driver-vehicle">
                  {rideData?.driverVehicle || "Toyota Avanza"} • {rideData?.driverLicensePlate || "B 1234 XYZ"}
                </p>
                {driverPosition && userPosition && (
                  <p className="text-xs text-blue-600" data-testid="text-driver-distance">
                    {gpsService.calculateDistance(driverPosition, userPosition).toFixed(1)} km away
                  </p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                size="icon" 
                variant="outline" 
                className="w-10 h-10 bg-gray-50 rounded-full border-0 hover:bg-gray-100"
                data-testid="button-call-driver"
              >
                <Phone className="h-4 w-4 text-gray-900" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                className="w-10 h-10 bg-gray-50 rounded-full border-0 hover:bg-gray-100"
                data-testid="button-message-driver"
              >
                <MessageCircle className="h-4 w-4 text-gray-900" />
              </Button>
            </div>
          </div>
        </div>

        {/* Trip Progress */}
        <div className="space-y-4 mb-6" data-testid="trip-progress">
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full mr-4 flex-shrink-0 flex items-center justify-center ${
              rideStatus === "arrived" || rideStatus === "in_progress" ? "bg-green-600" : "bg-gray-300"
            }`}>
              {(rideStatus === "arrived" || rideStatus === "in_progress") && (
                <Check className="h-2 w-2 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${
                rideStatus === "arrived" || rideStatus === "in_progress" ? "text-gray-900" : "text-gray-400"
              }`}>
                Pickup location
              </p>
              <p className="text-sm text-gray-500" data-testid="text-pickup-location">
                {userPosition ? "Current Location" : "Getting location..."}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full mr-4 flex-shrink-0 ${
              rideStatus === "completed" ? "bg-green-600" : "bg-gray-300"
            }`}>
              {rideStatus === "completed" && (
                <Check className="h-2 w-2 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${
                rideStatus === "completed" ? "text-gray-900" : "text-gray-400"
              }`}>
                Destination
              </p>
              <p className="text-sm text-gray-500" data-testid="text-destination-location">
                {destination?.name || "No destination selected"}
              </p>
            </div>
          </div>
        </div>

        {/* Location Tracking Status */}
        {isTrackingLocation && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4" data-testid="location-status">
            <div className="flex items-center">
              <Navigation className="h-4 w-4 text-green-600 mr-2" />
              <p className="text-sm text-green-800">Live location tracking active</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3" data-testid="quick-actions">
          <Button 
            variant="outline" 
            className="w-full bg-gray-50 text-gray-900 py-3 rounded-xl font-medium border-0 h-auto hover:bg-gray-100"
            onClick={handleShareTrip}
            data-testid="button-share-trip"
          >
            <Share className="h-4 w-4 mr-2" />
            Share live trip details
          </Button>
          <Button 
            variant="outline" 
            className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-medium border-0 h-auto hover:bg-red-100"
            data-testid="button-report-issue"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report an issue
          </Button>
        </div>
      </div>

      {/* Back Button */}
      <Button 
        size="icon"
        variant="outline"
        className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full shadow-lg border-0 hover:bg-gray-50"
        onClick={onBack}
        data-testid="button-back-to-main"
      >
        <ArrowLeft className="h-4 w-4 text-gray-900" />
      </Button>
    </div>
  );
}