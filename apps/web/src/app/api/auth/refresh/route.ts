import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const deviceId = cookieStore.get('device_id')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'No refresh token found' },
        { status: 401 }
      );
    }

    // Call backend refresh
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken,
        deviceId: deviceId || 'web-browser',
      }),
    });

    if (!response.ok) {
      // Clear invalid tokens
      const errorResponse = NextResponse.json(
        { message: 'Refresh token invalid' },
        { status: 401 }
      );
      errorResponse.cookies.delete('access_token');
      errorResponse.cookies.delete('refresh_token');
      return errorResponse;
    }

    const data = await response.json();
    
    // Set new cookies
    const url = new URL('/api/auth/refresh', process.env.NEXTAUTH_URL || 'http://localhost:3000');
    const isHttps = url.protocol === 'https:';
    const isProd = process.env.NODE_ENV === 'production' || isHttps;

    const successResponse = NextResponse.json({ 
      message: 'Token refreshed successfully',
      expiresIn: data.expiresIn 
    });

    successResponse.cookies.set('access_token', data.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: data.expiresIn || 3600,
      path: '/',
    });

    successResponse.cookies.set('refresh_token', data.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return successResponse;
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}