import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ChargesService } from './charges.service.js';
import { AddServiceChargeDto } from './dto/add-service-charge.dto.js';
import { VoidChargeDto } from './dto/void-charge.dto.js';

@ApiTags('stay charges and folio')
@ApiBearerAuth()
@Controller()
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Post('reservations/:id/charges')
  @RequirePermissions(PERMISSIONS.CHARGE_CREATE)
  @ApiOperation({ summary: 'Post a configured service price to an active stay' })
  addServiceCharge(
    @Param('id', new ParseUUIDPipe({ version: '4' })) reservationId: string,
    @Body() dto: AddServiceChargeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.charges.addServiceCharge(reservationId, dto, actor);
  }

  @Get('reservations/:id/charges')
  @RequirePermissions(PERMISSIONS.CHARGE_VIEW)
  list(
    @Param('id', new ParseUUIDPipe({ version: '4' })) reservationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.charges.list(reservationId, actor);
  }

  @Get('reservations/:id/folio')
  @RequirePermissions(PERMISSIONS.CHARGE_VIEW)
  folio(
    @Param('id', new ParseUUIDPipe({ version: '4' })) reservationId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.charges.folio(reservationId, actor);
  }

  @Post('charges/:id/void')
  @RequirePermissions(PERMISSIONS.CHARGE_VOID)
  @ApiOperation({ summary: 'Void a charge without deleting its audit history' })
  void(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: VoidChargeDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.charges.void(id, dto, actor);
  }
}
