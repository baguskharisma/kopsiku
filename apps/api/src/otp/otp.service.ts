import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OtpService {
	private readonly otpTtlSec: number;
	private readonly resendCooldownSec: number;
	private readonly maxAttempts: number;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
	) {
		this.otpTtlSec = this.config.get<number>('OTP_TTL_SEC', 300);
		this.resendCooldownSec = this.config.get<number>('OTP_RESEND_COOLDOWN_SEC', 60);
		this.maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 3);
	}

	private generateNumericCode(len = 6): string {
		let s = '';
		for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10).toString();
		return s;
	}

	async sendOtp(phone: string, purpose: 'register' | 'login' | 'reset' | 'verify_phone', userId?: string) {
		const latest = await this.prisma.otp.findFirst({
			where: { phone, purpose, isUsed: false },
			orderBy: { createdAt: 'desc' },
		});

		if (latest) {
			const diffSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
			if (diffSec < this.resendCooldownSec) {
				throw new BadRequestException(`Please wait ${Math.ceil(this.resendCooldownSec - diffSec)}s before requesting another OTP`);
			}
		}

		const code = this.generateNumericCode(6);
		const codeHash = await bcrypt.hash(code, 12);

		const expiresAt = new Date(Date.now() + this.otpTtlSec * 1000);

		await this.prisma.otp.create({
			data: {
				phone,
				codeHash,
				purpose,
				userId,
				expiresAt,
				maxAttempts: this.maxAttempts,
			},
		});

		// Integrasikan dengan SMS gateway di production (Twilio, Vonage, Gupshup, dll.)
		// Sementara: log untuk dev
		// console.log(`[OTP] phone=${phone} purpose=${purpose} code=${code} expiresAt=${expiresAt.toISOString()}`);

		return { message: 'OTP sent', expiresAt };
	}

	async verifyOtp(phone: string, purpose: string, code: string) {
		const otp = await this.prisma.otp.findFirst({
			where: { phone, purpose, isUsed: false },
			orderBy: { createdAt: 'desc' },
		});

		if (!otp) throw new UnauthorizedException('OTP not found');

		if (otp.expiresAt < new Date()) {
			await this.prisma.otp.update({ where: { id: otp.id }, data: { isUsed: true } });
			throw new UnauthorizedException('OTP expired');
		}

		if (otp.attempts >= otp.maxAttempts) {
			await this.prisma.otp.update({ where: { id: otp.id }, data: { isUsed: true } });
			throw new BadRequestException('Max attempts exceeded');
		}

		const match = await bcrypt.compare(code, otp.codeHash);
		if (!match) {
			await this.prisma.otp.update({
				where: { id: otp.id },
				data: { attempts: { increment: 1 } },
			});
			throw new UnauthorizedException('Invalid OTP code');
		}

		await this.prisma.otp.update({
			where: { id: otp.id },
			data: { isUsed: true },
		});

		return { valid: true };
	}

	// Opsional: revoke semua OTP aktif untuk phone/purpose
	async revokeActiveOtps(phone: string, purpose: string) {
		await this.prisma.otp.updateMany({
			where: { phone, purpose, isUsed: false },
			data: { isUsed: true },
		});
	}
}