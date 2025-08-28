"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Navigation, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import type { Location } from "@/lib/types";

// Dynamically import Leaflet to avoid SSR issues
const LeafletMapComponent = dynamic(() => import("./leaflet-map-client"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

interface LeafletMapProps {
  currentLocation: Coordinates | null;
  destination?: Location | null;
  driverLocation?: Coordinates | null;
  routeData?: RouteResult | null;
  onLocationUpdate?: (coords: Coordinates) => void;
  onMapClick?: (coords: Coordinates, type: 'pickup' | 'destination') => void;
  mapClickMode?: 'pickup' | 'destination' | null;
  selectedPickup?: Location | null;
  showRoute?: boolean;
  className?: string;
}

export default function LeafletMap(props: LeafletMapProps) {
  const { onLocationUpdate, className = "h-96" } = props;
  const mapControlsRef = useRef<HTMLDivElement>(null);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await gpsService.getCurrentPosition();
      if (onLocationUpdate) {
        onLocationUpdate(location);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  }, [onLocationUpdate]);

  // Custom zoom handlers that communicate with the map instance
  const handleZoomIn = useCallback(() => {
    const event = new CustomEvent('leaflet-zoom-in');
    window.dispatchEvent(event);
  }, []);

  const handleZoomOut = useCallback(() => {
    const event = new CustomEvent('leaflet-zoom-out');
    window.dispatchEvent(event);
  }, []);

  // Load CSS dynamically to ensure it's loaded
  useEffect(() => {
    const loadCSS = () => {
      if (typeof window !== 'undefined' && !document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
    };

    loadCSS();
  }, []);

  return (
    <div className={`relative ${className} overflow-hidden rounded-lg`} data-testid="leaflet-map-container">
      
      {/* Container yang memastikan tidak ada pointer-events: none */}
      <div 
        className="w-full h-full" 
        style={{ 
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1 
        }}
      >
        <LeafletMapComponent {...props} />
      </div>
      
      {/* Map controls dengan z-index yang tepat */}
      <div 
        ref={mapControlsRef}
        className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]"
        style={{ 
          position: 'absolute',
          zIndex: 1000,
          pointerEvents: 'auto'
        }}
      >
        <Button
          size="icon"
          variant="outline"
          className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white border border-gray-200"
          onClick={handleZoomIn}
          data-testid="button-zoom-in"
          type="button"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white border border-gray-200"
          onClick={handleZoomOut}
          data-testid="button-zoom-out"
          type="button"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white border border-gray-200"
          onClick={getCurrentLocation}
          data-testid="button-current-location"
          type="button"
        >
          <Navigation className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}