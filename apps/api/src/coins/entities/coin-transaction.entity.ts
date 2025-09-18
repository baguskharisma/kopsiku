import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CoinTransactionEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  @Transform(({ value }) => value.toString())
  amount: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  @Transform(({ value }) => value.toString())
  balanceBefore: string;

  @ApiProperty()
  @Transform(({ value }) => value.toString())
  balanceAfter: string;

  @ApiProperty({ required: false })
  referenceType?: string;

  @ApiProperty({ required: false })
  referenceId?: string;

  @ApiProperty({ required: false })
  orderId?: string;

  @ApiProperty({ required: false })
  processedBy?: string;

  @ApiProperty({ required: false })
  processedAt?: Date;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<CoinTransactionEntity>) {
    Object.assign(this, partial);
  }
}
