import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { UpdateHotelDto } from './dto/update-hotel.dto.js';
import { HotelsService } from './hotels.service.js';

@ApiTags('hotel')
@ApiBearerAuth()
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get('current')
  @RequirePermissions(PERMISSIONS.HOTEL_VIEW)
  @ApiOperation({ summary: 'Get the authenticated user’s hotel' })
  current(@CurrentUser() actor: RequestUser) {
    return this.hotels.current(actor);
  }

  @Patch('current')
  @RequirePermissions(PERMISSIONS.HOTEL_UPDATE)
  @ApiOperation({ summary: 'Update the authenticated user’s hotel' })
  update(@Body() dto: UpdateHotelDto, @CurrentUser() actor: RequestUser) {
    return this.hotels.update(dto, actor);
  }
}
