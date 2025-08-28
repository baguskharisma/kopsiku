'use client';

import * as React from 'react';

export function LogoutButton() {
	const [loading, setLoading] = React.useState(false);

	async function handleLogout() {
		try {
			setLoading(true);
			const accessToken = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
			const deviceId = typeof window !== 'undefined' ? localStorage.getItem('device_id') || undefined : undefined;
			const base = process.env.NEXT_PUBLIC_API_BASE_URL || '';

            await fetch('/api/auth/logout', { method: 'POST' });

            window.location.href = '/login';

			// await fetch(`${base}/auth/logout`, {
			// 	method: 'POST',
			// 	headers: {
			// 		'Content-Type': 'application/json',
			// 		...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			// 	},
			// 	credentials: 'include',
			// 	body: JSON.stringify({ deviceId }),
			// });

			// // Bersihkan client storage + cookie
			// if (typeof window !== 'undefined') {
			// 	sessionStorage.removeItem('access_token');
			// 	localStorage.removeItem('refresh_token');
			// 	// hapus cookie access_token
			// 	document.cookie = 'access_token=; Max-Age=0; path=/; samesite=lax';
			// }
			// window.location.href = '/(auth)/login';
		} finally {
			setLoading(false);
		}
	}

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={loading}
			className="inline-flex items-center px-3 py-2 rounded bg-gray-900 text-white hover:opacity-90"
		>
			{loading ? 'Keluar...' : 'Logout'}
		</button>
	);
}