import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RemoteOperatorDocument = HydratedDocument<RemoteOperator>;

@Schema({ timestamps: true, collection: 'remote_operators' })
export class RemoteOperator {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true, unique: true })
  email!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RemoteOperatorSchema = SchemaFactory.createForClass(RemoteOperator);
