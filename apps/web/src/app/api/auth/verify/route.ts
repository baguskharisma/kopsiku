import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = (await cookieStore).get('access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: 'No token found' },
        { status: 401 }
      );
    }

    // Verify token with backend
    const response = await fetch(`${API_BASE}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: 'Token invalid' },
        { status: 401 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Verify token error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}