import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vehicle, VehicleDocument, VehicleStatus } from '../schemas/vehicle.schema';
import { CreateVehicleData, VehicleRepository } from './vehicle.repository';
import {
  OperatorAlreadyHoldsVehicleError,
  VehicleNameTakenError,
} from '../../common/errors/domain-error';

const DUPLICATE_KEY = 11000;

function isDuplicateKey(err: unknown): err is { code: number; message: string } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === DUPLICATE_KEY;
}

@Injectable()
export class MongoVehicleRepository extends VehicleRepository {
  constructor(@InjectModel(Vehicle.name) private readonly model: Model<VehicleDocument>) {
    super();
  }

  async create(data: CreateVehicleData): Promise<VehicleDocument> {
    try {
      return await this.model.create({
        name: data.name,
        status: data.status ?? 'offline',
        assignedOperatorId: null,
        assignedAt: null,
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw new VehicleNameTakenError(data.name);
      throw err;
    }
  }

  findAll(filter: { status?: VehicleStatus } = {}): Promise<VehicleDocument[]> {
    const query = filter.status ? { status: filter.status } : {};
    return this.model.find(query).sort({ name: 1 }).exec();
  }

  findById(id: string): Promise<VehicleDocument | null> {
    return this.model.findById(id).exec();
  }

  findByOperator(operatorId: string): Promise<VehicleDocument | null> {
    return this.model.findOne({ assignedOperatorId: new Types.ObjectId(operatorId) }).exec();
  }

  async rename(id: string, name: string): Promise<VehicleDocument | null> {
    try {
      return await this.model.findByIdAndUpdate(id, { $set: { name } }, { new: true }).exec();
    } catch (err) {
      if (isDuplicateKey(err)) throw new VehicleNameTakenError(name);
      throw err;
    }
  }

  deleteIfUnassigned(id: string): Promise<VehicleDocument | null> {
    return this.model.findOneAndDelete({ _id: id, assignedOperatorId: null }).exec();
  }

  /**
   * Going offline is only legal while unassigned — the rule is the filter, so
   * a release racing a go-offline can never interleave into an illegal state.
   * Going online has no precondition.
   */
  setStatus(id: string, status: VehicleStatus): Promise<VehicleDocument | null> {
    const filter =
      status === 'offline'
        ? { _id: id, assignedOperatorId: null }
        : { _id: id };

    return this.model.findOneAndUpdate(filter, { $set: { status } }, { new: true }).exec();
  }

  /**
   * The core of the system.
   *
   * Two guarantees, two mechanisms:
   *  1. "online AND unassigned" is in the filter, so of N concurrent claims on
   *     one vehicle exactly ONE document matches and updates. The losers get
   *     `null` back — not a stale read, an authoritative miss.
   *  2. "one vehicle per operator" is enforced by the unique partial index
   *     `uniq_active_assignment`; a second concurrent claim by the same
   *     operator on a DIFFERENT vehicle fails with duplicate-key here.
   */
  async claim(id: string, operatorId: string): Promise<VehicleDocument | null> {
    try {
      return await this.model
        .findOneAndUpdate(
          { _id: id, status: 'online', assignedOperatorId: null },
          { $set: { assignedOperatorId: new Types.ObjectId(operatorId), assignedAt: new Date() } },
          { new: true },
        )
        .exec();
    } catch (err) {
      if (isDuplicateKey(err)) throw new OperatorAlreadyHoldsVehicleError();
      throw err;
    }
  }

  release(id: string, operatorId: string): Promise<VehicleDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, assignedOperatorId: new Types.ObjectId(operatorId) },
        { $set: { assignedOperatorId: null, assignedAt: null } },
        { new: true },
      )
      .exec();
  }
}
