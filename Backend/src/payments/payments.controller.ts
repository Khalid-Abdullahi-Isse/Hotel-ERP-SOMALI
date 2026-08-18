import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { PaymentsService } from './payments.service.js';
@ApiTags('payments and refunds')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post('payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_CREATE)
  create(@Body() dto: CreatePaymentDto, @CurrentUser() actor: RequestUser) {
    return this.payments.create(dto, actor);
  }
  @Get('payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_VIEW)
  list(@CurrentUser() actor: RequestUser) {
    return this.payments.list(actor);
  }
  @Get('payments/:id')
  @RequirePermissions(PERMISSIONS.PAYMENT_VIEW)
  find(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.payments.find(id, actor);
  }
  @Get('reservations/:id/payments')
  @RequirePermissions(PERMISSIONS.PAYMENT_VIEW)
  reservation(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.payments.forReservation(id, actor);
  }
  @Post('payments/:id/refunds')
  @RequirePermissions(PERMISSIONS.PAYMENT_REFUND)
  refund(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.payments.refund(id, dto, actor);
  }
}
