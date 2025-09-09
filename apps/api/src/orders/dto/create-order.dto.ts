import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsObject,
  IsNumber,
  IsEnum,
  IsOptional,
  IsPositive,
  Min,
  Max,
  Length,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType, PaymentMethod, TripType } from '@prisma/client';

class CoordinatesDto {
  @ApiProperty({ description: 'Latitude coordinate', example: -0.5069 })
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat: number;

  @ApiProperty({ description: 'Longitude coordinate', example: 101.4381 })
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lng: number;
}

export class CreateOrderDto {
  @ApiProperty({ 
    description: 'Passenger name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100
  })
  @IsNotEmpty({ message: 'Passenger name is required' })
  @IsString({ message: 'Passenger name must be a string' })
  @Length(2, 100, { message: 'Passenger name must be between 2 and 100 characters' })
  passengerName: string;

  @ApiProperty({ 
    description: 'Passenger phone number',
    example: '08123456789'
  })
  @IsNotEmpty({ message: 'Passenger phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Length(10, 15, { message: 'Phone number must be between 10 and 15 digits' })
  passengerPhone: string;

  @ApiProperty({ 
    description: 'Pickup address',
    example: 'Jl. Sudirman No. 1, Pekanbaru'
  })
  @IsNotEmpty({ message: 'Pickup address is required' })
  @IsString({ message: 'Pickup address must be a string' })
  @Length(3, 500, { message: 'Pickup address must be between 3 and 500 characters' })
  pickupAddress: string;

  @ApiProperty({ 
    description: 'Pickup coordinates',
    type: CoordinatesDto
  })
  @IsNotEmpty({ message: 'Pickup coordinates are required' })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  pickupCoordinates: CoordinatesDto;

  @ApiProperty({ 
    description: 'Dropoff address',
    example: 'Bandara SSK II, Pekanbaru'
  })
  @IsNotEmpty({ message: 'Dropoff address is required' })
  @IsString({ message: 'Dropoff address must be a string' })
  @Length(3, 500, { message: 'Dropoff address must be between 3 and 500 characters' })
  dropoffAddress: string;

  @ApiProperty({ 
    description: 'Dropoff coordinates',
    type: CoordinatesDto
  })
  @IsNotEmpty({ message: 'Dropoff coordinates are required' })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  dropoffCoordinates: CoordinatesDto;

  @ApiProperty({ 
    description: 'Requested vehicle type',
    enum: VehicleType,
    example: VehicleType.ECONOMY
  })
  @IsNotEmpty({ message: 'Vehicle type is required' })
  @IsEnum(VehicleType, { message: 'Invalid vehicle type' })
  requestedVehicleType: VehicleType;

  @ApiProperty({ 
    description: 'Distance in meters',
    example: 15000,
    minimum: 100
  })
  @IsNotEmpty({ message: 'Distance is required' })
  @IsInt({ message: 'Distance must be an integer' })
  @Min(100, { message: 'Distance must be at least 100 meters' })
  distanceMeters: number;

  @ApiProperty({ 
    description: 'Estimated duration in minutes',
    example: 25,
    minimum: 1
  })
  @IsNotEmpty({ message: 'Estimated duration is required' })
  @IsInt({ message: 'Duration must be an integer' })
  @Min(1, { message: 'Duration must be at least 1 minute' })
  estimatedDurationMinutes: number;

  @ApiProperty({ 
    description: 'Base fare in cents (smallest currency unit)',
    example: 1500000
  })
  @IsNotEmpty({ message: 'Base fare is required' })
  @IsInt({ message: 'Base fare must be an integer' })
  @Min(0, { message: 'Base fare cannot be negative' })
  baseFare: number;

  @ApiProperty({ 
    description: 'Distance fare in cents',
    example: 500000
  })
  @IsNotEmpty({ message: 'Distance fare is required' })
  @IsInt({ message: 'Distance fare must be an integer' })
  @Min(0, { message: 'Distance fare cannot be negative' })
  distanceFare: number;

  @ApiPropertyOptional({ 
    description: 'Airport surcharge in cents',
    example: 1000000
  })
  @IsOptional()
  @IsInt({ message: 'Airport fare must be an integer' })
  @Min(0, { message: 'Airport fare cannot be negative' })
  airportFare?: number;

  @ApiProperty({ 
    description: 'Total fare in cents',
    example: 3000000
  })
  @IsNotEmpty({ message: 'Total fare is required' })
  @IsInt({ message: 'Total fare must be an integer' })
  @Min(0, { message: 'Total fare cannot be negative' })
  totalFare: number;

  @ApiProperty({ 
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH
  })
  @IsNotEmpty({ message: 'Payment method is required' })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ 
    description: 'Trip type',
    enum: TripType,
    example: TripType.INSTANT,
    default: TripType.INSTANT
  })
  @IsOptional()
  @IsEnum(TripType, { message: 'Invalid trip type' })
  tripType?: TripType;

  @ApiProperty({
    description: 'Customer ID for operational fee deduction',
    required: false
  })
  @IsOptional()
  @IsString()
  adminId: string;


  @ApiPropertyOptional({ 
    description: 'Special requests or notes',
    example: 'Please wait at main entrance'
  })
  @IsOptional()
  @IsString({ message: 'Special requests must be a string' })
  @Length(0, 1000, { message: 'Special requests cannot exceed 1000 characters' })
  specialRequests?: string;

  @ApiPropertyOptional({ 
    description: 'Scheduled pickup time for future trips',
    example: '2024-03-15T10:30:00Z'
  })
  @IsOptional()
  scheduledAt?: string;
}