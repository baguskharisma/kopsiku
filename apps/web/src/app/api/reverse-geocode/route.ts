import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng') || searchParams.get('lon'); // Support both lng and lon

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
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

    // Build URL for Google Reverse Geocoding API
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('latlng', `${lat},${lng}`);
    url.searchParams.append('language', 'id'); // Indonesian
    url.searchParams.append('region', 'id'); // Indonesia
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Reverse Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if Google returned an error
    if (data.status !== 'OK') {
      console.error('Google Reverse Geocoding API error:', data);
      
      // Fallback response for backward compatibility
      return NextResponse.json({
        display_name: `${lat}, ${lng}`,
        formatted_address: `${lat}, ${lng}`,
        error: `Reverse geocoding error: ${data.status}`
      });
    }

    // Return the first result with backward compatibility
    const result = data.results[0];
    return NextResponse.json({
      display_name: result.formatted_address, // For OSM compatibility
      formatted_address: result.formatted_address, // Google format
      results: data.results, // Full results if needed
    });

  } catch (error) {
    console.error('Reverse geocoding API proxy error:', error);
    
    // Return coordinates as fallback
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng') || searchParams.get('lon');
    
    return NextResponse.json({
      display_name: `${lat}, ${lng}`,
      formatted_address: `${lat}, ${lng}`,
      error: 'Reverse geocoding failed'
    });
  }
}