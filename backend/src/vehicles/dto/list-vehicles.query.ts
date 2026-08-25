import { IsIn, IsOptional } from 'class-validator';
import { VEHICLE_STATUSES, VehicleStatus } from '../schemas/vehicle.schema';

export class ListVehiclesQuery {
  @IsOptional()
  @IsIn(VEHICLE_STATUSES, { message: `status must be one of: ${VEHICLE_STATUSES.join(', ')}` })
  status?: VehicleStatus;
}
