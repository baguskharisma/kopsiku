import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, Role } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface JwtPayload {
  sub?: string;
  id?: string;
  phone: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends TokenPair {
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: Role;
    avatarUrl?: string;
    isVerified: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;
  private readonly refreshTokenTTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: dto.phone },
            ...(dto.email ? [{ email: dto.email }] : []),
          ],
        },
      });

      if (existingUser) {
        if (existingUser.phone === dto.phone) {
          throw new ConflictException('Nomor telepon sudah terdaftar');
        }
        if (existingUser.email === dto.email) {
          throw new ConflictException('Email sudah terdaftar');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          passwordHash: hashedPassword,
          role: dto.role || Role.CUSTOMER,
          isActive: true,
          isVerified: false,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
          isActive: true,
        },
      });

      // Generate tokens
      const tokens = await this.generateTokens(user, dto.deviceId);

      return {
        ...tokens,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email ?? undefined,
          role: user.role,
          avatarUrl: user.avatarUrl ?? undefined,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Gagal membuat akun');
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      // Find user by phone
      const user = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
          isActive: true,
          passwordHash: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Nomor telepon atau password salah');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Akun Anda telah dinonaktifkan');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Nomor telepon atau password salah');
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Remove password from response
      const { passwordHash, ...userWithoutPassword } = user;

      // Generate tokens
      const tokens = await this.generateTokens(user, dto.deviceId);

      return {
        ...tokens,
        user: {
          ...userWithoutPassword,
          // Ensure email and avatarUrl are undefined if null, to match type
          email: userWithoutPassword.email ?? undefined,
          avatarUrl: userWithoutPassword.avatarUrl ?? undefined,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Gagal login');
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<TokenPair> {
    try {
      const hashedToken = this.hashToken(dto.refreshToken);

      // Find refresh token in database
      const refreshTokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash: hashedToken,
          isRevoked: false,
          expiresAt: { gt: new Date() },
          ...(dto.deviceId ? { deviceId: dto.deviceId } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      if (!refreshTokenRecord) {
        throw new UnauthorizedException(
          'Refresh token tidak valid atau telah kedaluwarsa',
        );
      }

      if (!refreshTokenRecord.user.isActive) {
        // Revoke token for inactive user
        await this.revokeRefreshToken(refreshTokenRecord.id);
        throw new UnauthorizedException('Akun telah dinonaktifkan');
      }

      // Update last used timestamp
      await this.prisma.refreshToken.update({
        where: { id: refreshTokenRecord.id },
        data: { lastUsedAt: new Date() },
      });

      // Generate new tokens
      const tokens = await this.generateTokens(
        refreshTokenRecord.user,
        dto.deviceId,
      );

      // Revoke old refresh token
      await this.revokeRefreshToken(refreshTokenRecord.id);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Gagal refresh token');
    }
  }

  async logout(userId: string, deviceId?: string): Promise<void> {
    try {
      const where: any = {
        userId,
        isRevoked: false,
      };

      if (deviceId) {
        where.deviceId = deviceId;
      }

      // Revoke refresh tokens
      await this.prisma.refreshToken.updateMany({
        where,
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Gagal logout');
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify(token);

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Token tidak valid');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException(
        'Token tidak valid atau telah kedaluwarsa',
      );
    }
  }

  async revokeAllTokens(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Gagal revoke tokens');
    }
  }

  private async generateTokens(
    user: Pick<User, 'id' | 'phone' | 'role'>,
    deviceId?: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();
    const expiresIn = this.configService.get<number>(
      'JWT_EXPIRES_IN_SECONDS',
      3600,
    );

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken, deviceId);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceId?: string,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTTL);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
        deviceId: deviceId || 'web-browser',
        expiresAt,
      },
    });
  }

  private async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  // Cleanup expired tokens (should be called by a cron job)
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              isRevoked: true,
              revokedAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              }, // 30 days old
            },
          ],
        },
      });

      return result.count;
    } catch (error) {
      throw new InternalServerErrorException('Gagal cleanup expired tokens');
    }
  }
}
