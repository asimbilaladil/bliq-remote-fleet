import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AssignmentEvent,
  AssignmentEventDocument,
  AssignmentEventType,
} from './schemas/assignment-event.schema';

export interface AssignmentEventResponse {
  type: AssignmentEventType;
  vehicleId: string;
  vehicleName: string;
  operatorId: string | null;
  occurredAt: string;
}

@Injectable()
export class AssignmentEventsService {
  private readonly logger = new Logger(AssignmentEventsService.name);

  constructor(
    @InjectModel(AssignmentEvent.name)
    private readonly model: Model<AssignmentEventDocument>,
  ) {}

  /**
   * Fire-and-forget. The command has already committed by the time we get
   * here; a failed audit write must not turn a successful takeover into an
   * error for the operator. It is logged loudly instead.
   */
  async record(event: {
    vehicleId: string;
    vehicleName: string;
    operatorId: string | null;
    type: AssignmentEventType;
  }): Promise<void> {
    try {
      await this.model.create({
        vehicleId: new Types.ObjectId(event.vehicleId),
        vehicleName: event.vehicleName,
        operatorId: event.operatorId ? new Types.ObjectId(event.operatorId) : null,
        type: event.type,
      });
    } catch (err) {
      this.logger.error(
        `Failed to record ${event.type} for vehicle ${event.vehicleId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async findForVehicle(vehicleId: string, limit = 50): Promise<AssignmentEventResponse[]> {
    const docs = await this.model
      .find({ vehicleId: new Types.ObjectId(vehicleId) })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();

    return docs.map((d) => ({
      type: d.type,
      vehicleId: d.vehicleId.toString(),
      vehicleName: d.vehicleName,
      operatorId: d.operatorId ? d.operatorId.toString() : null,
      occurredAt: d.occurredAt.toISOString(),
    }));
  }
}
