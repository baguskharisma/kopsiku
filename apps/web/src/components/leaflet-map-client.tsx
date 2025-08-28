"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { gpsService, type Coordinates, type RouteResult } from "@/lib/gps-service";
import type { Location } from "@/lib/types";

interface LeafletMapClientProps {
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

export default function LeafletMapClient({
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
}: LeafletMapClientProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [k: string]: any }>({});
  const routeLayerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    try {
      // Clear route layer
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      // Clear markers
      Object.values(markersRef.current).forEach((marker: any) => {
        if (marker && mapInstanceRef.current && mapInstanceRef.current.hasLayer(marker)) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = {};

      // Clear temp marker
      if (tempMarkerRef.current && mapInstanceRef.current) {
        if (mapInstanceRef.current.hasLayer(tempMarkerRef.current)) {
          mapInstanceRef.current.removeLayer(tempMarkerRef.current);
        }
        tempMarkerRef.current = null;
      }

      // Remove map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      isInitializedRef.current = false;
      setIsMapReady(false);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (isInitializedRef.current || !mapRef.current) return;
    
    const initialize = async () => {
      try {
        // Wait for the container to be properly mounted
        await new Promise(resolve => setTimeout(resolve, 100));

        const L = (await import("leaflet")).default;
        LRef.current = L;

        // Fix default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        // Clear any existing Leaflet instance
        const mapElement = mapRef.current;
        if (mapElement && (mapElement as any)._leaflet_id) {
          delete (mapElement as any)._leaflet_id;
        }

        const defaultCenter: [number, number] = currentLocation
          ? [currentLocation.lat, currentLocation.lng]
          : [-6.2088, 106.8456]; // Jakarta default

        // Initialize map with proper configuration
        const map = L.map(mapRef.current!, {
          preferCanvas: false,
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          touchZoom: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          tapTolerance: 15,
          zoomSnap: 1,
          zoomDelta: 1,
          closePopupOnClick: true,
          bounceAtZoomLimits: true,
          worldCopyJump: false,
          maxBoundsViscosity: 1.0,
        });

        // Set initial view
        map.setView(defaultCenter, 13);
        mapInstanceRef.current = map;
        isInitializedRef.current = true;

        // Add tile layer with error handling
        const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          minZoom: 1,
          tileSize: 256,
          zoomOffset: 0,
          detectRetina: true,
          crossOrigin: true,
        });

        tileLayer.on('load', () => {
          console.log('Tiles loaded successfully');
          setIsMapReady(true);
        });

        tileLayer.on('tileerror', (e) => {
          console.warn('Tile load error:', e);
        });

        tileLayer.addTo(map);

        // Configure container
        const container = map.getContainer();
        container.style.outline = 'none';
        container.style.height = '100%';
        container.style.width = '100%';
        container.style.touchAction = 'none';
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';
        
        L.DomEvent.disableScrollPropagation(container);

        // Force enable dragging and ensure it works
        map.dragging.enable();
        
        // Additional check - force map to respond to drag
        setTimeout(() => {
          if (mapInstanceRef.current) {
            const isDraggingEnabled = mapInstanceRef.current.dragging.enabled();
            console.log('Dragging enabled?', isDraggingEnabled);
            
            if (!isDraggingEnabled) {
              mapInstanceRef.current.dragging.enable();
              console.log('Force enabled dragging');
            }
          }
        }, 1000);

        // Custom zoom event listeners
        const handleZoomIn = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomIn();
          }
        };
        
        const handleZoomOut = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.zoomOut();
          }
        };
        
        window.addEventListener('leaflet-zoom-in', handleZoomIn);
        window.addEventListener('leaflet-zoom-out', handleZoomOut);

        // Map click handler
        const handleMapClick = (e: any) => {
          console.log('Map clicked:', e.latlng);
          if (onMapClick && mapClickMode) {
            onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }, mapClickMode);
          }
        };

        map.on('click', handleMapClick);

        // Handle map ready
        map.whenReady(() => {
          console.log('Map is ready');
          setIsMapReady(true);
          
          // Force invalidate size after ready
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize(true);
            }
          }, 200);
        });

        // Force initial size calculation
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize(true);
          }
        }, 300);

        // Cleanup function untuk event listeners
        return () => {
          window.removeEventListener('leaflet-zoom-in', handleZoomIn);
          window.removeEventListener('leaflet-zoom-out', handleZoomOut);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.off('click', handleMapClick);
          }
        };
      } catch (error) {
        console.error('Failed to initialize map:', error);
        isInitializedRef.current = false;
        setIsMapReady(false);
      }
    };

    const cleanupPromise = initialize();

    return () => {
      cleanupPromise?.then?.(fn => fn?.());
      cleanup();
    };
  }, []); // Empty dependency array - initialize only once

  // Handle resize with debouncing
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
            mapInstanceRef.current.invalidateSize(true);
          }
        } catch (error) {
          console.warn('ResizeObserver invalidateSize failed:', error);
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
    const L = LRef.current;
    if (!map || !L || !isInitializedRef.current) return;

    try {
      // Clear existing markers
      Object.values(markersRef.current).forEach((marker: any) => {
        if (marker && map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      markersRef.current = {};

      // Add pickup marker
      const pickupLoc = selectedPickup 
        ? { lat: selectedPickup.lat, lng: selectedPickup.lng }
        : currentLocation;
      
      if (pickupLoc) {
        const pickupIcon = L.divIcon({
          className: 'custom-pickup-marker',
          html: `<div style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const pickupMarker = L.marker([pickupLoc.lat, pickupLoc.lng], { icon: pickupIcon })
          .bindPopup(selectedPickup ? selectedPickup.address : "Your location")
          .addTo(map);
        markersRef.current.pickup = pickupMarker;
      }

      // Add destination marker
      if (destination) {
        const destIcon = L.divIcon({
          className: 'custom-destination-marker',
          html: `<div style="background: #dc2626; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon })
          .bindPopup(destination.address || "Destination")
          .addTo(map);
        markersRef.current.destination = destMarker;
      }

      // Add driver marker
      if (driverLocation) {
        const driverIcon = L.divIcon({
          className: 'custom-driver-marker',
          html: `<div style="background: #eab308; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { 
          icon: driverIcon 
        })
          .bindPopup("Driver")
          .addTo(map);
        markersRef.current.driver = driverMarker;
      }

      // Fit bounds if multiple markers
      const visibleMarkers = Object.values(markersRef.current).filter((m: any) => 
        map.hasLayer(m)
      );
      if (visibleMarkers.length > 1) {
        const group = new L.featureGroup(visibleMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
      } else if (visibleMarkers.length === 1 && pickupLoc) {
        map.setView([pickupLoc.lat, pickupLoc.lng], 15);
      }
    } catch (error) {
      console.warn('Error updating markers:', error);
    }
  }, [
    currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : null,
    destination ? `${destination.lat},${destination.lng}` : null,
    driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : null,
    selectedPickup ? `${selectedPickup.lat},${selectedPickup.lng}` : null,
    isMapReady
  ]);

  // Update route - FIXED: Better validation and error handling
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L || !isInitializedRef.current) {
      console.log('Route update skipped: Map not ready');
      return;
    }

    try {
      // Clear existing route
      if (routeLayerRef.current) {
        console.log('Removing existing route layer');
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      // Validate route data before adding
      if (routeData && showRoute) {
        console.log('Processing route data:', routeData);
        
        // Check if coordinates exist and are valid
        if (!routeData.coordinates) {
          console.warn('Route data missing coordinates property');
          return;
        }
        
        if (!Array.isArray(routeData.coordinates)) {
          console.warn('Route coordinates is not an array:', typeof routeData.coordinates);
          return;
        }
        
        if (routeData.coordinates.length < 2) {
          console.warn('Route has insufficient coordinates:', routeData.coordinates.length);
          return;
        }

        // Validate coordinate format
        const validCoords = routeData.coordinates.filter((coord: any) => {
          const isValid = coord && 
                         typeof coord.lat === 'number' && 
                         typeof coord.lng === 'number' &&
                         !isNaN(coord.lat) && 
                         !isNaN(coord.lng) &&
                         Math.abs(coord.lat) <= 90 && 
                         Math.abs(coord.lng) <= 180;
          
          if (!isValid) {
            console.warn('Invalid coordinate found:', coord);
          }
          return isValid;
        });

        if (validCoords.length < 2) {
          console.warn('Not enough valid coordinates for route:', validCoords.length);
          return;
        }

        // Convert to Leaflet format [lat, lng]
        const leafletCoords = validCoords.map((c: any) => [c.lat, c.lng] as [number, number]);
        
        console.log(`Creating route with ${leafletCoords.length} coordinates`);
        
        // Create polyline with enhanced styling
        routeLayerRef.current = L.polyline(leafletCoords, {
          color: "#fcba03",
          weight: 5,
          opacity: 0.8,
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        
        console.log('Route polyline added to map successfully');
        
        // Fit bounds to show the entire route with some padding
        try {
          const routeBounds = routeLayerRef.current.getBounds();
          if (routeBounds.isValid()) {
            map.fitBounds(routeBounds.pad(0.1));
            console.log('Map fitted to route bounds');
          } else {
            console.warn('Route bounds are invalid');
          }
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
      // Clean up failed route layer
      if (routeLayerRef.current) {
        try {
          map.removeLayer(routeLayerRef.current);
        } catch (cleanupError) {
          console.warn('Error cleaning up failed route layer:', cleanupError);
        }
        routeLayerRef.current = null;
      }
    }
  }, [routeData, showRoute, isMapReady]);

  // Handle temp marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L || !isInitializedRef.current) return;

    try {
      // Clear existing temp marker
      if (tempMarkerRef.current && map.hasLayer(tempMarkerRef.current)) {
        map.removeLayer(tempMarkerRef.current);
        tempMarkerRef.current = null;
      }

      // Add new temp marker
      if (tempMarker) {
        const tempIcon = L.divIcon({
          className: 'custom-temp-marker',
          html: `<div style="background: #f59e0b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        tempMarkerRef.current = L.marker([tempMarker.lat, tempMarker.lng], {
          draggable: !!onTempMarkerDrag,
          icon: tempIcon
        }).addTo(map);

        if (onTempMarkerDrag) {
          tempMarkerRef.current.on("dragend", (event: any) => {
            const latlng = event.target.getLatLng();
            onTempMarkerDrag({ lat: latlng.lat, lng: latlng.lng });
          });
        }
      }
    } catch (error) {
      console.warn('Error updating temp marker:', error);
    }
  }, [tempMarker?.lat, tempMarker?.lng, onTempMarkerDrag, isMapReady]);

  return (
    <div 
      ref={mapRef} 
      className={`${className} leaflet-container`}
      data-testid="leaflet-map"
      style={{ 
        height: '100%',
        width: '100%',
        position: 'relative',
        zIndex: 1,
        outline: 'none',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        background: '#f3f4f6',
        cursor: 'grab'
      }}
    />
  );
}