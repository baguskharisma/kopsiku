'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { loginSchema, LoginInput } from '../../lib/validations/auth';
import { apiFetch } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginResponse = {
	user: {
		id: string;
		name: string;
		phone: string;
		email?: string | null;
		role: string;
		avatarUrl?: string | null;
		isVerified: boolean;
	};
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
};

export function LoginForm() {
	const [loading, setLoading] = React.useState(false);

	const form = useForm({
		resolver: zodResolver(loginSchema),
		defaultValues: { phone: '', password: '', remember: false },
		mode: 'onSubmit',
	});

	async function onSubmit(values: LoginInput) {
		try {
			setLoading(true);
			const deviceId = values.remember
				? (typeof window !== 'undefined' && (localStorage.getItem('device_id') || crypto.randomUUID()))
				: undefined;

			if (values.remember && typeof window !== 'undefined' && deviceId) {
				localStorage.setItem('device_id', deviceId);
			}

			const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: values.phone,
                    password: values.password,
                    remember: values.remember,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.message || 'Gagal masuk');
            }

			// // Simpan access token di memory/cookie httpOnly via API proxy; untuk demo:
			// if (typeof window !== 'undefined') {
			// 	sessionStorage.setItem('access_token', res.accessToken);
			// 	if (values.remember) localStorage.setItem('refresh_token', res.refreshToken);

            //     // Set cookie agar bisa dibaca middleware (non-HttpOnly untuk contoh; di produksi sebaiknya via API route)
	        //     document.cookie = `access_token=${res.accessToken}; path=/; max-age=${res.expiresIn}; samesite=lax`;
			// }

			// toast.success('Berhasil masuk', {
			// 	description: `Selamat datang, ${res.user.name}`,
			// });
			
			// redirect ke dashboard
			window.location.href = '/';
		} catch (e: any) {
			toast.error('Gagal masuk', {
				description: e.message || 'Periksa kembali kredensial Anda',
			});
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full max-w-sm mx-auto">
			<div className="space-y-2">
				<Label htmlFor="phone">Nomor HP</Label>
				<Input
					id="phone"
					placeholder="08xxxxxxxxxx"
					{...form.register('phone')}
					disabled={loading}
				/>
				{form.formState.errors.phone && (
					<p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Kata Sandi</Label>
				<Input
					id="password"
					type="password"
					placeholder="********"
					{...form.register('password')}
					disabled={loading}
				/>
				{form.formState.errors.password && (
					<p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
				)}
			</div>

			{/* <div className="flex items-center justify-between">
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" className="h-4 w-4" {...form.register('remember')} disabled={loading} />
					Ingat perangkat ini
				</label> */}
				{/* <a href="/forgot-password" className="text-sm text-primary hover:underline">Lupa kata sandi?</a> */}
			{/* </div> */}

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? 'Memproses...' : 'Masuk'}
			</Button>

			{/* <p className="text-center text-sm text-muted-foreground">
				Belum punya akun? <a className="text-primary hover:underline" href="/register">Daftar</a>
			</p> */}
		</form>
	);
}