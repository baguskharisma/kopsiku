import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export async function POST(req: Request) {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get('access_token')?.value;
	const deviceId = cookieStore.get('device_id')?.value;

	if (accessToken) {
		await fetch(`${API_BASE}/auth/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ deviceId }),
		}).catch(() => {});
	}

	// Gunakan protokol request untuk menentukan secure flag secara dinamis
	const url = new URL(req.url);
	const isHttps = url.protocol === 'https:';
	const isProd = process.env.NODE_ENV === 'production' || isHttps;
	const res = NextResponse.json({ message: 'Logged out' }, { status: 200 });

	// Hapus cookies
	for (const name of ['access_token', 'refresh_token']) {
		res.cookies.set(name, '', {
			httpOnly: true,
			secure: isProd,
			sameSite: 'lax',
			path: '/',
			maxAge: 0,
		});
	}
	// device_id boleh disimpan, tapi jika ingin bersihkan:
	res.cookies.set('device_id', '', {
		httpOnly: true,
		secure: isProd,
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	});

	return res;
}