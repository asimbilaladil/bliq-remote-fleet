import { VehicleDocument, VehicleStatus } from './schemas/vehicle.schema';
import { VehicleState } from './vehicle.domain';

export interface VehicleResponse {
  id: string;
  name: string;
  status: VehicleStatus;
  assignedOperatorId: string | null;
  assignedOperatorName?: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The persistence shape never leaks past this boundary. */
export function toVehicleResponse(
  doc: VehicleDocument,
  operatorNames?: Map<string, string>,
): VehicleResponse {
  const assignedOperatorId = doc.assignedOperatorId ? doc.assignedOperatorId.toString() : null;

  return {
    id: doc._id.toString(),
    name: doc.name,
    status: doc.status,
    assignedOperatorId,
    assignedOperatorName: assignedOperatorId ? (operatorNames?.get(assignedOperatorId) ?? null) : null,
    assignedAt: doc.assignedAt ? doc.assignedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toVehicleState(doc: VehicleDocument): VehicleState {
  return {
    id: doc._id.toString(),
    name: doc.name,
    status: doc.status,
    assignedOperatorId: doc.assignedOperatorId ? doc.assignedOperatorId.toString() : null,
  };
}
