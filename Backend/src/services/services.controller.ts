import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServicesService } from './services.service.js';

@ApiTags('service pricing')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SERVICE_MANAGE)
  create(@Body() dto: CreateServiceDto, @CurrentUser() actor: RequestUser) {
    return this.services.create(dto, actor);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  list(@CurrentUser() actor: RequestUser) {
    return this.services.list(actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.services.findOne(id, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_MANAGE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.services.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_MANAGE)
  @ApiOperation({ summary: 'Deactivate a service without deleting financial history' })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.services.setActive(id, false, actor);
  }

  @Patch(':id/restore')
  @RequirePermissions(PERMISSIONS.SERVICE_MANAGE)
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.services.setActive(id, true, actor);
  }
}
