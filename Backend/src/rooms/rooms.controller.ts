import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ROOM_CREATE)
  create(@Body() dto: CreateRoomDto, @CurrentUser() actor: RequestUser) {
    return this.rooms.create(dto, actor);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ROOM_VIEW)
  list(@Query() query: ListRoomsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.rooms.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROOM_VIEW)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.rooms.findOne(id, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.rooms.update(id, dto, actor);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE)
  @ApiOperation({ summary: 'Apply a Phase 3 room status transition' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoomStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.rooms.updateStatus(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE)
  @ApiOperation({ summary: 'Deactivate a room while preserving history' })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.rooms.deactivate(id, actor);
  }

  @Patch(':id/restore')
  @RequirePermissions(PERMISSIONS.ROOM_UPDATE)
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.rooms.restore(id, actor);
  }
}
