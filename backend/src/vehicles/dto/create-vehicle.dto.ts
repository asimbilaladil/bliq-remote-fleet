import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { VEHICLE_STATUSES, VehicleStatus } from '../schemas/vehicle.schema';

export class CreateVehicleDto {
  @IsString()
  @Length(2, 64, { message: 'name must be between 2 and 64 characters' })
  @Matches(/^[\w\- ]+$/, { message: 'name may contain letters, numbers, spaces, hyphens and underscores' })
  name!: string;

  @IsOptional()
  @IsIn(VEHICLE_STATUSES, { message: `status must be one of: ${VEHICLE_STATUSES.join(', ')}` })
  status?: VehicleStatus;
}
