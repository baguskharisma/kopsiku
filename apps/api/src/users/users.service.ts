import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async saveRefreshToken(userId: string, tokenHash: string, deviceId?: string) {
    // Hash the refresh token before storing
    const hashedToken = await bcrypt.hash(tokenHash, 10);
    
    return this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
        deviceId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const refreshTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    for (const refreshToken of refreshTokens) {
      if (await bcrypt.compare(token, refreshToken.tokenHash)) {
        return true;
      }
    }
    
    return false;
  }

  async revokeRefreshToken(userId: string, deviceId?: string) {
    const where: any = { userId, isRevoked: false };
    
    if (deviceId) {
      where.deviceId = deviceId;
    }

    return this.prisma.refreshToken.updateMany({
      where,
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}