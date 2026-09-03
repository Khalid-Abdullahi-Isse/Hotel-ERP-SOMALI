import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CreateFiscalPeriodDto } from './dto/create-fiscal-period.dto.js';
import { ListFiscalPeriodsQueryDto } from './dto/list-fiscal-periods-query.dto.js';
import { UpdateFiscalPeriodDto } from './dto/update-fiscal-period.dto.js';
import { FiscalPeriodsService } from './fiscal-periods.service.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/fiscal-periods')
export class FiscalPeriodsController {
  constructor(private readonly periods: FiscalPeriodsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_VIEW)
  list(@Query() query: ListFiscalPeriodsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.periods.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_VIEW)
  find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.periods.find(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  create(@Body() dto: CreateFiscalPeriodDto, @CurrentUser() actor: RequestUser) {
    return this.periods.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateFiscalPeriodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.periods.update(id, dto, actor);
  }

  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.periods.close(id, actor);
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.periods.reopen(id, actor);
  }
}
