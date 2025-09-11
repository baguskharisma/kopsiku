import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = DEFAULT_BACKEND;
    const queryString = searchParams.toString();
    
    // Get cookies for authentication
    const cookieStore = cookies();
    const authCookie = (await cookieStore).get('access_token');
    
    console.log(`Proxying request to: ${backendUrl}/orders${queryString ? `?${queryString}` : ''}`);
    
    const response = await fetch(`${backendUrl}/orders${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authCookie ? { Cookie: `access_token=${authCookie.value}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        errorJson = { message: errorText };
      }
      
      console.error('Error from backend:', {
        status: response.status,
        statusText: response.statusText,
        error: errorJson
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorJson.message || 'Failed to fetch orders',
          details: errorJson
        }, 
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in order proxy:', error);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = DEFAULT_BACKEND;
    
    // Get cookies for authentication
    const cookieStore = cookies();
    const authCookie = (await cookieStore).get('access_token');
    
    console.log(`Proxying POST request to: ${backendUrl}/orders`);
    
    const response = await fetch(`${backendUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authCookie ? { Cookie: `access_token=${authCookie.value}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        errorJson = { message: errorText };
      }
      
      console.error('Error from backend:', {
        status: response.status,
        statusText: response.statusText,
        error: errorJson
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorJson.message || 'Failed to create order',
          details: errorJson
        }, 
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in order proxy:', error);
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