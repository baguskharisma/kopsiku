import { ApiProperty } from '@nestjs/swagger';
import {
  Order,
  OrderStatus,
  VehicleType,
  PaymentMethod,
  PaymentStatus,
  TripType,
} from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

export class OrderEntity implements Order {
  operationalFeePercent: number | null;
  operationalFeeConfig: JsonValue;
  baseFareCoins: bigint | null;
  distanceFareCoins: bigint | null;
  timeFareCoins: bigint | null;
  airportFareCoins: bigint | null;
  surgeFareCoins: bigint | null;
  additionalFareCoins: bigint | null;
  discountCoins: bigint | null;
  totalFareCoins: bigint | null;
  cancellationFeeCoins: bigint | null;

  @ApiProperty({ example: 'order-uuid-here' })
  id: string;

  @ApiProperty({ example: 'fleet-uuid-here' })
  fleetId: string;

  @ApiProperty({ example: 'driver-uuid-here' })
  driverId: string;

  @ApiProperty({ example: 'customer-uuid-here' })
  customerId: string | null;

  @ApiProperty({ example: 'TXB-240828-001' })
  orderNumber: string;

  @ApiProperty({ enum: TripType, example: TripType.INSTANT })
  tripType: TripType;

  @ApiProperty({ example: '2024-08-28T10:30:00Z' })
  scheduledAt: Date | null;

  @ApiProperty({ example: 'Budi Santoso' })
  passengerName: string;

  @ApiProperty({ example: '+628123456789' })
  passengerPhone: string;

  @ApiProperty({ example: 'Please wait at Gate 5' })
  specialRequests: string | null;

  @ApiProperty({ example: 'Bandara Internasional - Terminal 2' })
  pickupAddress: string;

  @ApiProperty({ example: -6.2088 })
  pickupLat: number;

  @ApiProperty({ example: 106.8456 })
  pickupLng: number;

  @ApiProperty({ example: 'Jl. Sudirman No. 123, Jakarta' })
  dropoffAddress: string;

  @ApiProperty({ example: -6.2297 })
  dropoffLat: number;

  @ApiProperty({ example: 106.8251 })
  dropoffLng: number;

  @ApiProperty({ enum: VehicleType, example: VehicleType.ECONOMY })
  requestedVehicleType: VehicleType;

  @ApiProperty({ example: 24800 })
  distanceMeters: number | null;

  @ApiProperty({ example: 45 })
  estimatedDurationMinutes: number | null;

  @ApiProperty({ example: 47 })
  actualDurationMinutes: number | null;

  @ApiProperty({ example: 5000 })
  baseFare: bigint;

  @ApiProperty({ example: 12000 })
  distanceFare: bigint;

  @ApiProperty({ example: 0 })
  timeFare: bigint;

  @ApiProperty({ example: 2000 })
  airportFare: bigint;

  @ApiProperty({ example: 0 })
  surgeFare: bigint;

  @ApiProperty({ example: 0 })
  additionalFare: bigint;

  @ApiProperty({ example: 0 })
  discount: bigint;

  @ApiProperty({ example: 19000 })
  totalFare: bigint;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ example: '2024-08-28T14:30:00Z' })
  driverAssignedAt: Date | null;

  @ApiProperty({ example: '2024-08-28T14:32:00Z' })
  driverAcceptedAt: Date | null;

  @ApiProperty({ example: '2024-08-28T14:45:00Z' })
  driverArrivedAt: Date | null;

  @ApiProperty({ example: '2024-08-28T14:50:00Z' })
  tripStartedAt: Date | null;

  @ApiProperty({ example: '2024-08-28T15:35:00Z' })
  tripCompletedAt: Date | null;

  @ApiProperty({ example: null })
  cancelledAt: Date | null;

  @ApiProperty({ example: null })
  cancelledReason: string | null;

  @ApiProperty({ example: 0 })
  cancellationFee: bigint;

  @ApiProperty({ example: 'idempotency-key-123' })
  idempotencyKey: string | null;

  @ApiProperty({ example: '2024-08-28T14:28:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-08-28T15:35:00Z' })
  updatedAt: Date;

  @ApiProperty({ required: false, type: String, example: null })
  operationalFeeCoins: bigint | null;

  @ApiProperty({ required: false, example: null })
  operationalFeeStatus: string | null;

  @ApiProperty({ required: false, example: null })
  operationalFeeChargedAt: Date | null;

  @ApiProperty({ required: false, example: null })
  operationalFeeTransactionId: string | null;
}
