import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAnyPermission, RequirePermissions } from '../common/decorators/permissions.decorator.js';
import { PaymentMethodDto } from './dto/payment-method.dto.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@ApiTags('payment methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}
  @Get()
  @RequireAnyPermission(PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE)
  list(@CurrentUser() actor: RequestUser) {
    return this.methods.list(actor);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.PAYMENT_METHOD_MANAGE)
  create(@Body() dto: PaymentMethodDto, @CurrentUser() actor: RequestUser) {
    return this.methods.create(dto, actor);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PAYMENT_METHOD_MANAGE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PaymentMethodDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.methods.update(id, dto, actor);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PAYMENT_METHOD_MANAGE)
  deactivate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.methods.active(id, false, actor);
  }
  @Patch(':id/restore')
  @RequirePermissions(PERMISSIONS.PAYMENT_METHOD_MANAGE)
  restore(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.methods.active(id, true, actor);
  }
}
