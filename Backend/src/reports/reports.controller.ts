import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { ReportQueryDto } from './dto/report-query.dto.js';
import { ReportsService } from './reports.service.js';
@ApiTags('reports')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.REPORT_VIEW)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('revenue') revenue(@Query() q: ReportQueryDto, @CurrentUser() a: RequestUser) {
    return this.reports.revenue(q, a);
  }
  @Get('expenses') expenses(@Query() q: ReportQueryDto, @CurrentUser() a: RequestUser) {
    return this.reports.expenses(q, a);
  }
  @Get('occupancy') occupancy(@Query() q: ReportQueryDto, @CurrentUser() a: RequestUser) {
    return this.reports.occupancy(q, a);
  }
  @Get('reservations') reservations(@Query() q: ReportQueryDto, @CurrentUser() a: RequestUser) {
    return this.reports.reservations(q, a);
  }
  @Get('payments') payments(@Query() q: ReportQueryDto, @CurrentUser() a: RequestUser) {
    return this.reports.payments(q, a);
  }
  @Get('outstanding-balances') outstanding(@CurrentUser() a: RequestUser) {
    return this.reports.outstanding(a);
  }
}
