import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  InvoiceStatus,
  PaymentKind,
  PaymentStatus,
  ReservationStatus,
} from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { ChargesService } from '../charges/charges.service.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import type { RefundPaymentDto } from './dto/refund-payment.dto.js';

const PAYMENT_INCLUDE = {
  hotel: { select: { currencyCode: true } },
  paymentMethod: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  guest: { select: { id: true, fullName: true } },
  reservation: { select: { id: true, bookingNumber: true } },
  originalPayment: { select: { id: true, amount: true } },
} as const;
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ChargesService,
    private readonly audits: AuditLogsService,
  ) {}
  create(dto: CreatePaymentDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      await this.lockReservation(tx, dto.reservationId, actor.hotelId);
      const existing = await tx.payment.findFirst({
        where: { hotelId: actor.hotelId, requestKey: dto.requestKey },
        include: PAYMENT_INCLUDE,
      });
      if (existing) {
        if (
          existing.kind !== PaymentKind.PAYMENT ||
          existing.reservationId !== dto.reservationId ||
          existing.paymentMethodId !== dto.paymentMethodId ||
          !existing.amount.eq(dto.amount)
        )
          this.idempotencyConflict();
        return {
          idempotentReplay: true,
          payment: this.view(existing),
          summary: await this.summary(dto.reservationId, tx),
        };
      }
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id: dto.reservationId },
        select: { status: true, guestId: true, invoice: { select: { id: true, status: true } } },
      });
      if (
        [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW].includes(
          reservation.status as never,
        )
      )
        throw new ConflictException({
          code: 'PAYMENT_NOT_ALLOWED',
          message: 'Payments cannot be posted to a cancelled or no-show reservation.',
        });
      const method = await tx.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, hotelId: actor.hotelId, isActive: true },
      });
      if (!method)
        throw new ConflictException({
          code: 'PAYMENT_METHOD_NOT_AVAILABLE',
          message: 'Payment method is inactive or invalid.',
        });
      const amount = new Prisma.Decimal(dto.amount);
      const folio = await this.charges.buildFolio(dto.reservationId, tx);
      const financial = await this.summary(dto.reservationId, tx, folio.total);
      if (amount.gt(financial.outstandingAmount))
        throw new ConflictException({
          code: 'PAYMENT_EXCEEDS_OUTSTANDING',
          message: 'Payment cannot exceed the outstanding balance.',
          details: financial,
        });
      const payment = await tx.payment.create({
        data: {
          hotelId: actor.hotelId,
          reservationId: dto.reservationId,
          invoiceId: reservation.invoice?.id,
          guestId: reservation.guestId,
          paymentMethodId: method.id,
          createdById: actor.id,
          requestKey: dto.requestKey,
          amount,
          reference: dto.reference?.trim(),
          note: dto.note?.trim(),
        },
        include: PAYMENT_INCLUDE,
      });
      await this.syncInvoice(dto.reservationId, tx);
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'payment.create',
          entityType: 'Payment',
          entityId: payment.id,
          newValue: this.json(this.view(payment)),
        },
        tx,
      );
      return {
        idempotentReplay: false,
        payment: this.view(payment),
        summary: await this.summary(dto.reservationId, tx, folio.total),
      };
    });
  }
  async list(actor: RequestUser) {
    const values = await this.prisma.payment.findMany({
      where: { hotelId: actor.hotelId },
      include: PAYMENT_INCLUDE,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
    return values.map((value) => this.view(value));
  }
  refund(id: string, dto: RefundPaymentDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ reservationId: string }>
      >`SELECT "reservationId" FROM "Payment" WHERE "id"=${id}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE`;
      if (locked.length !== 1 || !locked[0].reservationId) this.notFound();
      const original = await tx.payment.findUniqueOrThrow({
        where: { id },
        include: PAYMENT_INCLUDE,
      });
      if (original.kind !== PaymentKind.PAYMENT || original.status !== PaymentStatus.COMPLETED)
        throw new ConflictException({
          code: 'PAYMENT_NOT_REFUNDABLE',
          message: 'Only a completed original payment can be refunded.',
        });
      const existing = await tx.payment.findFirst({
        where: { hotelId: actor.hotelId, requestKey: dto.requestKey },
        include: PAYMENT_INCLUDE,
      });
      if (existing) {
        if (
          existing.kind !== PaymentKind.REFUND ||
          existing.originalPaymentId !== id ||
          !existing.amount.eq(dto.amount)
        )
          this.idempotencyConflict();
        return {
          idempotentReplay: true,
          refund: this.view(existing),
          summary: await this.summary(original.reservationId!, tx),
        };
      }
      const refunded = await tx.payment.aggregate({
        where: { originalPaymentId: id, kind: PaymentKind.REFUND, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.plus(refunded._sum.amount ?? 0).gt(original.amount))
        throw new ConflictException({
          code: 'REFUND_EXCEEDS_PAYMENT',
          message: 'Refund total cannot exceed the original payment.',
        });
      const refund = await tx.payment.create({
        data: {
          hotelId: actor.hotelId,
          reservationId: original.reservationId,
          invoiceId: original.invoiceId,
          guestId: original.guestId,
          paymentMethodId: original.paymentMethodId,
          createdById: actor.id,
          requestKey: dto.requestKey,
          kind: PaymentKind.REFUND,
          amount,
          originalPaymentId: id,
          reference: dto.reference?.trim(),
          note: dto.reason.trim(),
        },
        include: PAYMENT_INCLUDE,
      });
      await this.syncInvoice(original.reservationId!, tx);
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'payment.refund',
          entityType: 'Payment',
          entityId: refund.id,
          oldValue: { originalPaymentId: id, originalAmount: original.amount.toString() },
          newValue: this.json(this.view(refund)),
        },
        tx,
      );
      return {
        idempotentReplay: false,
        refund: this.view(refund),
        summary: await this.summary(original.reservationId!, tx),
      };
    });
  }
  async find(id: string, actor: RequestUser) {
    const value = await this.prisma.payment.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: PAYMENT_INCLUDE,
    });
    if (!value) this.notFound();
    return this.view(value);
  }
  async forReservation(id: string, actor: RequestUser) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, hotelId: actor.hotelId },
      select: { id: true },
    });
    if (!reservation)
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation was not found.',
      });
    const data = await this.prisma.payment.findMany({
      where: { reservationId: id },
      include: PAYMENT_INCLUDE,
      orderBy: { paidAt: 'asc' },
    });
    return { data: data.map((v) => this.view(v)), summary: await this.summary(id, this.prisma) };
  }
  async summary(
    reservationId: string,
    db: Prisma.TransactionClient | PrismaService,
    knownTotal?: string,
  ) {
    const folioTotal = knownTotal ?? (await this.charges.buildFolio(reservationId, db)).total;
    const grouped = await db.payment.groupBy({
      by: ['kind'],
      where: { reservationId, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const paid =
      grouped.find((v) => v.kind === PaymentKind.PAYMENT)?._sum.amount ?? new Prisma.Decimal(0);
    const refunded =
      grouped.find((v) => v.kind === PaymentKind.REFUND)?._sum.amount ?? new Prisma.Decimal(0);
    const net = paid.minus(refunded);
    const total = new Prisma.Decimal(folioTotal);
    const outstanding = Prisma.Decimal.max(total.minus(net), 0);
    return {
      totalAmount: total.toString(),
      paidAmount: paid.toString(),
      refundedAmount: refunded.toString(),
      netPaidAmount: net.toString(),
      outstandingAmount: outstanding.toString(),
    };
  }
  async syncInvoice(reservationId: string, tx: Prisma.TransactionClient) {
    const invoice = await tx.invoice.findUnique({ where: { reservationId } });
    if (
      !invoice ||
      invoice.status === InvoiceStatus.VOIDED ||
      invoice.status === InvoiceStatus.DRAFT
    )
      return;
    const financial = await this.summary(reservationId, tx, invoice.totalAmount.toString());
    const net = new Prisma.Decimal(financial.netPaidAmount);
    const status = net.gte(invoice.totalAmount)
      ? InvoiceStatus.PAID
      : net.gt(0)
        ? InvoiceStatus.PARTIALLY_PAID
        : InvoiceStatus.ISSUED;
    if (status !== invoice.status)
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
  }
  private async lockReservation(tx: Prisma.TransactionClient, id: string, hotelId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Reservation" WHERE "id"=${id}::uuid AND "hotelId"=${hotelId}::uuid FOR UPDATE`;
    if (rows.length !== 1)
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation was not found.',
      });
  }
  private view<
    T extends {
      amount: Prisma.Decimal;
      originalPayment?: { id: string; amount: Prisma.Decimal } | null;
    },
  >(v: T) {
    return {
      ...v,
      amount: v.amount.toString(),
      ...(v.originalPayment && 'amount' in v.originalPayment
        ? { originalPayment: { ...v.originalPayment, amount: v.originalPayment.amount.toString() } }
        : {}),
    };
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment was not found.' });
  }
  private idempotencyConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'This request key was already used for a different financial request.',
    });
  }
  private json(v: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject;
  }
}
