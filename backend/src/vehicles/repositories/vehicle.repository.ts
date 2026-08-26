import { VehicleDocument, VehicleStatus } from '../schemas/vehicle.schema';

export interface CreateVehicleData {
  name: string;
  status?: VehicleStatus;
}

/**
 * Intent-named persistence port. Every mutating method is a single atomic
 * operation whose precondition lives in the query filter — callers never
 * read-then-write. A `null` return means "the precondition did not hold",
 * which the service turns into a precise domain error.
 */
export abstract class VehicleRepository {
  abstract create(data: CreateVehicleData): Promise<VehicleDocument>;
  abstract findAll(filter?: { status?: VehicleStatus }): Promise<VehicleDocument[]>;
  abstract findById(id: string): Promise<VehicleDocument | null>;
  abstract findByOperator(operatorId: string): Promise<VehicleDocument | null>;
  abstract rename(id: string, name: string): Promise<VehicleDocument | null>;

  /** Deletes only when unassigned. */
  abstract deleteIfUnassigned(id: string): Promise<VehicleDocument | null>;

  /** Sets status; when going offline, only if unassigned. */
  abstract setStatus(id: string, status: VehicleStatus): Promise<VehicleDocument | null>;

  /** Claims the vehicle only if it is online AND unassigned. */
  abstract claim(id: string, operatorId: string): Promise<VehicleDocument | null>;

  /** Releases only if this operator is the current holder. */
  abstract release(id: string, operatorId: string): Promise<VehicleDocument | null>;
}
