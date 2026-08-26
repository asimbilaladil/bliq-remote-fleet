import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssignmentEvent, AssignmentEventSchema } from './schemas/assignment-event.schema';
import { AssignmentEventsService } from './assignment-events.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AssignmentEvent.name, schema: AssignmentEventSchema }]),
  ],
  providers: [AssignmentEventsService],
  exports: [AssignmentEventsService],
})
export class AssignmentEventsModule {}
