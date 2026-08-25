import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import {
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto.js';
import { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto.js';
import { MaintenanceService } from './maintenance.service.js';
@ApiTags('maintenance')
@ApiBearerAuth()
@Controller('maintenance/requests')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}
  @Get() @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW) list(
    @Query() query: ListMaintenanceQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.list(query, actor);
  }
  @Post() @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE) create(
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.create(dto, actor);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.MAINTENANCE_VIEW) find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.find(id, actor);
  }
  @Patch(':id') @RequirePermissions(PERMISSIONS.MAINTENANCE_UPDATE) update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMaintenanceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Post(':id/start') @RequirePermissions(PERMISSIONS.MAINTENANCE_UPDATE) start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.start(id, actor);
  }
  @Post(':id/complete') @RequirePermissions(PERMISSIONS.MAINTENANCE_UPDATE) complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteMaintenanceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.complete(id, dto, actor);
  }
}
