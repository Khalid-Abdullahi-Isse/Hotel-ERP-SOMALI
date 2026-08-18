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
import { AdminOnly } from '../common/decorators/admin-only.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AssignRolesDto } from './dto/assign-roles.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a hotel user (ADMIN only)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: RequestUser) {
    return this.users.create(dto, actor);
  }

  @Get()
  @ApiOperation({ summary: 'List hotel users, including deactivated users (ADMIN only)' })
  list(@CurrentUser() actor: RequestUser) {
    return this.users.list(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.findOne(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user and revoke all sessions (ADMIN only)' })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.deactivate(id, actor);
  }

  @Patch(':id/restore')
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.restore(id, actor);
  }

  @Patch(':id/unlock')
  unlock(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.unlock(id, actor);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.resetPassword(id, dto, actor);
  }

  @Put(':id/roles')
  assignRoles(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.assignRoles(id, dto, actor);
  }
}
