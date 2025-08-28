import { NextRequest, NextResponse } from 'next/server';
import { calculateFare, isAirportLocation } from '@/lib/fare-calculator';

export async function POST(request: NextRequest) {
  try {
    const { distance, pickupAddress, destinationAddress } = await request.json();

    if (!distance || typeof distance !== 'number' || distance <= 0) {
      return NextResponse.json(
        { error: 'Invalid distance provided' },
        { status: 400 }
      );
    }

    // Calculate fare using the fare calculator
    const fareResult = calculateFare(
      distance,
      pickupAddress,
      destinationAddress
    );

    return NextResponse.json({
      distance: fareResult.distance,
      baseFare: fareResult.baseFare,
      additionalFare: fareResult.additionalFare,
      airportFare: fareResult.airportFare,
      totalFare: fareResult.totalFare,
      additionalKm: fareResult.additionalKm,
      isAirportTrip: fareResult.isAirportTrip,
    });
  } catch (error) {
    console.error('Fare estimation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate fare' },
      { status: 500 }
    );
  }
}