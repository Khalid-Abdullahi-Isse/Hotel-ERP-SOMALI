import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { ChargesModule } from '../charges/charges.module.js';
import { CheckInController } from './check-in.controller.js';
import { CheckInService } from './check-in.service.js';
import { CheckOutController } from './check-out.controller.js';
import { CheckOutService } from './check-out.service.js';

@Module({
  imports: [AvailabilityModule, ChargesModule],
  controllers: [CheckInController, CheckOutController],
  providers: [CheckInService, CheckOutService],
})
export class StaysModule {}
