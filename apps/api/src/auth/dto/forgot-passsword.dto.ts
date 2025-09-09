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

export class ForgotPasswordDto {
    @ApiProperty({
      description: 'Phone number for password reset',
      example: '081234567890',
    })
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => {
      if (!value) return value;
      // Normalize phone number
      let phone = value.replace(/\s+/g, '').replace(/[^\d+]/g, '');
      if (phone.startsWith('+62')) {
        phone = '0' + phone.slice(3);
      } else if (phone.startsWith('62')) {
        phone = '0' + phone.slice(2);
      }
      return phone;
    })
    phone: string;
  }
  