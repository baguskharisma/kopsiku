import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.DRIVER_ACCEPTED })
  @IsEnum(OrderStatus, { message: 'Please provide a valid order status' })
  status: OrderStatus;

  @ApiProperty({ example: 'Driver accepted the trip', description: 'Status change reason', required: false })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;

  @ApiProperty({ example: 'Additional metadata', description: 'Additional context data', required: false })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, any>;
}