import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RemoteOperator, RemoteOperatorSchema } from './schemas/remote-operator.schema';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RemoteOperator.name, schema: RemoteOperatorSchema }]),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService, MongooseModule],
})
export class OperatorsModule {}
