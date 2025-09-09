import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class ManualCoinTransactionDto {
    @ApiProperty({ 
      example: 'user-id-123',
      description: 'User ID to perform transaction for' 
    })
    @IsNotEmpty()
    @IsString()
    userId: string;
  
    @ApiProperty({ 
      enum: ['TOP_UP', 'DEDUCTION', 'BONUS', 'ADJUSTMENT'],
      description: 'Type of coin transaction' 
    })
    @IsNotEmpty()
    @IsEnum(['TOP_UP', 'DEDUCTION', 'BONUS', 'ADJUSTMENT'])
    type: 'TOP_UP' | 'DEDUCTION' | 'BONUS' | 'ADJUSTMENT';
  
    @ApiProperty({ 
      example: 50000,
      description: 'Amount in coins (positive for credit, negative for debit)' 
    })
    @IsNotEmpty()
    @Transform(({ value }) => parseInt(value))
    amount: number;
  
    @ApiProperty({ 
      example: 'Bonus untuk customer setia',
      description: 'Description of the transaction' 
    })
    @IsNotEmpty()
    @IsString()
    @Transform(({ value }) => value?.trim())
    description: string;
  
    @ApiPropertyOptional({ 
      example: 'Manual adjustment by admin',
      description: 'Additional notes for the transaction' 
    })
    @IsOptional()
    @IsString()
    notes?: string;
  
    @ApiPropertyOptional({ 
      description: 'Additional metadata for the transaction' 
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
  }