import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';

export class CoinWalletEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'Current coin balance' })
  @Transform(({ value }) => value.toString())
  balance: string;

  @ApiProperty({ description: 'Total coins ever topped up' })
  @Transform(({ value }) => value.toString())
  totalTopUp: string;

  @ApiProperty({ description: 'Total coins ever spent' })
  @Transform(({ value }) => value.toString())
  totalSpent: string;

  @ApiProperty({ description: 'Total operational fees paid' })
  @Transform(({ value }) => value.toString())
  totalOperationalFees: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isFrozen: boolean;

  @ApiProperty({ required: false })
  frozenReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @Exclude()
  version: number;

  constructor(partial: Partial<CoinWalletEntity>) {
    Object.assign(this, partial);
  }
}