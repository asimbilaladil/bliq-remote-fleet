import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AssignmentEventType =
  | 'taken_over'
  | 'released'
  | 'went_online'
  | 'went_offline';

export type AssignmentEventDocument = HydratedDocument<AssignmentEvent>;

/**
 * Append-only fact log. The invariant is enforced synchronously and
 * atomically by the vehicle document; this records that it happened, so
 * "who was operating BLQ-014 at 14:32?" has an answer. Writing it must never
 * be able to fail the command — see ControlService.
 */
@Schema({ timestamps: { createdAt: 'occurredAt', updatedAt: false }, collection: 'assignment_events' })
export class AssignmentEvent {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  vehicleId!: Types.ObjectId;

  @Prop({ required: true })
  vehicleName!: string;

  @Prop({ type: Types.ObjectId, default: null })
  operatorId!: Types.ObjectId | null;

  @Prop({ required: true })
  type!: AssignmentEventType;

  occurredAt!: Date;
}

export const AssignmentEventSchema = SchemaFactory.createForClass(AssignmentEvent);
AssignmentEventSchema.index({ vehicleId: 1, occurredAt: -1 });
