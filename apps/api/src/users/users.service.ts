import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    async findByPhone(phone: string) {
        return this.prisma.user.findUnique({
            where: { phone },
            include: {
                driverProfile: true,
            },
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
            include: {
                driverProfile: true,
            },
        });
    }

    async create(userData: any) {
        return this.prisma.user.create({
            data: userData,
        });
    }

    async updateLastLogin(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
        });
    }

    // Get all active refresh tokens for a user
    async getActiveRefreshTokens(userId: string) {
        return this.prisma.refreshToken.findMany({
            where: {
                userId,
                isRevoked: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
            select: {
                id: true,
                deviceId: true,
                userAgent: true,
                ipAddress: true,
                lastUsedAt: true,
                createdAt: true,
                expiresAt: true,
            },
        });
    }

    // Save new refresh token
    async saveRefreshToken(userId: string, refreshToken: string, deviceId?: string, userAgent?: string, ipAddress?: string) {
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        
        return this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                deviceId,
                userAgent,
                ipAddress,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });
    }

    // Update existing refresh token (for token rotation)
    async updateRefreshToken(userId: string, oldRefreshToken: string, newRefreshToken: string, deviceId?: string) {
        const oldTokenHash = await bcrypt.hash(oldRefreshToken, 10);
        const newTokenHash = await bcrypt.hash(newRefreshToken, 10);

        // First, find and revoke the old token
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

        // Create new token
        return this.saveRefreshToken(userId, newRefreshToken, deviceId);
    }

    // Validate refresh token
    async validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        
        // Find active tokens for this user
        const activeTokens = await this.prisma.refreshToken.findMany({
            where: {
                userId,
                isRevoked: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        // Check if any of the active tokens match
        for (const token of activeTokens) {
            const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
            if (isMatch) {
                // Update last used time
                await this.prisma.refreshToken.update({
                    where: { id: token.id },
                    data: { lastUsedAt: new Date() },
                });
                return true;
            }
        }

        return false;
    }

    // Revoke refresh tokens by device
    async revokeRefreshTokensByDevice(userId: string, deviceId: string) {
        return this.prisma.refreshToken.updateMany({
            where: {
                userId,
                deviceId,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });
    }

    // Revoke all refresh tokens for a user
    async revokeAllRefreshTokens(userId: string) {
        return this.prisma.refreshToken.updateMany({
            where: {
                userId,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });
    }

    // Legacy method - revoke refresh token (keeping for backward compatibility)
    async revokeRefreshToken(userId: string, deviceId?: string) {
        if (deviceId) {
            return this.revokeRefreshTokensByDevice(userId, deviceId);
        } else {
            return this.revokeAllRefreshTokens(userId);
        }
    }

    // Clean up expired tokens (should be called periodically)
    async cleanupExpiredTokens() {
        return this.prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    {
                        expiresAt: {
                            lt: new Date(),
                        },
                    },
                    {
                        isRevoked: true,
                        revokedAt: {
                            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
                        },
                    },
                ],
            },
        });
    }

    // Get user session info
    async getUserSessions(userId: string) {
        return this.prisma.refreshToken.findMany({
            where: {
                userId,
                isRevoked: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
            select: {
                deviceId: true,
                userAgent: true,
                ipAddress: true,
                lastUsedAt: true,
                createdAt: true,
            },
            orderBy: {
                lastUsedAt: 'desc',
            },
        });
    }
}