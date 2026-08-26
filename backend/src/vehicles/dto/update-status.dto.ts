import { IsIn } from 'class-validator';
import { VEHICLE_STATUSES, VehicleStatus } from '../schemas/vehicle.schema';

export class UpdateStatusDto {
  @IsIn(VEHICLE_STATUSES, { message: `status must be one of: ${VEHICLE_STATUSES.join(', ')}` })
  status!: VehicleStatus;
}
