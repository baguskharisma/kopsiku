import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsPositive,
  IsOptional,
  IsIn,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ProcessCoinTopUpRequestDto {
  @ApiProperty({
    description: 'Final approved amount',
    example: 100000,
  })
  @IsNotEmpty()
  @IsPositive()
  @Min(1, { message: 'Approved amount must be positive' })
  @Transform(({ value }) => parseInt(value))
  approvedAmount: number;

  @ApiProperty({
    description: 'Processing status',
    enum: ['COMPLETED', 'FAILED', 'CANCELLED'],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['COMPLETED', 'FAILED', 'CANCELLED'])
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';

  @ApiProperty({
    description: 'Admin notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({
    description: 'Rejection reason if status is FAILED or CANCELLED',
    required: false,
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
