import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { AccountingReportsService } from './accounting-reports.service.js';
import {
  AccountingReportQueryDto,
  BalanceSheetQueryDto,
  GeneralLedgerQueryDto,
} from './dto/accounting-report-query.dto.js';

@ApiTags('accounting')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.FINANCIAL_REPORTS_VIEW)
@Controller('accounting')
export class AccountingReportsController {
  constructor(private readonly reports: AccountingReportsService) {}

  @Get('general-ledger')
  generalLedger(@Query() query: GeneralLedgerQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reports.generalLedger(query, actor);
  }

  @Get('trial-balance')
  trialBalance(@Query() query: AccountingReportQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reports.trialBalance(query, actor);
  }

  @Get('profit-loss')
  profitLoss(@Query() query: AccountingReportQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reports.profitLoss(query, actor);
  }

  @Get('balance-sheet')
  balanceSheet(@Query() query: BalanceSheetQueryDto, @CurrentUser() actor: RequestUser) {
    return this.reports.balanceSheet(query, actor);
  }

  @Get('account-statement/:accountId')
  accountStatement(
    @Param('accountId', new ParseUUIDPipe({ version: '4' })) accountId: string,
    @Query() query: GeneralLedgerQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reports.accountStatement(query, accountId, actor);
  }
}
