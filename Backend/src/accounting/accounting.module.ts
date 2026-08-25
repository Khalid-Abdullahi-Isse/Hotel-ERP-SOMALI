import { Module } from '@nestjs/common';
import { AccountsController } from './accounts/accounts.controller.js';
import { AccountsService } from './accounts/accounts.service.js';
import { JournalEntriesController } from './journal-entries/journal-entries.controller.js';
import { JournalEntriesService } from './journal-entries/journal-entries.service.js';
import { JournalsController } from './journals/journals.controller.js';
import { JournalsService } from './journals/journals.service.js';
import { AccountingPostingService } from './posting/accounting-posting.service.js';
import { AccountingReportsController } from './reports/accounting-reports.controller.js';
import { AccountingReportsService } from './reports/accounting-reports.service.js';
import { AccountingSettingsController } from './settings/accounting-settings.controller.js';
import { AccountingSettingsService } from './settings/accounting-settings.service.js';

@Module({
  controllers: [
    AccountsController,
    JournalsController,
    JournalEntriesController,
    AccountingReportsController,
    AccountingSettingsController,
  ],
  providers: [
    AccountsService,
    JournalsService,
    JournalEntriesService,
    AccountingPostingService,
    AccountingReportsService,
    AccountingSettingsService,
  ],
  exports: [AccountingPostingService, AccountingSettingsService],
})
export class AccountingModule {}
