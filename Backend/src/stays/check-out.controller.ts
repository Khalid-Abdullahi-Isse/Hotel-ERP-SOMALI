import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CheckOutService } from './check-out.service.js';

@ApiTags('stays')
@ApiBearerAuth()
@Controller('reservations')
export class CheckOutController {
  constructor(private readonly checkOutService: CheckOutService) {}

  @Post(':id/check-out')
  @RequirePermissions(PERMISSIONS.CHECK_OUT_CREATE)
  @ApiOperation({ summary: 'Atomically post room charges, close the stay, and dirty its rooms' })
  checkOut(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.checkOutService.checkOut(id, actor);
  }
}
