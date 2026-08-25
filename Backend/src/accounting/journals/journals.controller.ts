import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CreateJournalDto } from './dto/create-journal.dto.js';
import { ListJournalsQueryDto } from './dto/list-journals-query.dto.js';
import { UpdateJournalDto } from './dto/update-journal.dto.js';
import { JournalsService } from './journals.service.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/journals')
export class JournalsController {
  constructor(private readonly journals: JournalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  list(@Query() query: ListJournalsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.journals.list(query, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  create(@Body() dto: CreateJournalDto, @CurrentUser() actor: RequestUser) {
    return this.journals.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ACCOUNTING_MANAGE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateJournalDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.journals.update(id, dto, actor);
  }
}
