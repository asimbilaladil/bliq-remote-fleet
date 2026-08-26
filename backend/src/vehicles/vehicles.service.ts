import { Injectable } from '@nestjs/common';
import { VehicleRepository } from './repositories/vehicle.repository';
import { OperatorsService } from '../operators/operators.service';
import { AssignmentEventsService } from '../history/assignment-events.service';
import { VehicleStatus } from './schemas/vehicle.schema';
import { VehicleRules } from './vehicle.domain';
import { toVehicleResponse, toVehicleState, VehicleResponse } from './vehicle.presenter';
import {
  VehicleAssignedCannotDeleteError,
  VehicleAssignedCannotGoOfflineError,
  VehicleNotFoundError,
} from '../common/errors/domain-error';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly operators: OperatorsService,
    private readonly events: AssignmentEventsService,
  ) {}

  async findAll(filter: { status?: VehicleStatus } = {}): Promise<VehicleResponse[]> {
    const docs = await this.vehicles.findAll(filter);
    const operatorIds = docs
      .map((d) => d.assignedOperatorId?.toString())
      .filter((id): id is string => Boolean(id));
    const names = await this.operators.namesByIds([...new Set(operatorIds)]);
    return docs.map((d) => toVehicleResponse(d, names));
  }

  async findOne(id: string): Promise<VehicleResponse> {
    const doc = await this.vehicles.findById(id);
    if (!doc) throw new VehicleNotFoundError(id);
    return this.present(id, doc);
  }

  async create(data: { name: string; status?: VehicleStatus }): Promise<VehicleResponse> {
    const doc = await this.vehicles.create(data);
    return toVehicleResponse(doc);
  }

  async rename(id: string, name: string): Promise<VehicleResponse> {
    const doc = await this.vehicles.rename(id, name);
    if (!doc) throw new VehicleNotFoundError(id);
    return this.present(id, doc);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.vehicles.deleteIfUnassigned(id);
    if (deleted) return;

    const current = await this.vehicles.findById(id);
    if (!current) throw new VehicleNotFoundError(id);
    throw new VehicleAssignedCannotDeleteError();
  }

  /**
   * Connectivity transition. `offline` carries the rule "not while assigned",
   * enforced in the update filter (see MongoVehicleRepository.setStatus), so a
   * takeover landing at the same instant cannot slip through.
   */
  async setStatus(id: string, status: VehicleStatus): Promise<VehicleResponse> {
    const updated = await this.vehicles.setStatus(id, status);

    if (updated) {
      await this.events.record({
        vehicleId: id,
        vehicleName: updated.name,
        operatorId: null,
        type: status === 'online' ? 'went_online' : 'went_offline',
      });
      return this.present(id, updated);
    }

    const current = await this.vehicles.findById(id);
    if (!current) throw new VehicleNotFoundError(id);

    const rejection = VehicleRules.canChangeStatusTo(toVehicleState(current), status);
    if (rejection) throw new VehicleAssignedCannotGoOfflineError();

    // Filter matched nothing for a reason we did not anticipate.
    throw new VehicleAssignedCannotGoOfflineError();
  }

  private async present(
    _id: string,
    doc: Parameters<typeof toVehicleResponse>[0],
  ): Promise<VehicleResponse> {
    const operatorId = doc.assignedOperatorId?.toString();
    const names = operatorId ? await this.operators.namesByIds([operatorId]) : undefined;
    return toVehicleResponse(doc, names);
  }
}
