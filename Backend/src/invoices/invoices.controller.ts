import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { VoidInvoiceDto } from './dto/void-invoice.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { InvoicesService } from './invoices.service.js';
@ApiTags('invoices')
@ApiBearerAuth()
@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Post('reservations/:id/invoice')
  @RequirePermissions(PERMISSIONS.INVOICE_CREATE)
  create(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.invoices.create(id, actor);
  }
  @Get('invoices')
  @RequirePermissions(PERMISSIONS.INVOICE_VIEW)
  list(@Query() query: ListInvoicesQueryDto, @CurrentUser() actor: RequestUser) {
    return this.invoices.list(query, actor);
  }
  @Get('invoices/:id')
  @RequirePermissions(PERMISSIONS.INVOICE_VIEW)
  find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.invoices.find(id, actor);
  }
  @Post('invoices/:id/void')
  @RequirePermissions(PERMISSIONS.INVOICE_VOID)
  void(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.invoices.void(id, dto.reason, actor);
  }
}
