import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { User, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';

export interface CreateUserDto {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role?: Role;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  avatarUrl?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  private readonly saltRounds = 12;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserResponse | null> {
    if (!id) return null;

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    // Convert null email/avatarUrl to undefined to match UserResponse type
    const { email, avatarUrl, ...rest } = user;
    return {
      ...rest,
      email: email === null ? undefined : email,
      avatarUrl: avatarUrl === null ? undefined : avatarUrl,
    };
  }

  async findByPhone(phone: string): Promise<User | null> {
    if (!phone) return null;

    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDto): Promise<UserResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: data.phone },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.phone === data.phone) {
        throw new ConflictException('Nomor telepon sudah terdaftar');
      }
      if (existingUser.email === data.email) {
        throw new ConflictException('Email sudah terdaftar');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, this.saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role || Role.CUSTOMER,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Ensure the returned user matches the UserResponse type (email: string | undefined, avatarUrl: string | undefined)
    return {
      ...user,
      email: user.email ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }

  async update(id: string, data: UpdateUserDto): Promise<UserResponse> {
    if (!id) {
      throw new NotFoundException('User ID is required');
    }

    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Check email uniqueness if email is being updated
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.findByEmail(data.email);
      if (emailExists && emailExists.id !== id) {
        throw new ConflictException('Email sudah digunakan oleh user lain');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Ensure the returned user matches the UserResponse type (email: string | undefined, avatarUrl: string | undefined)
    return {
      ...updatedUser,
      email: updatedUser.email ?? undefined,
      avatarUrl: updatedUser.avatarUrl ?? undefined,
    };
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!id) {
      throw new NotFoundException('User ID is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new ConflictException('Password saat ini tidak benar');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedNewPassword,
        updatedAt: new Date(),
      },
    });
  }

  async deactivate(id: string): Promise<void> {
    if (!id) {
      throw new NotFoundException('User ID is required');
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async activate(id: string): Promise<void> {
    if (!id) {
      throw new NotFoundException('User ID is required');
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  async verifyUser(id: string): Promise<void> {
    if (!id) {
      throw new NotFoundException('User ID is required');
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        updatedAt: new Date(),
      },
    });
  }

  async findMany(options: {
    page?: number;
    limit?: number;
    role?: Role;
    isActive?: boolean;
    search?: string;
  }) {
    const { page = 1, limit = 10, role, isActive, search } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          avatarUrl: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
