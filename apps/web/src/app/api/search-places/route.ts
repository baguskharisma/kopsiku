import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
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

    // Use Google Places Text Search API with specific location bias for Pekanbaru
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.append('query', query);
    url.searchParams.append('language', 'id');
    url.searchParams.append('region', 'id');
    // Add location bias for Pekanbaru area
    url.searchParams.append('location', '0.5167,-101.4333'); // Pekanbaru coordinates
    url.searchParams.append('radius', '50000'); // 50km radius
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data);
      return NextResponse.json(
        { error: `Places search error: ${data.status}` },
        { status: 500 }
      );
    }

    // Process results with improved name extraction logic
    const formattedResults = data.results?.slice(0, limit).map((place: any) => {
      let placeName = 'Unknown Place';
      
      // Priority 1: Always use place.name if it exists and isn't just an address
      if (place.name) {
        // Check if this is a business/establishment type
        const isEstablishment = place.types?.some((type: string) => 
          [
            'establishment', 
            'point_of_interest', 
            'shopping_mall', 
            'store',
            'shopping_center',
            'restaurant',
            'lodging',
            'hospital',
            'school',
            'university',
            'bank',
            'gas_station',
            'pharmacy',
            'supermarket',
            'department_store',
            'clothing_store',
            'electronics_store',
            'furniture_store',
            'food',
            'meal_takeaway',
            'cafe',
            'bar',
            'night_club',
            'gym',
            'beauty_salon',
            'car_repair',
            'tourist_attraction',
            'amusement_park',
            'zoo',
            'museum',
            'library',
            'church',
            'mosque',
            'hindu_temple',
            'cemetery'
          ].includes(type)
        );

        // If it's an establishment OR if the name doesn't look like a street address, use the name
        if (isEstablishment || 
            (!place.name.includes('Jl.') && 
             !place.name.includes('Jalan') && 
             !place.name.toLowerCase().includes('street') &&
             !place.name.toLowerCase().includes('road') &&
             !/^[0-9]/.test(place.name))) {
          placeName = place.name;
        } else {
          // Fallback to first part of formatted address
          const addressFirstPart = place.formatted_address?.split(',')[0]?.trim();
          placeName = addressFirstPart || place.name;
        }
      } else if (place.formatted_address) {
        // If no name, use first part of address
        placeName = place.formatted_address.split(',')[0].trim();
      }
      
      return {
        ...place,
        name: placeName,
        formatted_address: place.formatted_address || 'Unknown Address',
      };
    }) || [];

    return NextResponse.json({
      results: formattedResults,
      status: data.status,
    });

  } catch (error) {
    console.error('Places search API proxy error:', error);
    return NextResponse.json(
      { error: 'Places search failed' },
      { status: 500 }
    );
  }
}