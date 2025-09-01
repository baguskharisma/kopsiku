import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'access_token';

export function middleware(req: NextRequest) {
	const token = req.cookies.get(AUTH_COOKIE)?.value;
	const url = req.nextUrl;

	// Route yang tidak memerlukan autentikasi
	const publicRoutes = ['/login'];
	
	// Route yang memerlukan autentikasi
	const protectedRoutes = ['/', '/dashboard', '/taxi'];

	const isPublicRoute = publicRoutes.some(route => url.pathname === route);
	const isProtectedRoute = protectedRoutes.some(route => 
		url.pathname === route || url.pathname.startsWith(route + '/')
	);

	// Jika sudah login dan mencoba akses halaman login, redirect ke dashboard/home
	if (token && isPublicRoute) {
		const target = new URL('/', req.url);
		return NextResponse.redirect(target);
	}

	// Jika belum login dan mencoba akses halaman yang dilindungi, redirect ke login
	if (!token && isProtectedRoute) {
		const target = new URL('/login', req.url);
		return NextResponse.redirect(target);
	}

	const res = NextResponse.next();
	res.headers.set('x-auth-token-present', token ? '1' : '0');
	return res;
}

export const config = {
	matcher: [
		'/',
		'/dashboard/:path*',
		'/taxi/:path*',
		'/login',
	],
};