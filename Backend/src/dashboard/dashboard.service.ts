import { Injectable } from '@nestjs/common';
import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RequestUser } from '../auth/auth.types.js';
import { currentDateInTimeZone } from '../common/dates/stay-dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(actor: RequestUser) {
    const hotel = await this.prisma.hotel.findUniqueOrThrow({
      where: { id: actor.hotelId },
      select: { timezone: true, currencyCode: true },
    });
    const today = currentDateInTimeZone(hotel.timezone);
    const receivableAccount = await this.prisma.accountingSettings.findFirst({
      where: { hotelId: actor.hotelId },
      select: { defaultGuestReceivableAccountId: true },
    });
    const receivableAccountId = receivableAccount?.defaultGuestReceivableAccountId ?? null;
    const [
      rooms,
      currentGuests,
      arrivals,
      departures,
      payments,
      housekeeping,
      maintenance,
      byMethod,
      ledgerRevenue,
      ledgerExpense,
      ledgerOutstanding,
    ] = await Promise.all([
      this.prisma.room.groupBy({
        by: ['status'],
        where: { hotelId: actor.hotelId, isActive: true },
        _count: true,
      }),
      this.prisma.reservation.count({
        where: { hotelId: actor.hotelId, status: ReservationStatus.CHECKED_IN },
      }),
      this.prisma.reservation.count({
        where: {
          hotelId: actor.hotelId,
          checkInDate: new Date(`${today}T00:00:00.000Z`),
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        },
      }),
      this.prisma.reservation.count({
        where: {
          hotelId: actor.hotelId,
          checkOutDate: new Date(`${today}T00:00:00.000Z`),
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        },
      }),
      this.prisma.$queryRaw<
        Array<{ paid: string; refunded: string }>
      >`SELECT coalesce(sum("amount") FILTER (WHERE "kind"='PAYMENT'),0)::text paid, coalesce(sum("amount") FILTER (WHERE "kind"='REFUND'),0)::text refunded FROM "Payment" WHERE "hotelId"=${actor.hotelId}::uuid AND "status"=${PaymentStatus.COMPLETED}::"PaymentStatus" AND ("paidAt" AT TIME ZONE ${hotel.timezone})::date=${today}::date`,
      this.prisma.housekeepingTask.groupBy({
        by: ['status'],
        where: { hotelId: actor.hotelId, status: { not: 'COMPLETED' } },
        _count: true,
      }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['status'],
        where: {
          hotelId: actor.hotelId,
          status: { notIn: ['COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED'] },
        },
        _count: true,
      }),
      this.prisma.$queryRaw<
        Array<{ name: string; amount: string }>
      >`SELECT pm.name, coalesce(sum(CASE WHEN p.kind='PAYMENT' THEN p.amount ELSE -p.amount END),0)::text amount FROM "Payment" p JOIN "PaymentMethod" pm ON pm.id=p."paymentMethodId" WHERE p."hotelId"=${actor.hotelId}::uuid AND p.status='COMPLETED' AND (p."paidAt" AT TIME ZONE ${hotel.timezone})::date=${today}::date GROUP BY pm.id,pm.name ORDER BY pm.name`,
      this.prisma.$queryRaw<
        Array<{ amount: string }>
      >`SELECT coalesce(sum(jl.credit-jl.debit),0)::text amount FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id=jl."journalEntryId" JOIN "Account" a ON a.id=jl."accountId" WHERE je."hotelId"=${actor.hotelId}::uuid AND je.status='POSTED' AND je."businessDate"=${today}::date AND a.type='REVENUE'`,
      this.prisma.$queryRaw<
        Array<{ amount: string }>
      >`SELECT coalesce(sum(jl.debit-jl.credit),0)::text amount FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id=jl."journalEntryId" JOIN "Account" a ON a.id=jl."accountId" WHERE je."hotelId"=${actor.hotelId}::uuid AND je.status='POSTED' AND je."businessDate"=${today}::date AND a.type='EXPENSE'`,
      this.prisma.$queryRaw<
        Array<{ amount: string }>
      >`SELECT coalesce(sum(jl.debit-jl.credit),0)::text amount FROM "JournalLine" jl JOIN "JournalEntry" je ON je.id=jl."journalEntryId" WHERE je."hotelId"=${actor.hotelId}::uuid AND je.status IN ('POSTED','REVERSED') AND je."businessDate"<=${today}::date AND jl."accountId"=${receivableAccountId}::uuid`,
    ]);
    const paid = payments[0]?.paid ?? '0';
    const refunded = payments[0]?.refunded ?? '0';
    const revenue = new Prisma.Decimal(ledgerRevenue[0]?.amount ?? '0');
    const expense = new Prisma.Decimal(ledgerExpense[0]?.amount ?? '0');
    return {
      generatedAt: new Date().toISOString(),
      businessDate: today,
      timezone: hotel.timezone,
      currencyCode: hotel.currencyCode,
      rooms: {
        total: rooms.reduce((n, v) => n + v._count, 0),
        ...Object.fromEntries(rooms.map((v) => [v.status.toLowerCase(), v._count])),
      },
      guests: { current: currentGuests, arrivals, departures },
      financial: {
        payments: paid,
        refunds: refunded,
        revenue: revenue.toFixed(2),
        expenses: expense.toFixed(2),
        net: revenue.minus(expense).toFixed(2),
        outstanding: ledgerOutstanding[0]?.amount ?? '0',
        byPaymentMethod: byMethod,
      },
      operations: {
        housekeeping: Object.fromEntries(
          housekeeping.map((v) => [v.status.toLowerCase(), v._count]),
        ),
        maintenance: Object.fromEntries(maintenance.map((v) => [v.status.toLowerCase(), v._count])),
      },
    };
  }
}
