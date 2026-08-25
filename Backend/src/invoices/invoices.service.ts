import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { InvoiceStatus, PaymentKind, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
const INCLUDE = {
  reservation: {
    select: { id: true, bookingNumber: true, guest: { select: { id: true, fullName: true } } },
  },
  items: { orderBy: { createdAt: 'asc' } },
  issuedBy: { select: { id: true, fullName: true } },
  voidedBy: { select: { id: true, fullName: true } },
} as const;
const LIST_INCLUDE = {
  hotel: { select: { currencyCode: true } },
  reservation: {
    select: { id: true, bookingNumber: true, guest: { select: { id: true, fullName: true } } },
  },
} as const;
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audits: AuditLogsService,
  ) {}
  create(reservationId: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Reservation" WHERE "id"=${reservationId}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE`;
      if (locked.length !== 1) this.reservationNotFound();
      const existing = await tx.invoice.findUnique({ where: { reservationId }, include: INCLUDE });
      if (existing) return { idempotentReplay: true, invoice: await this.view(existing, tx) };
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { charges: { where: { voidedAt: null }, orderBy: { chargeDate: 'asc' } } },
      });
      if (reservation.status !== ReservationStatus.CHECKED_OUT)
        throw new ConflictException({
          code: 'INVOICE_REQUIRES_CHECKOUT',
          message: 'Invoice can only be issued after checkout.',
        });
      if (reservation.charges.length === 0)
        throw new ConflictException({
          code: 'INVOICE_HAS_NO_CHARGES',
          message: 'Reservation has no posted charges.',
        });
      const subtotal = reservation.charges.reduce(
        (sum, charge) => sum.plus(charge.totalAmount),
        new Prisma.Decimal(0),
      );
      if (reservation.discountAmount.gt(subtotal))
        throw new ConflictException({
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: 'Invoice discount exceeds its charges.',
        });
      const invoice = await tx.invoice.create({
        data: {
          hotelId: actor.hotelId,
          reservationId,
          invoiceNumber: this.number(),
          subtotal,
          discountAmount: reservation.discountAmount,
          totalAmount: subtotal.minus(reservation.discountAmount),
        },
      });
      await tx.invoiceItem.createMany({
        data: reservation.charges.map((charge) => ({
          invoiceId: invoice.id,
          chargeId: charge.id,
          description: charge.description,
          quantity: charge.quantity,
          unitPrice: charge.unitPrice,
          amount: charge.totalAmount,
        })),
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.ISSUED, issuedAt: new Date(), issuedById: actor.id },
      });
      await this.payments.syncInvoice(reservationId, tx);
      const issued = await tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'invoice.issue',
          entityType: 'Invoice',
          entityId: invoice.id,
          newValue: {
            invoiceNumber: issued.invoiceNumber,
            reservationId,
            subtotal: subtotal.toString(),
            discountAmount: issued.discountAmount.toString(),
            totalAmount: issued.totalAmount.toString(),
          },
        },
        tx,
      );
      return { idempotentReplay: false, invoice: await this.view(issued, tx) };
    });
  }
  async list(query: ListInvoicesQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.InvoiceWhereInput = {
      hotelId: actor.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { reservation: { bookingNumber: { contains: search, mode: 'insensitive' } } },
              { reservation: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [values, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const reservationIds = values.map((value) => value.reservationId);
    const paymentTotals = reservationIds.length
      ? await this.prisma.payment.groupBy({
          by: ['reservationId', 'kind'],
          where: { reservationId: { in: reservationIds }, status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        })
      : [];
    const totals = new Map(
      paymentTotals.map((entry) => [
        `${entry.reservationId}:${entry.kind}`,
        entry._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );
    return paginatedResponse(
      values.map((value) => {
        const paid = totals.get(`${value.reservationId}:${PaymentKind.PAYMENT}`) ?? new Prisma.Decimal(0);
        const refunded = totals.get(`${value.reservationId}:${PaymentKind.REFUND}`) ?? new Prisma.Decimal(0);
        const netPaid = paid.minus(refunded);
        return {
          ...value,
          subtotal: value.subtotal.toString(),
          discountAmount: value.discountAmount.toString(),
          totalAmount: value.totalAmount.toString(),
          paidAmount: paid.toString(),
          refundedAmount: refunded.toString(),
          netPaidAmount: netPaid.toString(),
          outstandingAmount: Prisma.Decimal.max(value.totalAmount.minus(netPaid), 0).toString(),
        };
      }),
      query.page,
      query.limit,
      total,
    );
  }
  async find(id: string, actor: RequestUser) {
    const value = await this.prisma.invoice.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: INCLUDE,
    });
    if (!value) this.notFound();
    return this.view(value, this.prisma);
  }
  void(id: string, reason: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Invoice" WHERE "id"=${id}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE`;
      if (locked.length !== 1) this.notFound();
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id } });
      if (invoice.status === InvoiceStatus.VOIDED)
        return this.view(
          await tx.invoice.findUniqueOrThrow({ where: { id }, include: INCLUDE }),
          tx,
        );
      const summary = await this.payments.summary(
        invoice.reservationId,
        tx,
        invoice.totalAmount.toString(),
      );
      if (!new Prisma.Decimal(summary.netPaidAmount).isZero())
        throw new ConflictException({
          code: 'PAID_INVOICE_CANNOT_BE_VOIDED',
          message: 'Refund all reservation payments before voiding this invoice.',
        });
      await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.VOIDED,
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: reason.trim(),
        },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'invoice.void',
          entityType: 'Invoice',
          entityId: id,
          oldValue: { status: invoice.status },
          newValue: { status: InvoiceStatus.VOIDED, reason: reason.trim() },
        },
        tx,
      );
      return this.view(await tx.invoice.findUniqueOrThrow({ where: { id }, include: INCLUDE }), tx);
    });
  }
  private async view<
    T extends {
      reservationId: string;
      subtotal: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      items: Array<{ quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; amount: Prisma.Decimal }>;
    },
  >(invoice: T, db: Prisma.TransactionClient | PrismaService) {
    const summary = await this.payments.summary(
      invoice.reservationId,
      db,
      invoice.totalAmount.toString(),
    );
    return {
      ...invoice,
      ...summary,
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      items: invoice.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        amount: item.amount.toString(),
      })),
    };
  }
  private number() {
    return `INV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice was not found.' });
  }
  private reservationNotFound(): never {
    throw new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation was not found.',
    });
  }
}
