export type VehicleStatus = 'online' | 'offline';

export interface Vehicle {
  id: string;
  name: string;
  status: VehicleStatus;
  assignedOperatorId: string | null;
  assignedOperatorName: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Operator {
  id: string;
  name: string;
  email: string;
}

export type ErrorCode =
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_NAME_TAKEN'
  | 'VEHICLE_OFFLINE'
  | 'VEHICLE_ALREADY_ASSIGNED'
  | 'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE'
  | 'VEHICLE_ASSIGNED_CANNOT_DELETE'
  | 'OPERATOR_NOT_FOUND'
  | 'OPERATOR_ALREADY_HOLDS_VEHICLE'
  | 'NOT_HOLDER'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  statusCode: number;
  error: ErrorCode;
  message: string;
  details?: unknown;
}
