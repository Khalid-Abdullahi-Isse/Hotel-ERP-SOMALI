import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { BusinessDateDto } from './dto/business-date.dto.js';
import { NightAuditService } from './night-audit.service.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/night-audit')
export class NightAuditController {
  constructor(private readonly nightAudit: NightAuditService) {}

  @Get(':businessDate')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_VIEW)
  get(@Param('businessDate') businessDate: string, @CurrentUser() actor: RequestUser) {
    return this.nightAudit.getBusinessDate(actor.hotelId, businessDate);
  }

  @Post('post')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  post(@Body() dto: BusinessDateDto, @CurrentUser() actor: RequestUser) {
    return this.nightAudit.postBusinessDate(actor.hotelId, dto.businessDate, actor);
  }

  @Post('advance')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  advance(@Body() dto: BusinessDateDto, @CurrentUser() actor: RequestUser) {
    return this.nightAudit.advanceBusinessDate(actor.hotelId, dto.businessDate, actor);
  }

  @Post(':businessDate/reopen')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  reopen(@Param('businessDate') businessDate: string, @CurrentUser() actor: RequestUser) {
    return this.nightAudit.reopen(actor.hotelId, businessDate, actor);
  }
}