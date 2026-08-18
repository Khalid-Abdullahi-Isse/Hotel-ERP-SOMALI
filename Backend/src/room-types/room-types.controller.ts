import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreateRoomTypeDto } from './dto/create-room-type.dto.js';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto.js';
import { RoomTypesService } from './room-types.service.js';

@ApiTags('room types and pricing')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ROOM_TYPE_MANAGE)
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Post()
  create(@Body() dto: CreateRoomTypeDto, @CurrentUser() actor: RequestUser) {
    return this.roomTypes.create(dto, actor);
  }

  @Get()
  list(@CurrentUser() actor: RequestUser) {
    return this.roomTypes.list(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roomTypes.findOne(id, actor);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateRoomTypeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roomTypes.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a room type not used by active rooms' })
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roomTypes.deactivate(id, actor);
  }

  @Patch(':id/restore')
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.roomTypes.restore(id, actor);
  }
}
