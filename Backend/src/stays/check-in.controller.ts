import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CheckInService } from './check-in.service.js';

@ApiTags('stays')
@ApiBearerAuth()
@Controller('reservations')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post(':id/check-in')
  @RequirePermissions(PERMISSIONS.CHECK_IN_CREATE)
  @ApiOperation({ summary: 'Atomically check in a confirmed reservation and occupy its rooms' })
  checkIn(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.checkInService.checkIn(id, actor);
  }
}
