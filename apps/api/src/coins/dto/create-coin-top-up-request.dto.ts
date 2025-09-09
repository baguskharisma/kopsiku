import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsPositive, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCoinTopUpRequestDto {
  @ApiProperty({
    description: 'Amount of coins to top up',
    example: 100000,
    minimum: 10000,
    maximum: 10000000
  })
  @IsNotEmpty()
  @IsPositive()
  @Min(10000, { message: 'Minimum top up amount is 10,000 coins' })
  @Max(10000000, { message: 'Maximum top up amount is 10,000,000 coins' })
  @Transform(({ value }) => parseInt(value))
  requestedAmount: number;

  @ApiProperty({
    description: 'Reason for top up request',
    example: 'Need coins for operational fees'
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Urgency level',
    example: 'NORMAL',
    enum: ['NORMAL', 'HIGH', 'URGENT'],
    required: false
  })
  @IsOptional()
  @IsString()
  urgencyLevel?: string = 'NORMAL';

  @ApiProperty({
    description: 'Customer notes',
    required: false
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;

  @ApiProperty({
    description: 'Contact preference',
    example: 'PHONE',
    enum: ['PHONE', 'EMAIL', 'WHATSAPP'],
    required: false
  })
  @IsOptional()
  @IsString()
  contactPreference?: string;

  @ApiProperty({
    description: 'Payment method used',
    example: 'BANK_TRANSFER',
    required: false
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({
    description: 'Payment details as JSON',
    required: false
  })
  @IsOptional()
  paymentDetails?: any;
}