import { Rejection } from '../vehicles/vehicle.domain';
import {
  DomainError,
  NotHolderError,
  VehicleAlreadyAssignedError,
  VehicleAssignedCannotGoOfflineError,
  VehicleOfflineError,
} from '../common/errors/domain-error';

/** Single translation table from a domain rejection to a typed error. */
export function toDomainError(rejection: Rejection): DomainError {
  switch (rejection) {
    case 'VEHICLE_OFFLINE':
      return new VehicleOfflineError();
    case 'VEHICLE_ALREADY_ASSIGNED':
      return new VehicleAlreadyAssignedError();
    case 'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE':
      return new VehicleAssignedCannotGoOfflineError();
    case 'NOT_HOLDER':
      return new NotHolderError();
  }
}
