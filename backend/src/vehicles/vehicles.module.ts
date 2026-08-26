import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vehicle, VehicleSchema } from './schemas/vehicle.schema';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleRepository } from './repositories/vehicle.repository';
import { MongoVehicleRepository } from './repositories/mongo-vehicle.repository';
import { ControlService } from '../control/control.service';
import { OperatorsModule } from '../operators/operators.module';
import { AssignmentEventsModule } from '../history/assignment-events.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vehicle.name, schema: VehicleSchema }]),
    OperatorsModule,
    AssignmentEventsModule,
  ],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    ControlService,
    { provide: VehicleRepository, useClass: MongoVehicleRepository },
  ],
  exports: [VehiclesService, ControlService, VehicleRepository],
})
export class VehiclesModule {}
