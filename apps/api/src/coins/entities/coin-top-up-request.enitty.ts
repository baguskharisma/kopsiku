import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CoinTopUpRequestEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestNumber: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty({ required: false })
  processedById?: string;

  @ApiProperty()
  @Transform(({ value }) => value.toString())
  requestedAmount: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value?.toString())
  approvedAmount?: string;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  urgencyLevel: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  adminNotes?: string;

  @ApiProperty({ required: false })
  rejectionReason?: string;

  @ApiProperty()
  requestedAt: Date;

  @ApiProperty({ required: false })
  processedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  constructor(partial: Partial<CoinTopUpRequestEntity>) {
    Object.assign(this, partial);
  }
}
