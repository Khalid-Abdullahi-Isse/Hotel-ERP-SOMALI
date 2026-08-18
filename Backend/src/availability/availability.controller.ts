import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { AvailabilityService } from './availability.service.js';
import { SearchAvailabilityQueryDto } from './dto/search-availability-query.dto.js';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('rooms')
  @RequirePermissions(PERMISSIONS.AVAILABILITY_VIEW)
  search(@Query() query: SearchAvailabilityQueryDto, @CurrentUser() actor: RequestUser) {
    return this.availability.search(query, actor);
  }
}
