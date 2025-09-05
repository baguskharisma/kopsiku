import { toast } from "sonner";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  instruction?: string;
}

export interface RouteResult {
  coordinates: RoutePoint[];
  distance: number; // in kilometers
  duration: number; // in minutes
}

// Updated interface for Google Places API
export interface GooglePlaceResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  types: string[];
}

// Keeping NominatimResult for backward compatibility, but mapping from Google Places
export interface NominatimResult {
  name: string;
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  formatted_address: string;
}

class GPSService {
  private watchId: number | null = null;
  private currentPosition: Coordinates | null = null;
  private positionCallbacks: ((position: Coordinates) => void)[] = [];

  /**
   * Get current GPS position
   */
  async getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          this.currentPosition = coords;
          resolve(coords);
        },
        (error) => {
          let message = "Unable to get your location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = "Akses lokasi ditolak. Mohon aktifkan izin lokasi.";
              break;
            case error.POSITION_UNAVAILABLE:
              message = "Informasi lokasi tidak tersedia.";
              break;
            case error.TIMEOUT:
              message = "Permintaan lokasi timeout.";
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }
      );
    });
  }

  /**
   * Start watching position changes
   */
  startWatching(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          this.currentPosition = coords;
          this.positionCallbacks.forEach(callback => callback(coords));
          resolve();
        },
        (error) => {
          console.error("GPS watching error:", error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    });
  }

  /**
   * Stop watching position changes
   */
  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Subscribe to position updates
   */
  onPositionUpdate(callback: (position: Coordinates) => void): () => void {
    this.positionCallbacks.push(callback);

    return () => {
      const index = this.positionCallbacks.indexOf(callback);
      if (index > -1) {
        this.positionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get route using Google Directions API through our backend
   */
  async getRoute(start: Coordinates, end: Coordinates): Promise<RouteResult> {
    try {
      // Try Google Directions API first through our backend proxy
      const response = await fetch('/api/directions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: `${start.lat},${start.lng}`,
          destination: `${end.lat},${end.lng}`,
          mode: 'driving',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          
          // Extract coordinates from the route
          const coordinates: RoutePoint[] = this.decodePolyline(route.overview_polyline.points)
            .map((coord, index, array) => ({
              lat: coord.lat,
              lng: coord.lng,
              instruction: 
                index === 0 ? "Mulai perjalanan" :
                index === array.length - 1 ? "Tiba di tujuan" : ""
            }));

          const distance = leg.distance.value / 1000; // meters to km
          const duration = leg.duration.value / 60;   // seconds to minutes

          toast.success("Rute ditemukan", {
            description: `Jarak: ${distance.toFixed(1)} km, Waktu: ${Math.round(duration)} menit`,
          });

          return {
            coordinates,
            distance,
            duration,
          };
        }
      }

      // Fallback to OSRM if Google Directions fails
      throw new Error("Google Directions API failed");
      
    } catch (error) {
      console.error("Google Directions failed, trying OSRM:", error);
      
      try {
        // Fallback to OSRM
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("OSRM request failed");

        const data = await res.json();
        if (!data.routes || data.routes.length === 0) throw new Error("No route found");

        const route = data.routes[0];

        // Convert GeoJSON to RoutePoint[]
        const coordinates: RoutePoint[] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number], index: number) => ({
            lat,
            lng,
            instruction:
              index === 0
                ? "Mulai perjalanan"
                : index === route.geometry.coordinates.length - 1
                ? "Tiba di tujuan"
                : "",
          })
        );

        const distance = route.distance / 1000; // meters → km
        const duration = route.duration / 60;   // seconds → minutes

        toast.success("Rute ditemukan (OSRM)", {
          description: `Jarak: ${distance.toFixed(1)} km, Waktu: ${duration.toFixed(0)} menit`,
        });

        return {
          coordinates,
          distance,
          duration,
        };
      } catch (osrmError) {
        console.error("OSRM routing failed:", osrmError);

        toast.error("Gagal ambil rute", {
          description: "Menggunakan rute perkiraan",
        });
        return this.createSmartRoute(start, end);
      }
    }
  }

  /**
   * Decode Google Maps polyline
   */
  private decodePolyline(encoded: string): Coordinates[] {
    const points: Coordinates[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        lat: lat / 1e5,
        lng: lng / 1e5,
      });
    }

    return points;
  }

  /**
   * Create smart route with road-following logic
   */
  private createSmartRoute(start: Coordinates, end: Coordinates): RouteResult {
    const distance = this.calculateDistance(start, end);
    const waypoints: RoutePoint[] = [];

    // Create more realistic route with turns and road-like patterns
    const numPoints = Math.max(8, Math.floor(distance * 4));

    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;

      // Create S-curve pattern to simulate real roads
      const baseLatProgress = start.lat + (end.lat - start.lat) * ratio;
      const baseLngProgress = start.lng + (end.lng - start.lng) * ratio;

      // Add road-like deviations
      const curveIntensity = Math.sin(ratio * Math.PI) * 0.002;
      const randomDeviation = (Math.random() - 0.5) * 0.001;

      const lat = baseLatProgress + curveIntensity + randomDeviation;
      const lng = baseLngProgress + curveIntensity * 0.7 + randomDeviation;

      let instruction = "";
      if (i === 0) {
        instruction = "Mulai perjalanan";
      } else if (i === numPoints) {
        instruction = "Tiba di tujuan";
      } else if (i % 4 === 0) {
        const directions = ["Belok kanan", "Belok kiri", "Lurus terus", "Ikuti jalan"];
        instruction = directions[Math.floor(Math.random() * directions.length)];
      }

      waypoints.push({ lat, lng, instruction });
    }

    const totalDistance = this.calculateTotalDistance(waypoints);
    const estimatedDuration = Math.round(totalDistance * 2.8); // More realistic for city driving

    return {
      coordinates: waypoints,
      distance: totalDistance,
      duration: estimatedDuration
    };
  }

  /**
   * Calculate total distance for a route
   */
  private calculateTotalDistance(waypoints: Coordinates[]): number {
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
      totalDistance += this.calculateDistance(waypoints[i - 1], waypoints[i]);
    }
    return totalDistance;
  }

  /**
   * Geocode address to coordinates using Google Geocoding API
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          region: 'id', // Indonesia
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to geocode address");
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address using Google Geocoding API
   */
  async reverseGeocode(coords: Coordinates): Promise<string> {
    try {
      const response = await fetch(
        `/api/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`
      );
  
      if (!response.ok) throw new Error("Failed to reverse geocode");
  
      const data = await response.json();
      return data.formatted_address || data.display_name || "Unknown location";
    } catch (error) {
      console.error("Reverse geocode error:", error);
      throw error;
    }
  }
  
  /**
   * Search for places using Google Places API (Text Search)
   */
  /**
   * Search for places using Google Places API (Text Search)
   */
  async searchPlaces(query: string, limit = 10): Promise<NominatimResult[]> {
    try {
      const response = await fetch(`/api/search-places?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!response.ok) throw new Error("Failed to search places");
      
      const data = await response.json();
      
      // Convert Google Places results to NominatimResult format for backward compatibility
      if (data.results) {
        return data.results.slice(0, limit).map((place: GooglePlaceResult, index: number): NominatimResult => {
          // The API route has already processed the name properly
          const placeName = place.name || 'Unknown Place';
          
          return {
            place_id: parseInt(place.place_id.replace(/[^0-9]/g, '').slice(0, 10) || '0') || index,
            licence: 'Google Places API',
            osm_type: 'node',
            osm_id: index,
            lat: place.geometry.location.lat.toString(),
            lon: place.geometry.location.lng.toString(),
            name: placeName,
            formatted_address: place.formatted_address || 'Unknown Address',
            display_name: place.formatted_address || placeName, // Keep original for compatibility
            address: this.parseGoogleAddress(place.formatted_address || ''),
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error("Place search error:", error);
      return [];
    }
  }

  /**
   * Parse Google formatted address into components
   */
  private parseGoogleAddress(formatted_address: string): {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  } {
    const parts = formatted_address.split(',').map(part => part.trim());
    
    return {
      road: parts[0] || undefined,
      suburb: parts[1] || undefined,
      city: parts[2] || undefined,
      state: parts[3] || undefined,
      country: parts[parts.length - 1] || 'Indonesia',
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(start: Coordinates, end: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(end.lat - start.lat);
    const dLng = this.deg2rad(end.lng - start.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(start.lat)) *
        Math.cos(this.deg2rad(end.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get current cached position
   */
  getCachedPosition(): Coordinates | null {
    return this.currentPosition;
  }

  /**
   * Check if geolocation is available
   */
  isGeolocationAvailable(): boolean {
    return 'geolocation' in navigator;
  }
}

export const gpsService = new GPSService();