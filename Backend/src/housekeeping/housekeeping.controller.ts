import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { HousekeepingUpdateDto } from './dto/housekeeping.dto.js';
import { HousekeepingService } from './housekeeping.service.js';
@ApiTags('housekeeping')
@ApiBearerAuth()
@Controller('housekeeping/tasks')
export class HousekeepingController {
  constructor(private readonly service: HousekeepingService) {}
  @Get() @RequirePermissions(PERMISSIONS.HOUSEKEEPING_VIEW) list(
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.list(actor);
  }
  @Get(':id') @RequirePermissions(PERMISSIONS.HOUSEKEEPING_VIEW) find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.find(id, actor);
  }
  @Patch(':id') @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE) update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: HousekeepingUpdateDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.update(id, dto, actor);
  }
  @Post(':id/start') @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE) start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.start(id, actor);
  }
  @Post(':id/complete') @RequirePermissions(PERMISSIONS.HOUSEKEEPING_UPDATE) complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.complete(id, actor);
  }
}
