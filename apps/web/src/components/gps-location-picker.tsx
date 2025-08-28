"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  MapPin,
  Building,
  Plane,
  ShoppingBag,
  Navigation,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { gpsService, type Coordinates, type NominatimResult } from "@/lib/gps-service";
import type { Location } from "@/lib/types";
import LeafletMapClient from "./leaflet-map-client"; // gunakan komponen map client yang sudah kamu punya
import { createPortal } from "react-dom";

interface GPSLocationPickerProps {
  onClose: () => void;
  onSelectDestination: (location: Location) => void;
  currentLocation?: Coordinates | null;
  /**
   * Mode menentukan klik di map akan menghasilkan type apa.
   * Parent yang membuka picker untuk pickup harus pass "pickup".
   * Default: "destination"
   */
  mode?: "pickup" | "destination";
}

const iconMap = {
  monument: MapPin,
  "shopping-bag": ShoppingBag,
  plane: Plane,
  building: Building,
};

// Debounce hook (sama seperti sebelumnya)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function GPSLocationPicker({
  onClose,
  onSelectDestination,
  currentLocation,
  mode = "destination",
}: GPSLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(
    currentLocation || null
  );
  const [tempSelection, setTempSelection] = useState<Location | null>(null); // marker sementara saat klik map
  const [isReverseing, setIsReverseing] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Ambil locations dari API (pastikan API mengembalikan { success, data, pagination })
  const { data: locationsResponse = { data: [] }, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json(); // asumsikan bentuk { success: true, data: Location[] }
    },
    // jika response shape berbeda, pastikan menyesuaikan
  });

  // normalize locations array
  const locations: Location[] = Array.isArray((locationsResponse as any).data)
    ? (locationsResponse as any).data
    : [];

  const popularLocations = locations.filter((loc) => loc.category === "POPULAR");
  const recentLocations = locations.filter((loc) => loc.category === "RECENT");

  // blok background scroll saat modal terbuka
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Update userLocation jika prop currentLocation berubah
  useEffect(() => {
    setUserLocation(currentLocation || null);
  }, [currentLocation]);

  // Get current GPS location (button)
  const getCurrentLocation = useCallback(async () => {
    try {
      const position = await gpsService.getCurrentPosition();
      setUserLocation(position);
      toast.success("Location Found", {
        description: "Your current location has been detected",
      });
    } catch (error) {
      toast.error("Location Error", {
        description:
          error instanceof Error ? error.message : "Unable to get your location",
      });
    }
  }, []);

  // Search places when query changes (debounced)
  useEffect(() => {
    if (debouncedSearchQuery.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const searchPlaces = async () => {
      setIsSearching(true);
      try {
        const results = await gpsService.searchPlaces(debouncedSearchQuery);
        setSearchResults(results || []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
        toast.error("Search failed", { description: "Unable to search places" });
      } finally {
        setIsSearching(false);
      }
    };

    searchPlaces();
  }, [debouncedSearchQuery]);

  // When user selects a result or location object
  const handleLocationSelect = async (result: NominatimResult | Location) => {
    let location: Location;

    if ("place_id" in result) {
      // Nominatim result
      location = {
        id: `nominatim-${result.place_id}`,
        name:
          result.address?.road ||
          result.display_name.split(",")[0] ||
          "Selected Location",
        address: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        category: "CUSTOM",
        icon: "building",
        isActive: true,
        searchCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // Existing Location (from /api/locations)
      location = result;
    }

    onSelectDestination(location);
    onClose();
  };

  // Use current position
  const handleUseCurrentLocation = async () => {
    try {
      const position = await gpsService.getCurrentPosition();
      const address = await gpsService.reverseGeocode(position).catch(() => null);

      const location: Location = {
        id: `current-${Date.now()}`,
        name: "Lokasi Saat Ini",
        address: address || `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
        lat: position.lat,
        lng: position.lng,
        category: "CUSTOM",
        icon: "building",
        isActive: true,
        searchCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onSelectDestination(location);
      onClose();
    } catch (error) {
      toast.error("Location Error", {
        description:
          error instanceof Error ? error.message : "Unable to get your location",
      });
    }
  };

  // Handler ketika user klik di map
  const handleMapClick = async (coords: Coordinates, clickType: "pickup" | "destination") => {
    // Accept both types, but our modal is usually used for destination selection.
    // Set marker sementara
    const tempLoc: Location = {
      id: `temp-${Date.now()}`,
      name: "Selected location",
      address: "Loading address...",
      lat: coords.lat,
      lng: coords.lng,
      category: "CUSTOM",
      icon: "building",
      isActive: true,
      searchCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTempSelection(tempLoc);

    setIsReverseing(true);
    try {
      // reverse geocode via gpsService (harus proxied via /api/reverse-geocode)
      const address = await gpsService.reverseGeocode(coords);
      const finalLoc: Location = {
        ...tempLoc,
        name: address?.split(",")[0] || tempLoc.name,
        address: address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
      };

      // return to parent
      onSelectDestination(finalLoc);
      toast.success("Location selected", { description: finalLoc.address });
      onClose();
    } catch (error) {
      console.error("Reverse geocode error:", error);
      toast.error("Failed to get address for selected location");
      // keep temp selection so user sees the marker; don't auto close
    } finally {
      setIsReverseing(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-white z-50 transform transition-transform duration-300 overflow-auto"
      data-testid="gps-location-picker"
      role="dialog"
      aria-modal="true"
    >
      <div className="p-4 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-4">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-gray-50 border-0 mr-4"
            onClick={onClose}
            data-testid="button-close-picker"
          >
            <ArrowLeft className="h-4 w-4 text-gray-900" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-900" data-testid="text-picker-title">
            Choose location
          </h2>
        </div>

        {/* MAP area (klik untuk pilih) */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
            <span>{mode === "pickup" ? "Tap on map to choose pickup" : "Tap on map to choose destination"}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setTempSelection(null)} title="Clear marker">
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={getCurrentLocation} title="Center to current location">
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="h-56 w-full rounded-lg overflow-hidden border">
            <LeafletMapClient
              currentLocation={userLocation}
              destination={tempSelection ?? undefined}
              selectedPickup={undefined}
              mapClickMode={mode} // "pickup" | "destination"
              onMapClick={handleMapClick}
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search for places in Indonesia..."
            className="w-full pl-12 pr-12 py-4 bg-gray-50 rounded-xl text-gray-900 border-0 focus-visible:ring-2 focus-visible:ring-blue-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-location"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
              onClick={clearSearch}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          )}
        </div>

        {/* Use current location */}
        <Button
          variant="outline"
          className="w-full mb-4 p-4 bg-gray-50 rounded-xl border-0 text-left h-auto justify-start hover:bg-gray-100"
          onClick={handleUseCurrentLocation}
          data-testid="button-current-location"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
            <Navigation className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Gunakan lokasi saat ini</p>
            <p className="text-sm text-gray-500">
              {userLocation ? "Location detected" : "Get your current position"}
            </p>
          </div>
        </Button>

        {/* Search results OR popular/recent */}
        {isLoading ? (
          <div className="space-y-2" data-testid="loading-locations">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 h-16 animate-pulse"></div>
            ))}
          </div>
        ) : searchQuery.trim().length >= 3 ? (
          <div className="space-y-2" data-testid="search-results">
            {isSearching ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-500">Searching places...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8" data-testid="text-no-results">
                No places found for "{searchQuery}"
              </p>
            ) : (
              searchResults.map((result) => (
                <Button
                  key={result.place_id}
                  variant="ghost"
                  className="flex items-center w-full p-4 bg-gray-50 rounded-xl text-left h-auto justify-start hover:bg-gray-100"
                  onClick={() => handleLocationSelect(result)}
                  data-testid={`search-result-${result.place_id}`}
                >
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-4">
                    <MapPin className="h-5 w-5 text-gray-900" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {result.address?.road || result.display_name.split(",")[0]}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{result.display_name}</p>
                  </div>
                </Button>
              ))
            )}
          </div>
        ) : (
          <>
            {/* Popular Destinations */}
            {popularLocations.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-600 mb-3" data-testid="text-popular-destinations">
                  Popular destinations
                </h3>
                <div className="space-y-2" data-testid="popular-locations">
                  {popularLocations.map((location) => {
                    const IconComponent = iconMap[location.icon as keyof typeof iconMap] || MapPin;
                    return (
                      <Button
                        key={location.id}
                        variant="ghost"
                        className="flex items-center w-full p-4 bg-gray-50 rounded-xl text-left h-auto justify-start hover:bg-gray-100"
                        onClick={() => handleLocationSelect(location)}
                        data-testid={`popular-location-${location.id}`}
                      >
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-4">
                          <IconComponent className="h-5 w-5 text-gray-900" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{location.name}</p>
                          <p className="text-sm text-gray-500">{location.address}</p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Places */}
            {recentLocations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3" data-testid="text-recent-places">
                  Recent places
                </h3>
                <div className="space-y-2" data-testid="recent-locations">
                  {recentLocations.map((location) => {
                    const IconComponent = iconMap[location.icon as keyof typeof iconMap] || Building;
                    return (
                      <Button
                        key={location.id}
                        variant="ghost"
                        className="flex items-center w-full p-4 bg-gray-50 rounded-xl text-left h-auto justify-start hover:bg-gray-100"
                        onClick={() => handleLocationSelect(location)}
                        data-testid={`recent-location-${location.id}`}
                      >
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-4">
                          <IconComponent className="h-5 w-5 text-gray-900" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{location.name}</p>
                          <p className="text-sm text-gray-500">{location.address}</p>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* small status / busy indicator */}
      {isReverseing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm">Resolving address…</div>
        </div>
      )}
    </div>
  , document.body);
}
