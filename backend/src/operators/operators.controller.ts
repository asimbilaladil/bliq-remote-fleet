import { Controller, Get } from '@nestjs/common';
import { OperatorResponse, OperatorsService } from './operators.service';

/**
 * Read-only by design: operators are seeded (see README §Assumptions).
 * A full CRUD surface would add code without exercising any of the rules
 * this challenge is about.
 */
@Controller('operators')
export class OperatorsController {
  constructor(private readonly operators: OperatorsService) {}

  @Get()
  findAll(): Promise<OperatorResponse[]> {
    return this.operators.findAll();
  }
}
