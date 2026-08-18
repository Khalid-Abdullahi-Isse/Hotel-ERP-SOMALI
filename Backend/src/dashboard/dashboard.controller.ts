import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { DashboardService } from './dashboard.service.js';
@ApiTags('dashboard')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary') summary(@CurrentUser() actor: RequestUser) {
    return this.dashboard.summary(actor);
  }
}
