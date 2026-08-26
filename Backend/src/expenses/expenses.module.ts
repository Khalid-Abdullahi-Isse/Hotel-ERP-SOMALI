import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';
@Module({
  imports: [AccountingModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
