import { NextRequest, NextResponse } from 'next/server';
import { VehicleType, PaymentMethod, OrderStatus } from '@prisma/client';
import type { CreateOrderRequest } from '@/lib/types';

interface NestJSOrderRequest {
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  pickupCoordinates: {
    lat: number;
    lng: number;
  };
  dropoffAddress: string;
  dropoffCoordinates: {
    lat: number;
    lng: number;
  };
  requestedVehicleType: VehicleType;
  distanceMeters: number;
  estimatedDurationMinutes: number;
  baseFare: number; // in cents
  distanceFare: number; // in cents
  airportFare?: number; // in cents
  totalFare: number; // in cents
  paymentMethod: PaymentMethod;
  routeData?: {
    coordinates: { lat: number; lng: number }[];
    distance: number;
    duration: number;
  };
  specialRequests?: string;
  tripType?: 'INSTANT' | 'SCHEDULED';
  scheduledAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const orderData: CreateOrderRequest = await request.json();
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    // Transform Next.js format to NestJS format
    const nestJSOrderData: NestJSOrderRequest = {
      passengerName: orderData.passengerName,
      passengerPhone: orderData.passengerPhone,
      pickupAddress: orderData.pickupAddress,
      pickupCoordinates: {
        lat: orderData.pickupLat,
        lng: orderData.pickupLng,
      },
      dropoffAddress: orderData.dropoffAddress,
      dropoffCoordinates: {
        lat: orderData.dropoffLat,
        lng: orderData.dropoffLng,
      },
      requestedVehicleType: orderData.requestedVehicleType,
      distanceMeters: orderData.distanceMeters ?? 0,
      estimatedDurationMinutes: orderData.estimatedDurationMinutes ?? 0,
      baseFare: orderData.baseFare ?? 0,
      distanceFare: orderData.distanceFare ?? 0,
      airportFare: orderData.airportFare ?? 0,
      totalFare: orderData.totalFare,
      paymentMethod: orderData.paymentMethod,
      specialRequests: orderData.specialRequests,
      tripType: 'INSTANT',
      routeData: orderData.routeData ? {
        coordinates: orderData.routeData.coordinates || [],
        distance: orderData.routeData.distance || 0,
        duration: orderData.routeData.duration || 0,
      } : undefined,
    };

    // Validate required fields
    const requiredFields = [
      'passengerName',
      'passengerPhone', 
      'pickupAddress',
      'dropoffAddress',
      'requestedVehicleType',
      'baseFare',
      'totalFare',
      'paymentMethod'
    ];

    for (const field of requiredFields) {
      if (!(field in nestJSOrderData) || 
          nestJSOrderData[field as keyof NestJSOrderRequest] === null || 
          nestJSOrderData[field as keyof NestJSOrderRequest] === undefined) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate enums
    if (!Object.values(VehicleType).includes(nestJSOrderData.requestedVehicleType)) {
      return NextResponse.json(
        { error: 'Invalid vehicle type' },
        { status: 400 }
      );
    }

    if (!Object.values(PaymentMethod).includes(nestJSOrderData.paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Forward request to NestJS backend
    const response = await fetch(`${backendUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication if needed
        // 'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(nestJSOrderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('NestJS backend error:', errorData);
      
      return NextResponse.json(
        { 
          success: false,
          error: errorData.message || 'Failed to create order',
          details: errorData
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Transform NestJS response back to Next.js format if needed
    const transformedResponse = {
      success: true,
      data: {
        id: result.data?.id,
        orderNumber: result.data?.orderNumber,
        status: result.data?.status,
        pickupAddress: result.data?.pickupAddress,
        dropoffAddress: result.data?.dropoffAddress,
        totalFare: result.data?.totalFare,
        vehicleType: result.data?.vehicleType,
        driver: result.data?.driver ? {
          id: result.data.driver.id,
          name: result.data.driver.name,
          phone: result.data.driver.phone,
          rating: result.data.driver.rating || 0,
          vehicleInfo: result.data.driver.vehicleInfo
        } : null,
        estimatedArrival: result.data?.estimatedArrival || '3-5 minutes',
        createdAt: result.data?.createdAt
      },
      message: result.message || 'Order created successfully'
    };

    return NextResponse.json(transformedResponse);

  } catch (error) {
    console.error('Next.js API route error:', error);
    
    // Handle network errors (NestJS backend unreachable)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend service unavailable',
          message: 'Unable to connect to booking service. Please try again later.'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    // Forward query parameters to NestJS backend
    const queryString = searchParams.toString();
    const response = await fetch(`${backendUrl}/api/orders${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication if needed
        // 'Authorization': `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { 
          success: false,
          error: errorData.message || 'Failed to fetch orders' 
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Get orders error:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend service unavailable' 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}