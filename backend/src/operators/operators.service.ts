import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RemoteOperator, RemoteOperatorDocument } from './schemas/remote-operator.schema';
import { OperatorNotFoundError } from '../common/errors/domain-error';

export interface OperatorResponse {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class OperatorsService {
  constructor(
    @InjectModel(RemoteOperator.name)
    private readonly model: Model<RemoteOperatorDocument>,
  ) {}

  async findAll(): Promise<OperatorResponse[]> {
    const docs = await this.model.find().sort({ name: 1 }).exec();
    return docs.map(OperatorsService.toResponse);
  }

  /** Throws rather than returning null — callers always require existence. */
  async assertExists(id: string): Promise<void> {
    const exists = await this.model.exists({ _id: id });
    if (!exists) throw new OperatorNotFoundError(id);
  }

  async namesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const docs = await this.model.find({ _id: { $in: ids } }, { name: 1 }).exec();
    return new Map(docs.map((d) => [d._id.toString(), d.name]));
  }

  private static toResponse(doc: RemoteOperatorDocument): OperatorResponse {
    return { id: doc._id.toString(), name: doc.name, email: doc.email };
  }
}
