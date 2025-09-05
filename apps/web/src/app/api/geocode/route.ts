import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { address, region = 'id' } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Build URL for Google Geocoding API
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', address);
    url.searchParams.append('region', region);
    url.searchParams.append('language', 'id'); // Indonesian
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if Google returned an error
    if (data.status !== 'OK') {
      console.error('Google Geocoding API error:', data);
      return NextResponse.json(
        { error: `Geocoding API error: ${data.status}`, details: data.error_message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Geocoding API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}