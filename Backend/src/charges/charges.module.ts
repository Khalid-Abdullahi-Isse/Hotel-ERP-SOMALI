import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module.js';
import { ChargesController } from './charges.controller.js';
import { ChargesService } from './charges.service.js';

@Module({
  imports: [AccountingModule],
  controllers: [ChargesController],
  providers: [ChargesService],
  exports: [ChargesService],
})
export class ChargesModule {}
