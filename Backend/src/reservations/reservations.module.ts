import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [AvailabilityModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
