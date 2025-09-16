import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  MinLength, 
  MaxLength, 
  IsDateString,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsUrl,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleType, DriverStatus } from '@prisma/client';

export class CreateDriverProfileDto {
  @ApiProperty({
    description: 'Driver license number',
    example: 'A123456789',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  licenseNumber: string;

  @ApiProperty({
    description: 'License expiry date',
    example: '2025-12-31',
  })
  @IsDateString()
  licenseExpiry: string;

  @ApiPropertyOptional({
    description: 'ID card number',
    example: '3171234567890123',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  idCardNumber?: string;

  @ApiProperty({
    description: 'Driver address',
    example: 'Jl. Sudirman No. 123, Jakarta Pusat',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'Emergency contact number',
    example: '081234567890',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  @Transform(({ value }) => value?.trim())
  emergencyContact: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  bankAccount?: string;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Bank Central Asia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  bankName?: string;

  @ApiPropertyOptional({
    description: 'QR code image URL for bank account details',
    example: 'https://storage.example.com/qr-codes/driver-123-qr.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'QR Image URL harus berupa URL yang valid' })
  @MaxLength(500)
  qrImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Maximum radius for order acceptance (in km)',
    example: 15,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  maxRadius?: number;

  @ApiPropertyOptional({
    description: 'Preferred vehicle types',
    enum: VehicleType,
    isArray: true,
    example: [VehicleType.MOTORCYCLE, VehicleType.ECONOMY],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleType, { each: true })
  preferredVehicleTypes?: VehicleType[];
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({
    description: 'Driver license number',
    example: 'A123456789',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  licenseNumber?: string;

  @ApiPropertyOptional({
    description: 'License expiry date',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional({
    description: 'ID card number',
    example: '3171234567890123',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Transform(({ value }) => value?.trim())
  idCardNumber?: string;

  @ApiPropertyOptional({
    description: 'Driver address',
    example: 'Jl. Sudirman No. 123, Jakarta Pusat',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({
    description: 'Emergency contact number',
    example: '081234567890',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  @Transform(({ value }) => value?.trim())
  emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  bankAccount?: string;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Bank Central Asia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  bankName?: string;

  @ApiPropertyOptional({
    description: 'QR code image URL for bank account details',
    example: 'https://storage.example.com/qr-codes/driver-123-qr.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'QR Image URL harus berupa URL yang valid' })
  @MaxLength(500)
  qrImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Maximum radius for order acceptance (in km)',
    example: 15,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  maxRadius?: number;

  @ApiPropertyOptional({
    description: 'Preferred vehicle types',
    enum: VehicleType,
    isArray: true,
    example: [VehicleType.MOTORCYCLE, VehicleType.ECONOMY],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleType, { each: true })
  preferredVehicleTypes?: VehicleType[];
}

// DTO khusus untuk admin dalam mengelola QR Image verification
export class VerifyDriverQrImageDto {
  @ApiProperty({
    description: 'Whether to verify or reject the QR image',
    example: true,
  })
  @IsBoolean()
  isVerified: boolean;

  @ApiPropertyOptional({
    description: 'Admin notes for verification/rejection',
    example: 'QR code is clear and contains valid bank account information',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  notes?: string;
}

// DTO untuk update QR Image oleh driver
export class UpdateDriverQrImageDto {
  @ApiProperty({
    description: 'QR code image URL for bank account details',
    example: 'https://storage.example.com/qr-codes/driver-123-qr.png',
  })
  @IsUrl({}, { message: 'QR Image URL harus berupa URL yang valid' })
  @MaxLength(500)
  qrImageUrl: string;
}

// Response DTO untuk driver profile
export class DriverProfileResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ example: 'uuid-string' })
  userId: string;

  @ApiProperty({ example: 'A123456789' })
  licenseNumber: string;

  @ApiProperty({ example: '2025-12-31T00:00:00.000Z' })
  licenseExpiry: Date;

  @ApiPropertyOptional({ example: '3171234567890123' })
  idCardNumber?: string;

  @ApiProperty({ example: 'Jl. Sudirman No. 123, Jakarta Pusat' })
  address: string;

  @ApiProperty({ example: '081234567890' })
  emergencyContact: string;

  @ApiPropertyOptional({ example: '1234567890' })
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'Bank Central Asia' })
  bankName?: string;

  @ApiPropertyOptional({ 
    example: 'https://storage.example.com/qr-codes/driver-123-qr.png',
    description: 'QR code image URL for bank account details'
  })
  qrImageUrl?: string;

  @ApiPropertyOptional({ 
    example: '2024-01-15T10:30:00.000Z',
    description: 'When QR image was uploaded'
  })
  qrImageUploadedAt?: Date;

  @ApiPropertyOptional({ 
    example: true,
    description: 'Whether QR image has been verified by admin'
  })
  qrImageVerified: boolean;

  @ApiPropertyOptional({ 
    example: 'admin-uuid',
    description: 'Admin ID who verified the QR image'
  })
  qrImageVerifiedBy?: string;

  @ApiPropertyOptional({ 
    example: '2024-01-15T15:45:00.000Z',
    description: 'When QR image was verified'
  })
  qrImageVerifiedAt?: Date;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T15:45:00.000Z' })
  verifiedAt?: Date;

  @ApiPropertyOptional({ example: 'admin-uuid' })
  verifiedBy?: string;

  @ApiPropertyOptional({ example: 'Documents verified successfully' })
  verificationNotes?: string;

  @ApiProperty({ example: 4.8 })
  rating: number;

  @ApiProperty({ example: 150 })
  totalTrips: number;

  @ApiProperty({ example: 145 })
  completedTrips: number;

  @ApiProperty({ example: 5 })
  cancelledTrips: number;

  @ApiProperty({ example: '2500000' })
  totalEarnings: string; // BigInt as string

  @ApiPropertyOptional({ example: -6.2088 })
  currentLat?: number;

  @ApiPropertyOptional({ example: 106.8456 })
  currentLng?: number;

  @ApiPropertyOptional({ example: '2024-01-15T12:30:00.000Z' })
  lastLocationUpdate?: Date;

  @ApiProperty({ enum: DriverStatus, example: DriverStatus.ACTIVE })
  driverStatus: DriverStatus;

  @ApiPropertyOptional({ example: '2024-01-15T08:00:00.000Z' })
  statusChangedAt?: Date;

  @ApiProperty({ example: 15 })
  maxRadius: number;

  @ApiProperty({ 
    enum: VehicleType, 
    isArray: true, 
    example: [VehicleType.MOTORCYCLE, VehicleType.ECONOMY] 
  })
  preferredVehicleTypes: VehicleType[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  updatedAt: Date;
}