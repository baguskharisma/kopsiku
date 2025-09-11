import { LocationCategory, VehicleType, OrderStatus, PaymentMethod, PaymentStatus, Role } from "@prisma/client";

// Location types based on Prisma schema
export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: LocationCategory;
  icon?: string | null;
  description?: string | null;
  isActive: boolean;
  searchCount: number;
  display_name: string;
  formatted_address: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order types based on Prisma schema
export interface CreateOrderRequest {
  routeData: any;
  // Passenger details
  passengerName: string;
  passengerPhone: string;
  specialRequests?: string;
  
  // Route information
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  
  // Trip details
  requestedVehicleType: VehicleType;
  distanceMeters?: number;
  estimatedDurationMinutes?: number;

  // Fare calculation (in cents/smallest currency unit)
  baseFare: number;
  distanceFare?: number;
  timeFare?: number;
  airportFare?: number;
  surgeFare?: number;
  additionalFare?: number;
  discount?: number;
  totalFare: number;
  
  // Payment
  paymentMethod: PaymentMethod;
}

export interface RouteData {
  coordinates: Coordinates[];
  distance: number;
  duration: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  
  // Relations
  fleetId: string;
  driverId: string;
  customerId?: string | null;
  
  // Passenger details
  passengerName: string;
  passengerPhone: string;
  specialRequests?: string | null;
  
  // Route information
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  
  // Trip details
  requestedVehicleType: VehicleType;
  distanceMeters?: number | null;
  estimatedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;

  // Fare calculation (in cents/smallest currency unit)
  baseFare: bigint;
  distanceFare: bigint;
  timeFare: bigint;
  airportFare: bigint;
  surgeFare: bigint;
  additionalFare: bigint;
  discount: bigint;
  totalFare: bigint;
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  // Status & timing
  status: OrderStatus;
  driverAssignedAt?: Date | null;
  driverAcceptedAt?: Date | null;
  driverArrivedAt?: Date | null;
  tripStartedAt?: Date | null;
  tripCompletedAt?: Date | null;
  
  // Cancellation
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  cancellationFee: bigint;
  
  // System fields
  createdAt: Date;
  updatedAt: Date;
}

// GPS and Route types
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

// Fare estimation
export interface FareEstimate {
  distance: number;
  baseFare: number;
  additionalFare: number;
  totalFare: number;
  additionalKm: number;
  airportFare?: number;
  isAirportTrip?: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Location search result from Nominatim
export interface NominatimResult {
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
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  avatarUrl?: string | null;
  isVerified: boolean;
}
