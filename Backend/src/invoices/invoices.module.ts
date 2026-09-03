import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
@Module({
  imports: [PaymentsModule, AccountingModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
