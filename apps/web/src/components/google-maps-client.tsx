"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import type { Location } from "@/lib/types";

interface GoogleMapsClientProps {
  currentLocation: Coordinates | null;
  destination?: Location | null;
  driverLocation?: Coordinates | null;
  routeData?: RouteResult | null;
  onLocationUpdate?: (coords: Coordinates) => void;
  onMapClick?: (coords: Coordinates, type: "pickup" | "destination") => void;
  mapClickMode?: "pickup" | "destination" | null;
  selectedPickup?: Location | null;
  showRoute?: boolean;
  className?: string;
  tempMarker?: { lat: number; lng: number } | null;
  onTempMarkerDrag?: (coords: Coordinates) => void;
}

// Declare global google variable
declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

export default function GoogleMapsClient({
  currentLocation,
  destination,
  driverLocation,
  routeData,
  onMapClick,
  mapClickMode,
  selectedPickup,
  showRoute = true,
  className = "w-full h-full",
  tempMarker = null,
  onTempMarkerDrag,
}: GoogleMapsClientProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<{ [k: string]: google.maps.Marker }>({});
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const tempMarkerRef = useRef<google.maps.Marker | null>(null);
  const isInitializedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (window.google && window.google.maps) {
        setIsGoogleLoaded(true);
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script already loading, wait for it
        const checkGoogle = () => {
          if (window.google && window.google.maps) {
            setIsGoogleLoaded(true);
          } else {
            setTimeout(checkGoogle, 100);
          }
        };
        checkGoogle();
        return;
      }

      // Create script element
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.error('Google Maps API key not found. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
        return;
      }

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        setIsGoogleLoaded(true);
      };
      
      script.onerror = (error) => {
        console.error('Failed to load Google Maps API:', error);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    try {
      // Clear route polyline
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }

      // Clear markers
      Object.values(markersRef.current).forEach((marker) => {
        marker.setMap(null);
      });
      markersRef.current = {};

      // Clear temp marker
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setMap(null);
        tempMarkerRef.current = null;
      }

      isInitializedRef.current = false;
      setIsMapReady(false);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (!isGoogleLoaded || isInitializedRef.current || !mapRef.current) return;
    
    const initialize = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));

        const defaultCenter: google.maps.LatLngLiteral = currentLocation
          ? { lat: currentLocation.lat, lng: currentLocation.lng }
          : { lat: 0.5371, lng: 101.4443 }; // Pekanbaru, Indonesia

        // Initialize map
        const map = new google.maps.Map(mapRef.current!, {
          zoom: 13,
          center: defaultCenter,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        mapInstanceRef.current = map;
        isInitializedRef.current = true;

        // Map click handler
        const handleMapClick = (e: google.maps.MapMouseEvent) => {
          if (e.latLng && onMapClick && mapClickMode) {
            console.log('Map clicked:', e.latLng.toJSON());
            onMapClick(
              { lat: e.latLng.lat(), lng: e.latLng.lng() },
              mapClickMode
            );
          }
        };

        map.addListener('click', handleMapClick);

        // Handle map ready
        google.maps.event.addListenerOnce(map, 'idle', () => {
          console.log('Google Maps is ready');
          setIsMapReady(true);
        });

        // Cleanup function for event listeners
        return () => {
          google.maps.event.clearInstanceListeners(map);
        };
      } catch (error) {
        console.error('Failed to initialize Google Maps:', error);
        isInitializedRef.current = false;
        setIsMapReady(false);
      }
    };

    const cleanupPromise = initialize();

    return () => {
      cleanupPromise?.then?.(fn => fn?.());
      cleanup();
    };
  }, [isGoogleLoaded, currentLocation, onMapClick, mapClickMode]);

  // Handle resize
  useEffect(() => {
    const mapEl = mapRef.current;
    const map = mapInstanceRef.current;
    if (!mapEl || !map) return;

    let resizeTimeout: NodeJS.Timeout;

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          if (mapInstanceRef.current) {
            google.maps.event.trigger(mapInstanceRef.current, 'resize');
          }
        } catch (error) {
          console.warn('ResizeObserver resize failed:', error);
        }
      }, 150);
    });

    resizeObserver.observe(mapEl);
    
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [isMapReady]);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isInitializedRef.current || !isGoogleLoaded) return;

    try {
      // Clear existing markers
      Object.values(markersRef.current).forEach((marker) => {
        marker.setMap(null);
      });
      markersRef.current = {};

      // Add pickup marker
      const pickupLoc = selectedPickup 
        ? { lat: selectedPickup.lat, lng: selectedPickup.lng }
        : currentLocation;
      
      if (pickupLoc) {
        const pickupMarker = new google.maps.Marker({
          position: pickupLoc,
          map: map,
          title: selectedPickup ? selectedPickup.address : "Your location",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 10
          }
        });

        const pickupInfoWindow = new google.maps.InfoWindow({
          content: selectedPickup ? selectedPickup.address : "Your location"
        });

        pickupMarker.addListener('click', () => {
          pickupInfoWindow.open(map, pickupMarker);
        });

        markersRef.current.pickup = pickupMarker;
      }

      // Add destination marker
      if (destination) {
        const destMarker = new google.maps.Marker({
          position: { lat: destination.lat, lng: destination.lng },
          map: map,
          title: destination.address || "Destination",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#dc2626',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 10
          }
        });

        const destInfoWindow = new google.maps.InfoWindow({
          content: destination.address || "Destination"
        });

        destMarker.addListener('click', () => {
          destInfoWindow.open(map, destMarker);
        });

        markersRef.current.destination = destMarker;
      }

      // Add driver marker
      if (driverLocation) {
        const driverMarker = new google.maps.Marker({
          position: driverLocation,
          map: map,
          title: "Driver",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#eab308',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
          }
        });

        const driverInfoWindow = new google.maps.InfoWindow({
          content: "Driver"
        });

        driverMarker.addListener('click', () => {
          driverInfoWindow.open(map, driverMarker);
        });

        markersRef.current.driver = driverMarker;
      }

      // Fit bounds if multiple markers
      const visibleMarkers = Object.values(markersRef.current);
      if (visibleMarkers.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        visibleMarkers.forEach((marker) => {
          if (marker.getPosition()) {
            bounds.extend(marker.getPosition()!);
          }
        });
        map.fitBounds(bounds);
        
        // Ensure minimum zoom level
        google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
          if (map.getZoom()! > 15) {
            map.setZoom(15);
          }
        });
      } else if (visibleMarkers.length === 1 && pickupLoc) {
        map.setCenter(pickupLoc);
        map.setZoom(15);
      }
    } catch (error) {
      console.warn('Error updating markers:', error);
    }
  }, [
    currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : null,
    destination ? `${destination.lat},${destination.lng}` : null,
    driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : null,
    selectedPickup ? `${selectedPickup.lat},${selectedPickup.lng}` : null,
    isMapReady,
    isGoogleLoaded
  ]);

  // Update route - FIXED VERSION
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isInitializedRef.current || !isGoogleLoaded) {
      console.log('Route update skipped: Map not ready');
      return;
    }

    try {
      // Clear existing route polyline
      if (routePolylineRef.current) {
        console.log('Removing existing route polyline');
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }

      // Add new route if data exists and should be shown
      if (routeData && showRoute && routeData.coordinates && Array.isArray(routeData.coordinates)) {
        console.log('Processing route data:', routeData);
        
        if (routeData.coordinates.length < 2) {
          console.warn('Not enough coordinates for route:', routeData.coordinates.length);
          return;
        }

        // Validate coordinate format
        const validCoords = routeData.coordinates.filter((coord: any) => {
          return coord && 
                 typeof coord.lat === 'number' && 
                 typeof coord.lng === 'number' &&
                 !isNaN(coord.lat) && 
                 !isNaN(coord.lng) &&
                 Math.abs(coord.lat) <= 90 && 
                 Math.abs(coord.lng) <= 180;
        });

        if (validCoords.length < 2) {
          console.warn('Not enough valid coordinates for route:', validCoords.length);
          return;
        }

        console.log(`Creating route polyline with ${validCoords.length} coordinates`);
        
        // Create path from coordinates
        const path = validCoords.map((coord: any) => new google.maps.LatLng(coord.lat, coord.lng));

        // Create polyline with yellow color
        routePolylineRef.current = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#fcba03', // Yellow color as requested
          strokeOpacity: 0.8,
          strokeWeight: 5,
          clickable: false
        });

        // Add polyline to map
        routePolylineRef.current.setMap(map);
        
        console.log('Route polyline added to Google Maps successfully');
        
        // Fit bounds to show the entire route
        try {
          const bounds = new google.maps.LatLngBounds();
          validCoords.forEach(coord => bounds.extend(new google.maps.LatLng(coord.lat, coord.lng)));
          map.fitBounds(bounds);
          
          // Ensure reasonable zoom level
          google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            const currentZoom = map.getZoom();
            if (currentZoom && currentZoom > 16) {
              map.setZoom(16);
            } else if (currentZoom && currentZoom < 10) {
              map.setZoom(12);
            }
          });
          
          console.log('Map fitted to route bounds');
        } catch (boundsError) {
          console.warn('Error fitting bounds to route:', boundsError);
        }
      } else {
        console.log('Route not shown:', { 
          hasRouteData: !!routeData, 
          showRoute,
          coordinates: routeData?.coordinates?.length || 0 
        });
      }
    } catch (error) {
      console.error('Error updating route:', error);
      // Clean up failed polyline
      if (routePolylineRef.current) {
        try {
          routePolylineRef.current.setMap(null);
        } catch (cleanupError) {
          console.warn('Error cleaning up failed route polyline:', cleanupError);
        }
        routePolylineRef.current = null;
      }
    }
  }, [routeData, showRoute, isMapReady, isGoogleLoaded]);

  // Handle temp marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isInitializedRef.current || !isGoogleLoaded) return;

    try {
      // Clear existing temp marker
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setMap(null);
        tempMarkerRef.current = null;
      }

      // Add new temp marker
      if (tempMarker) {
        tempMarkerRef.current = new google.maps.Marker({
          position: tempMarker,
          map: map,
          draggable: !!onTempMarkerDrag,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
          }
        });

        if (onTempMarkerDrag) {
          tempMarkerRef.current.addListener('dragend', () => {
            const position = tempMarkerRef.current!.getPosition();
            if (position) {
              onTempMarkerDrag({ lat: position.lat(), lng: position.lng() });
            }
          });
        }
      }
    } catch (error) {
      console.warn('Error updating temp marker:', error);
    }
  }, [tempMarker?.lat, tempMarker?.lng, onTempMarkerDrag, isMapReady, isGoogleLoaded]);

  return (
    <div 
      ref={mapRef} 
      className={`${className} google-maps-container`}
      data-testid="google-maps"
      style={{ 
        height: '100%',
        width: '100%',
        position: 'relative',
        zIndex: 1,
        background: '#f3f4f6'
      }}
    />
  );
}