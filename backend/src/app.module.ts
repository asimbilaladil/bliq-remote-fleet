import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { VehiclesModule } from './vehicles/vehicles.module';
import { OperatorsModule } from './operators/operators.module';
import { AssignmentEventsModule } from './history/assignment-events.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/bliq-fleet'),
        autoIndex: true,
      }),
    }),
    VehiclesModule,
    OperatorsModule,
    AssignmentEventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
