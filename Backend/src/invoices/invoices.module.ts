import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';
@Module({
  imports: [PaymentsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
