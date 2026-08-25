import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { ControlService } from '../control/control.service';
import { AssignmentEventsService } from '../history/assignment-events.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { OperatorActionDto } from './dto/operator-action.dto';
import { ListVehiclesQuery } from './dto/list-vehicles.query';
import { IdParamDto } from '../common/dto/id-param.dto';
import { VehicleResponse } from './vehicle.presenter';

/**
 * Transport only: validate, delegate, return. No branching on domain state
 * happens here — if you find yourself writing an `if` about vehicles in this
 * file, it belongs in a service.
 */
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly control: ControlService,
    private readonly events: AssignmentEventsService,
  ) {}

  @Get()
  findAll(@Query() query: ListVehiclesQuery): Promise<VehicleResponse[]> {
    return this.vehicles.findAll({ status: query.status });
  }

  @Get(':id')
  findOne(@Param() { id }: IdParamDto): Promise<VehicleResponse> {
    return this.vehicles.findOne(id);
  }

  @Get(':id/history')
  history(@Param() { id }: IdParamDto) {
    return this.events.findForVehicle(id);
  }

  @Post()
  create(@Body() dto: CreateVehicleDto): Promise<VehicleResponse> {
    return this.vehicles.create(dto);
  }

  @Patch(':id')
  update(@Param() { id }: IdParamDto, @Body() dto: UpdateVehicleDto): Promise<VehicleResponse> {
    return this.vehicles.rename(id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param() { id }: IdParamDto): Promise<void> {
    return this.vehicles.remove(id);
  }

  @Patch(':id/status')
  setStatus(@Param() { id }: IdParamDto, @Body() dto: UpdateStatusDto): Promise<VehicleResponse> {
    return this.vehicles.setStatus(id, dto.status);
  }

  @Post(':id/takeover')
  @HttpCode(200)
  takeover(@Param() { id }: IdParamDto, @Body() dto: OperatorActionDto): Promise<VehicleResponse> {
    return this.control.takeover(id, dto.operatorId);
  }

  @Post(':id/release')
  @HttpCode(200)
  release(@Param() { id }: IdParamDto, @Body() dto: OperatorActionDto): Promise<VehicleResponse> {
    return this.control.release(id, dto.operatorId);
  }
}
