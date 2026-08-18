import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/auth.types.js';
import { AdminOnly } from '../common/decorators/admin-only.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles and permissions')
@ApiBearerAuth()
@AdminOnly()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentUser() actor: RequestUser) {
    return this.roles.list(actor);
  }

  @Get('permissions')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom hotel role (ADMIN only)' })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: RequestUser) {
    return this.roles.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roles.update(id, dto, actor);
  }

  @Put(':id/permissions')
  setPermissions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roles.setPermissions(id, dto, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate an unused custom role (ADMIN only)' })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roles.deactivate(id, actor);
  }
}
