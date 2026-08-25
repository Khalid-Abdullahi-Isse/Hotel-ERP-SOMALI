import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../auth/auth.constants.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CHART_OF_ACCOUNTS_VIEW)
  list(@Query() query: ListAccountsQueryDto, @CurrentUser() actor: RequestUser) {
    return this.accounts.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CHART_OF_ACCOUNTS_VIEW)
  find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accounts.find(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE)
  create(@Body() dto: CreateAccountDto, @CurrentUser() actor: RequestUser) {
    return this.accounts.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accounts.update(id, dto, actor);
  }
}
