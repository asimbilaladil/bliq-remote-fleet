import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vehicle, VehicleSchema } from './schemas/vehicle.schema';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleRepository } from './repositories/vehicle.repository';
import { MongoVehicleRepository } from './repositories/mongo-vehicle.repository';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vehicle.name, schema: VehicleSchema }]),
    OperatorsModule,
  ],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    { provide: VehicleRepository, useClass: MongoVehicleRepository },
  ],
  exports: [VehiclesService, VehicleRepository],
})
export class VehiclesModule {}
