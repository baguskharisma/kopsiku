import { NextRequest, NextResponse } from 'next/server';
import { VehicleType, PaymentMethod } from '@prisma/client';
import type { CreateOrderRequest } from '@/lib/types';

interface NestJSOrderRequest {
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  pickupCoordinates: { lat: number; lng: number };
  dropoffAddress: string;
  dropoffCoordinates: { lat: number; lng: number };
  requestedVehicleType: VehicleType;
  distanceMeters: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceFare: number;
  airportFare?: number;
  totalFare: number;
  paymentMethod: PaymentMethod;
  routeData?: { coordinates: { lat: number; lng: number }[]; distance: number; duration: number };
  specialRequests?: string;
  tripType?: 'INSTANT' | 'SCHEDULED';
  scheduledAt?: string;
}

const DEFAULT_BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const BACKEND_PREFIX = '/api/v1'; // sesuaikan dengan global prefix di NestJS

export async function POST(request: NextRequest) {
  try {
    const orderData: CreateOrderRequest = await request.json();
    const backendUrl = DEFAULT_BACKEND;

    const nestJSOrderData: NestJSOrderRequest = {
      passengerName: orderData.passengerName,
      passengerPhone: orderData.passengerPhone,
      pickupAddress: orderData.pickupAddress,
      pickupCoordinates: { lat: orderData.pickupLat, lng: orderData.pickupLng },
      dropoffAddress: orderData.dropoffAddress,
      dropoffCoordinates: { lat: orderData.dropoffLat, lng: orderData.dropoffLng },
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
      routeData: orderData.routeData
        ? {
            coordinates: orderData.routeData.coordinates || [],
            distance: orderData.routeData.distance || 0,
            duration: orderData.routeData.duration || 0,
          }
        : undefined,
    };

    // Validasi sederhana
    const requiredFields = [
      'passengerName',
      'passengerPhone',
      'pickupAddress',
      'dropoffAddress',
      'requestedVehicleType',
      'baseFare',
      'totalFare',
      'paymentMethod',
    ];

    for (const field of requiredFields) {
      if (
        !(field in nestJSOrderData) ||
        nestJSOrderData[field as keyof NestJSOrderRequest] === null ||
        nestJSOrderData[field as keyof NestJSOrderRequest] === undefined
      ) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Enum check
    if (!Object.values(VehicleType).includes(nestJSOrderData.requestedVehicleType)) {
      return NextResponse.json({ error: 'Invalid vehicle type' }, { status: 400 });
    }
    if (!Object.values(PaymentMethod).includes(nestJSOrderData.paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Ambil cookie header dari request dan forward ke backend
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${backendUrl}${BACKEND_PREFIX}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // forward cookie supaya NestJS bisa baca httpOnly access_token
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(nestJSOrderData),
    });

    const resultText = await response.text();
    let resultJson: any = null;
    try {
      resultJson = resultText ? JSON.parse(resultText) : null;
    } catch {
      resultJson = { raw: resultText };
    }

    if (!response.ok) {
      console.error('NestJS backend error:', resultJson);
      return NextResponse.json(
        { success: false, error: resultJson?.message || 'Failed to create order', details: resultJson },
        { status: response.status }
      );
    }

    // transform (jika perlu)
    const result = resultJson;
    const transformedResponse = {
      success: true,
      data: {
        id: result?.data?.id,
        orderNumber: result?.data?.orderNumber,
        status: result?.data?.status,
        pickupAddress: result?.data?.pickupAddress,
        dropoffAddress: result?.data?.dropoffAddress,
        totalFare: result?.data?.totalFare,
        vehicleType: result?.data?.vehicleType,
        driver: result?.data?.driver
          ? {
              id: result.data.driver.id,
              name: result.data.driver.name,
              phone: result.data.driver.phone,
              rating: result.data.driver.rating || 0,
              vehicleInfo: result.data.driver.vehicleInfo,
            }
          : null,
        estimatedArrival: result?.data?.estimatedArrival || '3-5 minutes',
        createdAt: result?.data?.createdAt,
      },
      message: result?.message || 'Order created successfully',
    };

    return NextResponse.json(transformedResponse, { status: 200 });
  } catch (error) {
    console.error('Next.js API route error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({ success: false, error: 'Backend service unavailable' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error', message: error instanceof Error ? error.message : null }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = DEFAULT_BACKEND;
    const cookieHeader = request.headers.get('cookie') || '';
    const queryString = searchParams.toString();

    const response = await fetch(`${backendUrl}${BACKEND_PREFIX}/orders${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ success: false, error: result?.message || 'Failed to fetch orders' }, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get orders error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json({ success: false, error: 'Backend service unavailable' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch orders', message: error instanceof Error ? error.message : null }, { status: 500 });
  }
}
