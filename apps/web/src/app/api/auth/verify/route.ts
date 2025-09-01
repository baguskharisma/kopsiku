import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    console.log('🔑 Token from cookie:', accessToken ? 'Present' : 'Missing');

    if (!accessToken) {
      return NextResponse.json({ error: 'No token found' }, { status: 401 });
    }

    // Verify token dengan backend
    const response = await fetch(`${API_BASE}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('🌐 Backend verify response:', response.status);

    if (!response.ok) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    const userData = await response.json();
    return NextResponse.json({ 
      valid: true, 
      user: userData.user 
    });

  } catch (error) {
    console.error('❌ Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}