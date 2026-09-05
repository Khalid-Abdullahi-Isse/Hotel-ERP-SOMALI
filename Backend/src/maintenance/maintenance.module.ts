import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module.js';
import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceService } from './maintenance.service.js';
@Module({
  imports: [AccountingModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
