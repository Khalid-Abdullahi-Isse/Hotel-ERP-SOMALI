import { Injectable } from '@nestjs/common';
import { PaymentKind, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
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
    const [
      rooms,
      currentGuests,
      arrivals,
      departures,
      payments,
      expenses,
      outstanding,
      housekeeping,
      maintenance,
      byMethod,
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
      this.prisma.expense.aggregate({
        where: {
          hotelId: actor.hotelId,
          expenseDate: new Date(`${today}T00:00:00.000Z`),
          reversedAt: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<
        Array<{ amount: string }>
      >`SELECT coalesce(sum(greatest(i."totalAmount" - coalesce(p.net,0),0)),0)::text amount FROM "Invoice" i LEFT JOIN (SELECT "reservationId", sum(CASE WHEN "kind"=${PaymentKind.PAYMENT}::"PaymentKind" THEN "amount" ELSE -"amount" END) net FROM "Payment" WHERE "status"=${PaymentStatus.COMPLETED}::"PaymentStatus" GROUP BY "reservationId") p ON p."reservationId"=i."reservationId" WHERE i."hotelId"=${actor.hotelId}::uuid AND i."status"<>'VOIDED'`,
      this.prisma.housekeepingTask.groupBy({
        by: ['status'],
        where: { hotelId: actor.hotelId, status: { not: 'COMPLETED' } },
        _count: true,
      }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['status'],
        where: { hotelId: actor.hotelId, status: { not: 'DONE' } },
        _count: true,
      }),
      this.prisma.$queryRaw<
        Array<{ name: string; amount: string }>
      >`SELECT pm.name, coalesce(sum(CASE WHEN p.kind='PAYMENT' THEN p.amount ELSE -p.amount END),0)::text amount FROM "Payment" p JOIN "PaymentMethod" pm ON pm.id=p."paymentMethodId" WHERE p."hotelId"=${actor.hotelId}::uuid AND p.status='COMPLETED' AND (p."paidAt" AT TIME ZONE ${hotel.timezone})::date=${today}::date GROUP BY pm.id,pm.name ORDER BY pm.name`,
    ]);
    const paid = payments[0]?.paid ?? '0';
    const refunded = payments[0]?.refunded ?? '0';
    const revenue = new Prisma.Decimal(paid).minus(refunded);
    const expense = expenses._sum.amount?.toString() ?? '0';
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
        expenses: expense,
        net: revenue.minus(expense).toFixed(2),
        outstanding: outstanding[0]?.amount ?? '0',
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
