import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ApplyDiscountDto } from './dto/apply-discount.dto.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { CreateReservationWithGuestDto } from './dto/create-reservation-with-guest.dto.js';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto.js';
import { ReplaceReservationRoomsDto } from './dto/replace-reservation-rooms.dto.js';
import { ReservationActionDto } from './dto/reservation-action.dto.js';
import { ReservationTimelineQueryDto } from './dto/reservation-timeline-query.dto.js';
import { UpdateReservationDto } from './dto/update-reservation.dto.js';
import { ReservationsService } from './reservations.service.js';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.RESERVATION_CREATE)
  @ApiOperation({ summary: 'Create an atomic single-room or multi-room reservation' })
  create(@Body() dto: CreateReservationDto, @CurrentUser() actor: RequestUser) {
    return this.reservations.create(dto, actor);
  }

  @Post('with-guest')
  @RequirePermissions(PERMISSIONS.RESERVATION_CREATE, PERMISSIONS.GUEST_CREATE)
  @ApiOperation({ summary: 'Atomically create a guest and reservation' })
  createWithGuest(
    @Body() dto: CreateReservationWithGuestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.createWithGuest(dto, actor);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.RESERVATION_VIEW)
  list(@Query() query: ListReservationsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reservations.list(query, actor);
  }

  @Get('timeline')
  @RequirePermissions(PERMISSIONS.RESERVATION_VIEW)
  @ApiOperation({ summary: 'Get rooms and overlapping reservations for a seven-day timeline' })
  timeline(@Query() query: ReservationTimelineQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reservations.timeline(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.RESERVATION_VIEW)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.findOne(id, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.RESERVATION_UPDATE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.update(id, dto, actor);
  }

  @Put(':id/rooms')
  @RequirePermissions(PERMISSIONS.RESERVATION_UPDATE)
  replaceRooms(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReplaceReservationRoomsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.replaceRooms(id, dto, actor);
  }

  @Patch(':id/discount')
  @RequirePermissions(PERMISSIONS.RESERVATION_DISCOUNT)
  applyDiscount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ApplyDiscountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.applyDiscount(id, dto, actor);
  }

  @Post(':id/confirm')
  @RequirePermissions(PERMISSIONS.RESERVATION_CONFIRM)
  confirm(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.confirm(id, actor);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.RESERVATION_CANCEL)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReservationActionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.cancel(id, dto, actor);
  }

  @Post(':id/no-show')
  @RequirePermissions(PERMISSIONS.RESERVATION_CANCEL)
  noShow(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReservationActionDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.noShow(id, dto, actor);
  }
}
