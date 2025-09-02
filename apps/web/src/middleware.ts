import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

// Fungsi untuk memvalidasi token dengan backend
async function validateTokenWithBackend(token: string): Promise<boolean> {
	try {
		const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';
		const response = await fetch(`${API_BASE}/auth/verify-token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
			},
		});

		return response.ok;
	} catch (error) {
		console.error('Token validation error:', error);
		return false;
	}
}

// Fungsi untuk refresh token
async function refreshAccessToken(refreshToken: string, deviceId?: string): Promise<{accessToken: string, refreshToken: string} | null> {
	try {
		const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://kopsiku.com:3001/api/v1';
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

		if (response.ok) {
			const data = await response.json();
			return {
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
			};
		}
		return null;
	} catch (error) {
		console.error('Token refresh error:', error);
		return null;
	}
}

export async function middleware(req: NextRequest) {
	const accessToken = req.cookies.get(AUTH_COOKIE)?.value;
	const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
	const deviceId = req.cookies.get('device_id')?.value;
	const url = req.nextUrl;

	console.log('Middleware executed for:', url.pathname);
	console.log('Access token present:', !!accessToken);
	console.log('Refresh token present:', !!refreshToken);

	// Route yang tidak memerlukan autentikasi
	const publicRoutes = ['/login', '/register'];
	
	// Route yang memerlukan autentikasi
	const protectedRoutes = ['/', '/dashboard', '/taxi', '/driver'];

	const isPublicRoute = publicRoutes.includes(url.pathname);
	const isProtectedRoute = protectedRoutes.some(route => {
		// Exact match untuk root path
		if (route === '/' && url.pathname === '/') {
			return true;
		}
		// Path starts with untuk sub-routes
		if (route !== '/' && (url.pathname.startsWith(route + '/') || url.pathname === route)) {
			return true;
		}
		return false;
	});

	console.log('Is public route:', isPublicRoute);
	console.log('Is protected route:', isProtectedRoute);

	// Jika mengakses protected route
	if (isProtectedRoute) {
		let validToken = false;
		
		// Cek access token dulu
		if (accessToken) {
			validToken = await validateTokenWithBackend(accessToken);
			console.log('Access token valid:', validToken);
		}

		// Jika access token tidak valid, coba refresh
		if (!validToken && refreshToken) {
			console.log('Attempting to refresh token');
			const newTokens = await refreshAccessToken(refreshToken, deviceId);
			
			if (newTokens) {
				console.log('Token refreshed successfully');
				// Buat response dengan redirect ke halaman yang sama untuk set cookie baru
				const response = NextResponse.redirect(req.url);
				
				// Set cookie baru dengan deteksi HTTPS
				const isHttps = req.nextUrl.protocol === 'https:';
				const isProd = process.env.NODE_ENV === 'production' || isHttps;
				
				response.cookies.set(AUTH_COOKIE, newTokens.accessToken, {
					httpOnly: true,
					secure: isProd,
					sameSite: 'lax',
					maxAge: 60 * 60, // 1 hour
					path: '/',
				});
				
				response.cookies.set(REFRESH_COOKIE, newTokens.refreshToken, {
					httpOnly: true,
					secure: isProd,
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 7, // 7 days
					path: '/',
				});
				
				return response;
			} else {
				console.log('Token refresh failed');
			}
		}

		// Jika tidak ada token valid, redirect ke login
		if (!validToken) {
			console.log('Redirecting unauthenticated user to login');
			const response = NextResponse.redirect(new URL('/login', req.url));
			
			// Clear cookies
			response.cookies.delete(AUTH_COOKIE);
			response.cookies.delete(REFRESH_COOKIE);
			
			return response;
		}
	}

	// Jika sudah login dan mencoba akses halaman login, redirect ke dashboard
	if ((accessToken || refreshToken) && isPublicRoute) {
		// Validasi token sekali lagi untuk memastikan masih valid
		let isValidSession = false;
		
		if (accessToken) {
			isValidSession = await validateTokenWithBackend(accessToken);
		}
		
		if (!isValidSession && refreshToken) {
			const newTokens = await refreshAccessToken(refreshToken);
			isValidSession = !!newTokens;
		}
		
		if (isValidSession) {
			console.log('Redirecting authenticated user from public route to home');
			return NextResponse.redirect(new URL('/', req.url));
		} else {
			// Token tidak valid, clear cookies dan biarkan akses public route
			const response = NextResponse.next();
			response.cookies.delete(AUTH_COOKIE);
			response.cookies.delete(REFRESH_COOKIE);
			return response;
		}
	}

	// Set header untuk debugging
	const res = NextResponse.next();
	res.headers.set('x-auth-token-present', accessToken ? '1' : '0');
	res.headers.set('x-refresh-token-present', refreshToken ? '1' : '0');
	res.headers.set('x-route-type', isProtectedRoute ? 'protected' : (isPublicRoute ? 'public' : 'unmatched'));
	
	console.log('Allowing access to:', url.pathname);
	return res;
}

export const config = {
	matcher: [
		// Exact matches
		'/',
		'/login',
		'/register',
		// Dynamic paths
		'/dashboard/:path*',
		'/taxi/:path*'
	],
};