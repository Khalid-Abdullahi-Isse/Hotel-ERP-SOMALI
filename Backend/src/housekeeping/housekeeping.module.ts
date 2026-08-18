import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller.js';
import { HousekeepingService } from './housekeeping.service.js';
@Module({ controllers: [HousekeepingController], providers: [HousekeepingService] })
export class HousekeepingModule {}
