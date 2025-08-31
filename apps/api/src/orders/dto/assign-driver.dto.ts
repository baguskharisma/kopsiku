import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNotEmpty, IsString } from "class-validator";

export class AssignDriverDto {
  @ApiProperty({ example: 'driver-uuid-here', description: 'Driver user ID' })
  @IsString({ message: 'Driver ID must be a string' })
  @IsNotEmpty({ message: 'Driver ID is required' })
  driverId: string;

  @ApiProperty({ example: 'fleet-uuid-here', description: 'Fleet ID to assign' })
  @IsString({ message: 'Fleet ID must be a string' })
  @IsNotEmpty({ message: 'Fleet ID is required' })
  fleetId: string;

  @ApiProperty({ example: 'Closest available driver', description: 'Assignment reason', required: false })
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;
}
