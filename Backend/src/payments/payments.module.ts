import { Module } from '@nestjs/common';
import { ChargesModule } from '../charges/charges.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
@Module({
  imports: [ChargesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
