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

export class ChangePasswordDto {
    @ApiProperty({
      description: 'Current password',
      example: 'OldPassword123!',
    })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;
  
    @ApiProperty({
      description: 'New password',
      example: 'NewPassword123!',
      minLength: 6,
      maxLength: 128,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    @MaxLength(128)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: 'Password harus mengandung minimal 1 huruf kecil, 1 huruf besar, dan 1 angka',
    })
    newPassword: string;
  
    @ApiPropertyOptional({
      description: 'Device identifier',
      example: 'mobile-app-v1.0',
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    deviceId?: string;
  }