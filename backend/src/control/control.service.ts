import { Injectable } from '@nestjs/common';
import { VehicleRepository } from '../vehicles/repositories/vehicle.repository';
import { OperatorsService } from '../operators/operators.service';
import { AssignmentEventsService } from '../history/assignment-events.service';
import { VehicleRules } from '../vehicles/vehicle.domain';
import { toVehicleResponse, toVehicleState, VehicleResponse } from '../vehicles/vehicle.presenter';
import {
  OperatorAlreadyHoldsVehicleError,
  VehicleAlreadyAssignedError,
  VehicleNotFoundError,
} from '../common/errors/domain-error';
import { toDomainError } from './rejection.mapper';

/**
 * Takeover and release — the use-cases the whole challenge turns on.
 *
 * Shape of every method here:
 *   1. attempt the ATOMIC write first (the database decides),
 *   2. only if it reports "precondition failed", re-read to explain WHY.
 *
 * Step 2 never grants anything; it exists solely to produce a precise error
 * message. Doing it in this order is what keeps the happy path race-free —
 * checking first and writing second would be exactly the bug.
 */
@Injectable()
export class ControlService {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly operators: OperatorsService,
    private readonly events: AssignmentEventsService,
  ) {}

  async takeover(vehicleId: string, operatorId: string): Promise<VehicleResponse> {
    await this.operators.assertExists(operatorId);

    // Fast, friendly rejection for the common "you already hold one" case.
    // Not a correctness guard — the unique partial index is (see repository).
    const held = await this.vehicles.findByOperator(operatorId);
    if (held && held._id.toString() !== vehicleId) {
      throw new OperatorAlreadyHoldsVehicleError();
    }

    const claimed = await this.vehicles.claim(vehicleId, operatorId);

    if (claimed) {
      await this.events.record({
        vehicleId,
        vehicleName: claimed.name,
        operatorId,
        type: 'taken_over',
      });
      return this.present(claimed);
    }

    // The claim did not match. Find out why — and stay correct if the vehicle
    // is one this operator already holds (idempotent re-takeover).
    const current = await this.vehicles.findById(vehicleId);
    if (!current) throw new VehicleNotFoundError(vehicleId);

    const state = toVehicleState(current);
    if (state.assignedOperatorId === operatorId) return this.present(current);

    const rejection = VehicleRules.canBeTakenBy(state, operatorId);
    throw rejection ? toDomainError(rejection) : new VehicleAlreadyAssignedError();
  }

  async release(vehicleId: string, operatorId: string): Promise<VehicleResponse> {
    await this.operators.assertExists(operatorId);

    const released = await this.vehicles.release(vehicleId, operatorId);

    if (released) {
      await this.events.record({
        vehicleId,
        vehicleName: released.name,
        operatorId,
        type: 'released',
      });
      return this.present(released);
    }

    const current = await this.vehicles.findById(vehicleId);
    if (!current) throw new VehicleNotFoundError(vehicleId);

    const rejection = VehicleRules.canBeReleasedBy(toVehicleState(current), operatorId);
    throw toDomainError(rejection ?? 'NOT_HOLDER');
  }

  private async present(doc: Parameters<typeof toVehicleResponse>[0]): Promise<VehicleResponse> {
    const id = doc.assignedOperatorId?.toString();
    const names = id ? await this.operators.namesByIds([id]) : undefined;
    return toVehicleResponse(doc, names);
  }
}
