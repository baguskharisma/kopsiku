import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';

export class ManualCoinAdjustmentDto {
  @ApiProperty({
    description: 'User ID to adjust coins for',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Amount to adjust (positive for credit, negative for debit)',
    example: 50000,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Type of adjustment',
    enum: ['BONUS', 'ADJUSTMENT', 'REFUND'],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['BONUS', 'ADJUSTMENT', 'REFUND'])
  type: 'BONUS' | 'ADJUSTMENT' | 'REFUND';

  @ApiProperty({
    description: 'Description of the adjustment',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Admin notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
