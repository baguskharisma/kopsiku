import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
//   const { phone, password, remember } = body ?? {};
  const { phone, password } = body ?? {};

  // device_id cookie untuk refresh token per device
  const cookieStore = await cookies(); // <<< tambahkan await di sini
  let deviceId = cookieStore.get?.('device_id')?.value;
//   if (remember && !deviceId) {
  if (!deviceId) {
    deviceId = crypto.randomUUID();
  }

	const res = await fetch(`${API_BASE}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ phone, password, deviceId }),
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		return NextResponse.json(data, { status: res.status });
	}

	const accessToken = data?.accessToken as string;
	const refreshToken = data?.refreshToken as string;
	const accessTtl = Number(data?.expiresIn ?? 60 * 60 * 24); // default 24h
	const refreshTtl = 60 * 60 * 24 * 7; // 7d

	// Gunakan protokol request untuk menentukan secure flag secara dinamis
	const url = new URL(req.url);
	const isHttps = url.protocol === 'https:';
	const isProd = process.env.NODE_ENV === 'production' || isHttps;

	const response = NextResponse.json({ user: data.user }, { status: 200 });

	// httpOnly cookies
	response.cookies.set('access_token', accessToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: 'lax',
		path: '/',
		maxAge: accessTtl,
	});
	response.cookies.set('refresh_token', refreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: 'lax',
		path: '/',
		maxAge: refreshTtl,
	});
	// if (remember && deviceId) {
	if (deviceId) {
		response.cookies.set('device_id', deviceId, {
			httpOnly: true,
			secure: isProd,
			sameSite: 'lax',
			path: '/',
			maxAge: 60 * 60 * 24 * 180, // 180d
		});
	}

	return response;
}