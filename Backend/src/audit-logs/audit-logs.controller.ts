import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { AuditLogsService } from './audit-logs.service.js';
import { ListAuditQueryDto } from './dto/list-audit-query.dto.js';
@ApiTags('audit logs')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.AUDIT_VIEW)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audits: AuditLogsService) {}
  @Get() list(@Query() q: ListAuditQueryDto, @CurrentUser() a: RequestUser) {
    return this.audits.list(q, a);
  }
  @Get(':id') find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() a: RequestUser,
  ) {
    return this.audits.find(id, a);
  }
}
