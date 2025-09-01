'use client';

import * as React from 'react';
import { useAuth } from '@/lib/use-auth';

export function LogoutButton() {
	const [loading, setLoading] = React.useState(false);
	const { checkAuth } = useAuth();

	async function handleLogout() {
		try {
			setLoading(true);
			
			const response = await fetch('/api/auth/logout', { 
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			if (response.ok) {
				// Bersihkan client storage jika ada
				if (typeof window !== 'undefined') {
					sessionStorage.removeItem('access_token');
					localStorage.removeItem('refresh_token');
					localStorage.removeItem('device_id');
				}
				
				// Update auth context
				checkAuth();
				
				// Redirect ke login
				window.location.href = '/login';
			} else {
				console.error('Logout failed:', await response.text());
				window.location.href = '/login';
			}
		} catch (error) {
			console.error('Logout error:', error);
			window.location.href = '/login';
		} finally {
			setLoading(false);
		}
	}

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={loading}
			className="inline-flex items-center px-3 py-2 rounded bg-transparent border border-red-500 w-full text-red-500 hover:bg-red-50 disabled:opacity-50"
		>
			{loading ? 'Keluar...' : 'Keluar'}
		</button>
	);
}