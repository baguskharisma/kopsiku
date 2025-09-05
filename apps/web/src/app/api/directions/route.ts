import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { origin, destination, mode = 'driving' } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
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

    // Build URL for Google Directions API
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', origin);
    url.searchParams.append('destination', destination);
    url.searchParams.append('mode', mode);
    url.searchParams.append('region', 'id'); // Indonesia
    url.searchParams.append('language', 'id'); // Indonesian
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Directions API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if Google returned an error
    if (data.status !== 'OK') {
      console.error('Google Directions API error:', data);
      return NextResponse.json(
        { error: `Directions API error: ${data.status}`, details: data.error_message },
        { status: 400 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Directions API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}