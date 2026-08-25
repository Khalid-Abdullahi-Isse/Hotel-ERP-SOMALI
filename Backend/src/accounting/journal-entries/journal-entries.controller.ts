import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto.js';
import { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto.js';
import { ReverseJournalEntryDto } from './dto/reverse-journal-entry.dto.js';
import { JournalEntriesService } from './journal-entries.service.js';
import { AccountingPostingService } from '../posting/accounting-posting.service.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/journal-entries')
export class JournalEntriesController {
  constructor(
    private readonly entries: JournalEntriesService,
    private readonly posting: AccountingPostingService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  list(@Query() query: ListJournalEntriesQueryDto, @CurrentUser() actor: RequestUser) {
    return this.entries.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.entries.find(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.JOURNAL_POST)
  create(@Body() dto: CreateJournalEntryDto, @CurrentUser() actor: RequestUser) {
    return this.entries.create(dto, actor);
  }

  @Post(':id/post')
  @RequirePermissions(PERMISSIONS.JOURNAL_POST)
  post(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.posting.post(id, actor);
  }

  @Post(':id/reverse')
  @RequirePermissions(PERMISSIONS.JOURNAL_REVERSE)
  reverse(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.posting.reverse(id, dto.reason, actor);
  }
}
