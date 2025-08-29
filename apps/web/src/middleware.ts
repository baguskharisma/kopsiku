// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// const AUTH_COOKIE = 'access_token';

// export function middleware(req: NextRequest) {
// 	const token = req.cookies.get(AUTH_COOKIE)?.value;
// 	const url = req.nextUrl;

// 	const isAuthPage = url.pathname.startsWith('/login');
// 	const isProtected = !isAuthPage; // semua selain login dianggap protected; sesuaikan jika perlu

// 	// Jika sudah login, jangan biarkan ke halaman login
// 	if (token && isAuthPage) {
// 		const target = new URL('/', req.url);
// 		return NextResponse.redirect(target);
// 	}

// 	// Jika belum login, jangan biarkan ke halaman protected
// 	if (!token && isProtected) {
// 		const target = new URL('/login', req.url);
// 		return NextResponse.redirect(target);
// 	}

// 	const res = NextResponse.next();
// 	res.headers.set('x-auth-token-present', token ? '1' : '0');
// 	return res;
// }

// export const config = {
// 	// Sesuaikan daftar route yang ingin diawasi
// 	matcher: [
// 		'/',
// 		'/dashboard/:path*',
// 		'/login',
// 	],
// };