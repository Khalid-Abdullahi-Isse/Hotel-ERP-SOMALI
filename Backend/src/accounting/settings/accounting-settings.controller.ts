import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { AccountingSettingsService } from './accounting-settings.service.js';
import { UpdateAccountingSettingsDto } from './dto/update-accounting-settings.dto.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/settings')
export class AccountingSettingsController {
  constructor(private readonly settings: AccountingSettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_VIEW)
  get(@CurrentUser() actor: RequestUser) {
    return this.settings.get(actor);
  }

  @Post('initialize')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  initialize(@CurrentUser() actor: RequestUser) {
    return this.settings.initialize(actor);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  update(@Body() dto: UpdateAccountingSettingsDto, @CurrentUser() actor: RequestUser) {
    return this.settings.update(dto, actor);
  }
}
