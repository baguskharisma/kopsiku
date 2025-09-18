import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Phone number (Indonesian format)',
    example: '081234567890',
    minLength: 10,
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(15)
  @Matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, {
    message: 'Format nomor telepon tidak valid',
  })
  @Transform(({ value }) => {
    if (!value) return value;
    // Normalize phone number to Indonesian format
    let phone = value.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (phone.startsWith('+62')) {
      phone = '0' + phone.slice(3);
    } else if (phone.startsWith('62')) {
      phone = '0' + phone.slice(2);
    }
    return phone;
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email?: string;

  @ApiProperty({
    description: 'Password',
    example: 'SecurePassword123!',
    minLength: 6,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password harus mengandung minimal 1 huruf kecil, 1 huruf besar, dan 1 angka',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: Role,
    default: Role.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Device identifier for token management',
    example: 'mobile-app-v1.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
