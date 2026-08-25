/**
 * Domain errors are thrown by the service layer and translated to HTTP by the
 * global filter. The service layer never imports HttpException — it speaks the
 * language of the domain, and transport concerns stay in `common/filters`.
 */
export enum ErrorCode {
  VEHICLE_NOT_FOUND = 'VEHICLE_NOT_FOUND',
  VEHICLE_NAME_TAKEN = 'VEHICLE_NAME_TAKEN',
  VEHICLE_OFFLINE = 'VEHICLE_OFFLINE',
  VEHICLE_ALREADY_ASSIGNED = 'VEHICLE_ALREADY_ASSIGNED',
  VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE = 'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE',
  VEHICLE_ASSIGNED_CANNOT_DELETE = 'VEHICLE_ASSIGNED_CANNOT_DELETE',
  OPERATOR_NOT_FOUND = 'OPERATOR_NOT_FOUND',
  OPERATOR_ALREADY_HOLDS_VEHICLE = 'OPERATOR_ALREADY_HOLDS_VEHICLE',
  NOT_HOLDER = 'NOT_HOLDER',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class VehicleNotFoundError extends DomainError {
  readonly code = ErrorCode.VEHICLE_NOT_FOUND;
  readonly status = 404;
  constructor(id: string) {
    super(`Vehicle ${id} does not exist.`);
  }
}

export class OperatorNotFoundError extends DomainError {
  readonly code = ErrorCode.OPERATOR_NOT_FOUND;
  readonly status = 404;
  constructor(id: string) {
    super(`Remote operator ${id} does not exist.`);
  }
}

export class VehicleNameTakenError extends DomainError {
  readonly code = ErrorCode.VEHICLE_NAME_TAKEN;
  readonly status = 409;
  constructor(name: string) {
    super(`A vehicle named "${name}" already exists.`);
  }
}

export class VehicleOfflineError extends DomainError {
  readonly code = ErrorCode.VEHICLE_OFFLINE;
  readonly status = 409;
  constructor() {
    super('This vehicle is offline and cannot be taken over. It must be online first.');
  }
}

export class VehicleAlreadyAssignedError extends DomainError {
  readonly code = ErrorCode.VEHICLE_ALREADY_ASSIGNED;
  readonly status = 409;
  constructor() {
    super('This vehicle is already being operated by another remote operator.');
  }
}

export class VehicleAssignedCannotGoOfflineError extends DomainError {
  readonly code = ErrorCode.VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE;
  readonly status = 409;
  constructor() {
    super('This vehicle is assigned to a remote operator. It must be released before going offline.');
  }
}

export class VehicleAssignedCannotDeleteError extends DomainError {
  readonly code = ErrorCode.VEHICLE_ASSIGNED_CANNOT_DELETE;
  readonly status = 409;
  constructor() {
    super('This vehicle is assigned to a remote operator and cannot be deleted.');
  }
}

export class OperatorAlreadyHoldsVehicleError extends DomainError {
  readonly code = ErrorCode.OPERATOR_ALREADY_HOLDS_VEHICLE;
  readonly status = 409;
  constructor() {
    super('You already hold a vehicle. Release it before taking another one.');
  }
}

export class NotHolderError extends DomainError {
  readonly code = ErrorCode.NOT_HOLDER;
  readonly status = 409;
  constructor() {
    super('You are not the remote operator holding this vehicle.');
  }
}
