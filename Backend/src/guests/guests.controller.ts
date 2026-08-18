import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreateGuestDto } from './dto/create-guest.dto.js';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto.js';
import { UpdateGuestDto } from './dto/update-guest.dto.js';
import { GuestsService } from './guests.service.js';

@ApiTags('guests')
@ApiBearerAuth()
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.GUEST_CREATE)
  create(@Body() dto: CreateGuestDto, @CurrentUser() actor: RequestUser) {
    return this.guests.create(dto, actor);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  list(@Query() query: ListGuestsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.guests.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GUEST_VIEW)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.guests.findOne(id, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GUEST_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateGuestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.guests.update(id, dto, actor);
  }
}
