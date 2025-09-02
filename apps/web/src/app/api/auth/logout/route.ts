import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const deviceId = cookieStore.get('device_id')?.value;

    // Call backend logout
    if (refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: deviceId || 'web-browser',
          }),
        });
      } catch (error) {
        console.error('Backend logout error:', error);
        // Continue to clear cookies even if backend call fails
      }
    }

    // Create response and clear cookies
    const response = NextResponse.json({ message: 'Logged out successfully' });
    
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    response.cookies.delete('device_id');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}