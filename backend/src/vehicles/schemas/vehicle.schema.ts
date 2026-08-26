import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VehicleStatus = 'online' | 'offline';
export const VEHICLE_STATUSES: VehicleStatus[] = ['online', 'offline'];

export type VehicleDocument = HydratedDocument<Vehicle>;

/**
 * A vehicle carries two INDEPENDENT states:
 *   - `status`            : connectivity (online / offline)
 *   - `assignedOperatorId`: control     (held by an operator, or free)
 *
 * Assignment lives here and only here. There is deliberately no mirrored
 * `operator.currentVehicleId`, so the two can never disagree.
 */
@Schema({ timestamps: true, collection: 'vehicles' })
export class Vehicle {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ required: true, enum: VEHICLE_STATUSES, default: 'offline', index: true })
  status!: VehicleStatus;

  @Prop({ type: Types.ObjectId, ref: 'RemoteOperator', default: null })
  assignedOperatorId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

/**
 * THE invariant that a single-document conditional update cannot express:
 * "an operator holds at most one vehicle" spans two vehicle documents.
 *
 * A unique PARTIAL index over non-null `assignedOperatorId` makes a second
 * concurrent claim by the same operator physically impossible — the second
 * write fails with duplicate-key (11000), which the repository translates to
 * OPERATOR_ALREADY_HOLDS_VEHICLE. No transaction, no replica set required.
 */
VehicleSchema.index(
  { assignedOperatorId: 1 },
  {
    unique: true,
    name: 'uniq_active_assignment',
    partialFilterExpression: { assignedOperatorId: { $type: 'objectId' } },
  },
);
