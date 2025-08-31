import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class TaxiReceiptDto {
  @Type(() => Number)
  @IsNumber()
  distance: number;

  @Type(() => Number)
  @IsNumber()
  duration: number;

  @Type(() => Number)
  @IsNumber()
  baseFare: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  additionalFare?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  airportFare?: number;

  @Type(() => Number)
  @IsNumber()
  totalFare: number;
}
