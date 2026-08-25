import { VehicleStatus } from './schemas/vehicle.schema';

export interface VehicleState {
  id: string;
  name: string;
  status: VehicleStatus;
  assignedOperatorId: string | null;
}

export type Rejection =
  | 'VEHICLE_OFFLINE'
  | 'VEHICLE_ALREADY_ASSIGNED'
  | 'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE'
  | 'NOT_HOLDER';

/**
 * The business rules, expressed once as pure functions over a vehicle's state.
 *
 * IMPORTANT — read together with `MongoVehicleRepository`:
 * these predicates are NOT the enforcement mechanism. Enforcing a rule by
 * reading state and then writing loses every race. The repository re-states
 * each rule as the FILTER of a single atomic `findOneAndUpdate`, and the
 * database is the arbiter.
 *
 * These functions exist to (a) name the rules in one readable place, (b) let
 * the API answer "why was that rejected?" precisely instead of guessing, and
 * (c) let the UI disable an action with a reason before it is attempted.
 * The duplication is deliberate; see README §Concurrency.
 */
export const VehicleRules = {
  canBeTakenBy(vehicle: VehicleState, operatorId: string): Rejection | null {
    if (vehicle.status !== 'online') return 'VEHICLE_OFFLINE';
    if (vehicle.assignedOperatorId === null) return null;
    // Re-taking a vehicle you already hold is a no-op success, not a conflict.
    if (vehicle.assignedOperatorId === operatorId) return null;
    return 'VEHICLE_ALREADY_ASSIGNED';
  },

  canBeReleasedBy(vehicle: VehicleState, operatorId: string): Rejection | null {
    return vehicle.assignedOperatorId === operatorId ? null : 'NOT_HOLDER';
  },

  canChangeStatusTo(vehicle: VehicleState, next: VehicleStatus): Rejection | null {
    if (next === 'offline' && vehicle.assignedOperatorId !== null) {
      return 'VEHICLE_ASSIGNED_CANNOT_GO_OFFLINE';
    }
    return null;
  },

  isHeld(vehicle: VehicleState): boolean {
    return vehicle.assignedOperatorId !== null;
  },
} as const;
