import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from 'bcryptjs';
import { LoginDto } from "src/auth/dto/login.dto";
import { RefreshTokenDto } from "src/auth/dto/refresh-token.dto";
import { RegisterDto } from "src/auth/dto/register.dto";
import { OtpService } from "src/otp/otp.service";
import { UsersService } from "src/users/users.service";

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private otpService: OtpService,
    ) {}

    async validateUser(phone: string, password: string): Promise<any> {
        const user = await this.usersService.findByPhone(phone);
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(loginDto: LoginDto) {
        const { phone, password, deviceId, deviceName, userAgent, ipAddress } = loginDto;

        // Validate user credentials
        const user = await this.validateUser(phone, password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token with device info - allowing multiple devices
        await this.usersService.saveRefreshToken(
            user.id, 
            tokens.refreshToken, 
            deviceId, 
            userAgent, 
            ipAddress
        );

        // Update last login
        await this.usersService.updateLastLogin(user.id);

        return {
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
                isVerified: user.isVerified,
            },
            ...tokens,
        };
    }

    async register(registerDto: RegisterDto) {
        const { phone, password, name, email } = registerDto;

        // Check if user already exists
        const existingUser = await this.usersService.findByPhone(phone);
        if (existingUser) {
            throw new BadRequestException('Nomor HP sudah terdaftar');
        }

        if (email) {
            const existingEmail = await this.usersService.findByEmail(email);
            if (existingEmail) {
                throw new BadRequestException('Email sudah terdaftar');
            }
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await this.usersService.create({
            ...registerDto,
            passwordHash,
            role: Role.CUSTOMER, // Default role
        });

        // Send OTP for phone verification
        await this.otpService.sendOtp(phone, 'verify_phone', user.id);

        return {
            message: 'Registrasi berhasil. Mohon verifikasi nomor handphone kamu.',
            userId: user.id,
        };
    }

    async refreshToken(refreshTokenDto: RefreshTokenDto) {
        try {
            const payload = this.jwtService.verify(refreshTokenDto.refreshToken);
            const user = await this.usersService.findById(payload.sub);

            if (!user) {
                throw new UnauthorizedException('Pengguna tidak ditemukan');
            }

            if (!user.isActive) {
                throw new UnauthorizedException('Akun tidak aktif');
            }

            // Verify refresh token exists in database and is not revoked
            const isValidRefreshToken = await this.usersService.validateRefreshToken(
                user.id,
                refreshTokenDto.refreshToken,
            );

            if (!isValidRefreshToken) {
                throw new UnauthorizedException('Refresh token tidak valid atau sudah kadaluarsa');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user);

            // Update refresh token
            await this.usersService.updateRefreshToken(
                user.id,
                refreshTokenDto.refreshToken,
                tokens.refreshToken,
                refreshTokenDto.deviceId,
            );

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Refresh token tidak valid');
        }
    }

    async logout(userId: string, deviceId?: string) {
        if (deviceId) {
            await this.usersService.revokeRefreshTokensByDevice(userId, deviceId);
        } else {
            await this.usersService.revokeAllRefreshTokens(userId);
        }
        return { message: 'Logged out successfully' };
    }

    // Method to force logout from all devices (admin function)
    async logoutAllDevices(userId: string) {
        await this.usersService.revokeAllRefreshTokens(userId);
        return { message: 'Logged out from all devices successfully' };
    }

    // Method to get active sessions
    async getActiveSessions(userId: string) {
        const activeTokens = await this.usersService.getActiveRefreshTokens(userId);
        return activeTokens.map(token => ({
            deviceId: token.deviceId,
            userAgent: token.userAgent,
            ipAddress: token.ipAddress,
            lastUsedAt: token.lastUsedAt,
            createdAt: token.createdAt,
        }));
    }

    private async generateTokens(user: any) {
        const payload = {
            sub: user.id,
            phone: user.phone,
            role: user.role,
            iat: Math.floor(Date.now() / 1000), // Add issued at time
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, { expiresIn: '1h' }), // Shorter access token
            this.jwtService.signAsync(payload, { expiresIn: '7d' }),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn: 60 * 60, // 1 hour in seconds
        };
    }
}