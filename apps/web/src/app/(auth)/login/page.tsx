import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6">
				<div className="space-y-2 text-center">
					<h1 className="text-2xl font-semibold">Masuk ke Akun</h1>
					<p className="text-sm text-muted-foreground">Silakan gunakan nomor HP dan kata sandi Anda.</p>
				</div>
				<LoginForm />
			</div>
		</div>
	);
}