import {
    IsString,
    IsNotEmpty,
    IsNumber,
    IsEnum,
    IsOptional,
    IsPhoneNumber,
    Min,
    Max,
    IsObject,
    ValidateNested,
    IsArray,
    ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType, PaymentMethod, TripType } from '@prisma/client';

class CoordinateDto {
    @ApiProperty({ example: -6.2088, description: 'Latitude coordinate' })
    @IsNumber({}, { message: 'Latitude must be a valid number' })
    @Min(-90, { message: 'Latitude must be between -90 and 90' })
    @Max(90, { message: 'Latitude must be between -90 and 90' })
    lat: number;

    @ApiProperty({ example: 106.8456, description: 'Longitude coordinate' })
    @IsNumber({}, { message: 'Longitude must be a valid number' })
    @Min(-180, { message: 'Longitude must be between -180 and 180' })
    @Max(180, { message: 'Longitude must be between -180 and 180' })
    lng: number;
} 

class RouteDataDto {
    @ApiProperty({ description: 'Route coordinates array' })
    @IsArray()
    @ArrayMinSize(2, { message: 'Route must have at least 2 coordinates' })
    @ValidateNested({ each: true })
    @Type(() => CoordinateDto)
    coordinates: CoordinateDto[];

    @ApiProperty({ example: 25.5, description: 'Route distance in kilometers' })
    @IsNumber({}, { message: 'Distance must be a valid number' })
    @Min(0.1, { message: 'Distance must be at least 0.1 km' })
    distance: number;

    @ApiProperty({ example: 45, description: 'Estimated duration in minutes' })
    @IsNumber({}, { message: 'Duration must be a valid number' })
    @Min(1, { message: 'Duration must be at least 1 minute' })
    duration: number;
}

export class CreateOrderDto {
    @ApiProperty({ example: 'Budi Santoso', description: 'Passenger full name' })
    @IsString({ message: 'Passenger name must be a string' })
    @IsNotEmpty({ message: 'Passenger name is required' })
    passengerName: string;

    @ApiProperty({ example: '+628123456789', description: 'Passenger phone number' })
    @IsPhoneNumber('ID', { message: 'Please provide a valid Indonesian phone number' })
    passengerPhone: string;

    @ApiProperty({ example: 'Bandara Internasional - Terminal 2', description: 'Pickup address' })
    @IsString({ message: 'Pickup address must be a string' })
    @IsNotEmpty({ message: 'Pickup address is required' })
    pickupAddress: string;
  
    @ApiProperty({ type: CoordinateDto, description: 'Pickup coordinates' })
    @ValidateNested()
    @Type(() => CoordinateDto)
    pickupCoordinates: CoordinateDto;
  
    @ApiProperty({ example: 'Jl. Sudirman No. 123, Jakarta', description: 'Dropoff address' })
    @IsString({ message: 'Dropoff address must be a string' })
    @IsNotEmpty({ message: 'Dropoff address is required' })
    dropoffAddress: string;
  
    @ApiProperty({ type: CoordinateDto, description: 'Dropoff coordinates' })
    @ValidateNested()
    @Type(() => CoordinateDto)
    dropoffCoordinates: CoordinateDto;
  
    @ApiProperty({ enum: VehicleType, example: VehicleType.ECONOMY })
    @IsEnum(VehicleType, { message: 'Please select a valid vehicle type' })
    requestedVehicleType: VehicleType;
  
    @ApiProperty({ example: 24800, description: 'Distance in meters' })
    @IsNumber({}, { message: 'Distance must be a valid number' })
    @Min(100, { message: 'Distance must be at least 100 meters' })
    distanceMeters: number;
  
    @ApiProperty({ example: 45, description: 'Estimated duration in minutes' })
    @IsNumber({}, { message: 'Duration must be a valid number' })
    @Min(1, { message: 'Duration must be at least 1 minute' })
    estimatedDurationMinutes: number;
  
    @ApiProperty({ example: 5000, description: 'Base fare in cents' })
    @IsNumber({}, { message: 'Base fare must be a valid number' })
    @Min(1000, { message: 'Base fare must be at least 1000 cents (Rp 10)' })
    baseFare: number;
  
    @ApiProperty({ example: 12000, description: 'Distance fare in cents' })
    @IsNumber({}, { message: 'Distance fare must be a valid number' })
    @Min(0, { message: 'Distance fare cannot be negative' })
    distanceFare: number;
  
    @ApiProperty({ example: 2000, description: 'Airport surcharge in cents', required: false })
    @IsOptional()
    @IsNumber({}, { message: 'Airport fare must be a valid number' })
    @Min(0, { message: 'Airport fare cannot be negative' })
    airportFare?: number;
  
    @ApiProperty({ example: 19000, description: 'Total fare in cents' })
    @IsNumber({}, { message: 'Total fare must be a valid number' })
    @Min(1000, { message: 'Total fare must be at least 1000 cents (Rp 10)' })
    totalFare: number;
  
    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
    @IsEnum(PaymentMethod, { message: 'Please select a valid payment method' })
    paymentMethod: PaymentMethod;
  
    @ApiProperty({ type: RouteDataDto, description: 'Route data with coordinates', required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => RouteDataDto)
    routeData?: RouteDataDto;
  
    @ApiProperty({ example: 'Please wait at Gate 5', description: 'Special requests', required: false })
    @IsOptional()
    @IsString({ message: 'Special requests must be a string' })
    specialRequests?: string;
  
    @ApiProperty({ enum: TripType, example: TripType.INSTANT, required: false })
    @IsOptional()
    @IsEnum(TripType, { message: 'Please select a valid trip type' })
    tripType?: TripType;
  
    @ApiProperty({ example: '2024-08-28T10:30:00Z', description: 'Scheduled time for future trips', required: false })
    @IsOptional()
    @IsString({ message: 'Scheduled time must be a valid ISO string' })
    scheduledAt?: string;
  }
