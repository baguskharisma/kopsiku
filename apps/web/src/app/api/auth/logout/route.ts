import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export async function POST(req: Request) {
	try {
		const cookieStore = await cookies();
		const accessToken = cookieStore.get('access_token')?.value;
		const deviceId = cookieStore.get('device_id')?.value;

		// Call backend logout jika ada token
		if (accessToken) {
			try {
				await fetch(`${API_BASE}/auth/logout`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({ deviceId }),
				});
			} catch (backendError) {
				console.warn('Backend logout failed, but continuing with cookie cleanup:', backendError);
			}
		}

		// Determine secure flag
		const url = new URL(req.url);
		const isHttps = url.protocol === 'https:';
		const isProd = process.env.NODE_ENV === 'production' || isHttps;
		
		const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });

		// Clear all auth-related cookies
		const cookieOptions = {
			httpOnly: true,
			secure: isProd,
			sameSite: 'lax' as const,
			path: '/',
			maxAge: 0, // This deletes the cookie
		};

		response.cookies.set('access_token', '', cookieOptions);
		response.cookies.set('refresh_token', '', cookieOptions);
		
		// Optional: keep device_id or clear it
		// response.cookies.set('device_id', '', cookieOptions);

		return response;
	} catch (error) {
		console.error('Logout API error:', error);
		return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
	}
}