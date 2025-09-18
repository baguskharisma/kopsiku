import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, DriverStatus, VehicleType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
  VerifyDriverQrImageDto,
  UpdateDriverQrImageDto,
  DriverProfileResponseDto,
} from './dto/driver-profile.dto';

@Injectable()
export class DriverProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async createDriverProfile(
    userId: string,
    createDriverProfileDto: CreateDriverProfileDto,
  ): Promise<DriverProfileResponseDto> {
    // Verify user exists and has DRIVER role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.role !== Role.DRIVER) {
      throw new ForbiddenException(
        'Hanya user dengan role DRIVER yang dapat membuat driver profile',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException('User tidak aktif');
    }

    // Check if driver profile already exists
    const existingProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Driver profile sudah ada untuk user ini');
    }

    // Check license number uniqueness
    if (createDriverProfileDto.licenseNumber) {
      const existingLicense = await this.prisma.driverProfile.findUnique({
        where: { licenseNumber: createDriverProfileDto.licenseNumber },
      });

      if (existingLicense) {
        throw new ConflictException('Nomor SIM sudah terdaftar');
      }
    }

    // Check ID card uniqueness if provided
    if (createDriverProfileDto.idCardNumber) {
      const existingIdCard = await this.prisma.driverProfile.findUnique({
        where: { idCardNumber: createDriverProfileDto.idCardNumber },
      });

      if (existingIdCard) {
        throw new ConflictException('Nomor KTP sudah terdaftar');
      }
    }

    const driverProfile = await this.prisma.driverProfile.create({
      data: {
        userId,
        licenseNumber: createDriverProfileDto.licenseNumber,
        licenseExpiry: new Date(createDriverProfileDto.licenseExpiry),
        idCardNumber: createDriverProfileDto.idCardNumber,
        address: createDriverProfileDto.address,
        emergencyContact: createDriverProfileDto.emergencyContact,
        bankAccount: createDriverProfileDto.bankAccount,
        bankName: createDriverProfileDto.bankName,
        qrImageUrl: createDriverProfileDto.qrImageUrl,
        qrImageUploadedAt: createDriverProfileDto.qrImageUrl
          ? new Date()
          : null,
        qrImageVerified: false, // Always false when created
        maxRadius: createDriverProfileDto.maxRadius || 10,
        preferredVehicleTypes:
          createDriverProfileDto.preferredVehicleTypes || [],
        driverStatus: DriverStatus.PENDING_VERIFICATION,
      },
    });

    return this.formatDriverProfileResponse(driverProfile);
  }

  async updateDriverProfile(
    userId: string,
    updateDriverProfileDto: UpdateDriverProfileDto,
  ): Promise<DriverProfileResponseDto> {
    const driverProfile = await this.findDriverProfileByUserId(userId);

    // Check license number uniqueness if being updated
    if (
      updateDriverProfileDto.licenseNumber &&
      updateDriverProfileDto.licenseNumber !== driverProfile.licenseNumber
    ) {
      const existingLicense = await this.prisma.driverProfile.findUnique({
        where: { licenseNumber: updateDriverProfileDto.licenseNumber },
      });

      if (existingLicense && existingLicense.id !== driverProfile.id) {
        throw new ConflictException(
          'Nomor SIM sudah terdaftar oleh driver lain',
        );
      }
    }

    // Check ID card uniqueness if being updated
    if (
      updateDriverProfileDto.idCardNumber &&
      updateDriverProfileDto.idCardNumber !== driverProfile.idCardNumber
    ) {
      const existingIdCard = await this.prisma.driverProfile.findUnique({
        where: { idCardNumber: updateDriverProfileDto.idCardNumber },
      });

      if (existingIdCard && existingIdCard.id !== driverProfile.id) {
        throw new ConflictException(
          'Nomor KTP sudah terdaftar oleh driver lain',
        );
      }
    }

    const updateData: any = {
      ...updateDriverProfileDto,
      updatedAt: new Date(),
    };

    // Handle license expiry date conversion
    if (updateDriverProfileDto.licenseExpiry) {
      updateData.licenseExpiry = new Date(updateDriverProfileDto.licenseExpiry);
    }

    // Handle QR image update - reset verification status if QR image is updated
    if (
      updateDriverProfileDto.qrImageUrl &&
      updateDriverProfileDto.qrImageUrl !== driverProfile.qrImageUrl
    ) {
      updateData.qrImageUploadedAt = new Date();
      updateData.qrImageVerified = false;
      updateData.qrImageVerifiedBy = null;
      updateData.qrImageVerifiedAt = null;
    }

    const updatedProfile = await this.prisma.driverProfile.update({
      where: { userId },
      data: updateData,
    });

    return this.formatDriverProfileResponse(updatedProfile);
  }

  async updateDriverQrImage(
    userId: string,
    updateQrImageDto: UpdateDriverQrImageDto,
  ): Promise<DriverProfileResponseDto> {
    const driverProfile = await this.findDriverProfileByUserId(userId);

    const updatedProfile = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        qrImageUrl: updateQrImageDto.qrImageUrl,
        qrImageUploadedAt: new Date(),
        qrImageVerified: false, // Reset verification when new QR is uploaded
        qrImageVerifiedBy: null,
        qrImageVerifiedAt: null,
        updatedAt: new Date(),
      },
    });

    return this.formatDriverProfileResponse(updatedProfile);
  }

  async verifyDriverQrImage(
    driverProfileId: string,
    adminUserId: string,
    verifyQrImageDto: VerifyDriverQrImageDto,
  ): Promise<DriverProfileResponseDto> {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile tidak ditemukan');
    }

    if (!driverProfile.qrImageUrl) {
      throw new BadRequestException('Driver belum mengupload QR image');
    }

    const updatedProfile = await this.prisma.driverProfile.update({
      where: { id: driverProfileId },
      data: {
        qrImageVerified: verifyQrImageDto.isVerified,
        qrImageVerifiedBy: adminUserId,
        qrImageVerifiedAt: new Date(),
        verificationNotes: verifyQrImageDto.notes
          ? `${driverProfile.verificationNotes || ''}\n[QR IMAGE] ${verifyQrImageDto.notes}`.trim()
          : driverProfile.verificationNotes,
        updatedAt: new Date(),
      },
    });

    return this.formatDriverProfileResponse(updatedProfile);
  }

  async getDriverProfile(userId: string): Promise<DriverProfileResponseDto> {
    const driverProfile = await this.findDriverProfileByUserId(userId);
    return this.formatDriverProfileResponse(driverProfile);
  }

  async getDriverProfileById(
    profileId: string,
  ): Promise<DriverProfileResponseDto> {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { id: profileId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile tidak ditemukan');
    }

    return this.formatDriverProfileResponse(driverProfile);
  }

  async getAllDriverProfiles(options: {
    page?: number;
    limit?: number;
    status?: DriverStatus;
    isVerified?: boolean;
    qrImageVerified?: boolean;
    search?: string;
  }) {
    const {
      page = 1,
      limit = 10,
      status,
      isVerified,
      qrImageVerified,
      search,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.driverStatus = status;
    }

    if (typeof isVerified === 'boolean') {
      where.isVerified = isVerified;
    }

    if (typeof qrImageVerified === 'boolean') {
      where.qrImageVerified = qrImageVerified;
    }

    if (search) {
      where.OR = [
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { idCardNumber: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { bankAccount: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [profiles, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              isActive: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      data: profiles.map((profile) => ({
        ...this.formatDriverProfileResponse(profile),
        user: profile.user,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnverifiedQrImages() {
    const profiles = await this.prisma.driverProfile.findMany({
      where: {
        qrImageUrl: { not: null },
        qrImageVerified: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { qrImageUploadedAt: 'asc' },
    });

    return profiles.map((profile) => ({
      ...this.formatDriverProfileResponse(profile),
      user: profile.user,
    }));
  }

  private async findDriverProfileByUserId(userId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile tidak ditemukan');
    }

    return driverProfile;
  }

  private formatDriverProfileResponse(profile: any): DriverProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      licenseNumber: profile.licenseNumber,
      licenseExpiry: profile.licenseExpiry,
      idCardNumber: profile.idCardNumber,
      address: profile.address,
      emergencyContact: profile.emergencyContact,
      bankAccount: profile.bankAccount,
      bankName: profile.bankName,
      qrImageUrl: profile.qrImageUrl,
      qrImageUploadedAt: profile.qrImageUploadedAt,
      qrImageVerified: profile.qrImageVerified,
      qrImageVerifiedBy: profile.qrImageVerifiedBy,
      qrImageVerifiedAt: profile.qrImageVerifiedAt,
      isVerified: profile.isVerified,
      verifiedAt: profile.verifiedAt,
      verifiedBy: profile.verifiedBy,
      verificationNotes: profile.verificationNotes,
      rating: profile.rating,
      totalTrips: profile.totalTrips,
      completedTrips: profile.completedTrips,
      cancelledTrips: profile.cancelledTrips,
      totalEarnings: profile.totalEarnings.toString(),
      currentLat: profile.currentLat,
      currentLng: profile.currentLng,
      lastLocationUpdate: profile.lastLocationUpdate,
      driverStatus: profile.driverStatus,
      statusChangedAt: profile.statusChangedAt,
      maxRadius: profile.maxRadius,
      preferredVehicleTypes: profile.preferredVehicleTypes,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
