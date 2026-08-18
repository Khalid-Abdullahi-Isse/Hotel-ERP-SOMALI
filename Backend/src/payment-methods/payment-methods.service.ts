import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaymentMethodDto } from './dto/payment-method.dto.js';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}
  async list(actor: RequestUser) {
    const manage = actor.permissions.includes(PERMISSIONS.PAYMENT_METHOD_MANAGE);
    return this.prisma.paymentMethod.findMany({
      where: { hotelId: actor.hotelId, ...(manage ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }
  create(dto: PaymentMethodDto, actor: RequestUser) {
    return this.change(undefined, dto, undefined, actor);
  }
  update(id: string, dto: PaymentMethodDto, actor: RequestUser) {
    return this.change(id, dto, undefined, actor);
  }
  active(id: string, isActive: boolean, actor: RequestUser) {
    return this.change(id, undefined, isActive, actor);
  }
  private async change(
    id: string | undefined,
    dto: PaymentMethodDto | undefined,
    isActive: boolean | undefined,
    actor: RequestUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = id
        ? await tx.paymentMethod.findFirst({ where: { id, hotelId: actor.hotelId } })
        : undefined;
      if (id && !before) this.notFound();
      const method = id
        ? await tx.paymentMethod.update({
            where: { id },
            data: { ...dto, ...(isActive === undefined ? {} : { isActive }) },
          })
        : await tx.paymentMethod.create({ data: { hotelId: actor.hotelId, ...dto! } });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: !id
            ? 'payment_method.create'
            : isActive === false
              ? 'payment_method.deactivate'
              : isActive === true
                ? 'payment_method.restore'
                : 'payment_method.update',
          entityType: 'PaymentMethod',
          entityId: method.id,
          ...(before ? { oldValue: this.json(before) } : {}),
          newValue: this.json(method),
        },
        tx,
      );
      return method;
    });
  }
  private notFound(): never {
    throw new NotFoundException({
      code: 'PAYMENT_METHOD_NOT_FOUND',
      message: 'Payment method was not found.',
    });
  }
  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
