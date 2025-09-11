import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

// Sesuai dengan dokumentasi Next.js terbaru untuk dynamic route segments
export async function GET(
  request: NextRequest,
  context: {
    params: {
      id: string
    }
  }
) {
  const orderId = context.params.id;
  const backendUrl = DEFAULT_BACKEND;
  const cookieStore = cookies();
  const authCookie = (await cookieStore).get('access_token');
  
  try {
    console.log(`Fetching order details from backend: ${backendUrl}/orders/${orderId}`);
    
    const response = await fetch(`${backendUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authCookie ? { Cookie: `access_token=${authCookie.value}` } : {}),
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        errorJson = { message: errorText };
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorJson.message || 'Failed to fetch order details',
          details: errorJson
        }, 
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}