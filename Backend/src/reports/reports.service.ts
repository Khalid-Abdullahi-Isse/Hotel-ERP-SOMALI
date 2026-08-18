import { Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types.js';
import { parseStayDates } from '../common/dates/stay-dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReportQueryDto } from './dto/report-query.dto.js';
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}
  private dates(q: ReportQueryDto) {
    parseStayDates(q.from, q.to);
    return { from: new Date(`${q.from}T00:00:00.000Z`), to: new Date(`${q.to}T00:00:00.000Z`) };
  }
  async revenue(q: ReportQueryDto, a: RequestUser) {
    this.dates(q);
    const h = await this.hotel(a);
    const data = await this.prisma.$queryRaw<
      Array<{ date: string; payments: string; refunds: string; revenue: string }>
    >`SELECT ("paidAt" AT TIME ZONE ${h.timezone})::date::text date,coalesce(sum("amount") FILTER(WHERE kind='PAYMENT'),0)::text payments,coalesce(sum("amount") FILTER(WHERE kind='REFUND'),0)::text refunds,coalesce(sum(CASE WHEN kind='PAYMENT' THEN "amount" ELSE -"amount" END),0)::text revenue FROM "Payment" WHERE "hotelId"=${a.hotelId}::uuid AND status='COMPLETED' AND ("paidAt" AT TIME ZONE ${h.timezone})::date>=${q.from}::date AND ("paidAt" AT TIME ZONE ${h.timezone})::date<${q.to}::date GROUP BY 1 ORDER BY 1`;
    return this.wrap(q, h, data);
  }
  async expenses(q: ReportQueryDto, a: RequestUser) {
    const d = this.dates(q),
      h = await this.hotel(a);
    const data = await this.prisma.expense.groupBy({
      by: ['expenseDate'],
      where: { hotelId: a.hotelId, reversedAt: null, expenseDate: { gte: d.from, lt: d.to } },
      _sum: { amount: true },
      _count: true,
      orderBy: { expenseDate: 'asc' },
    });
    return this.wrap(
      q,
      h,
      data.map((v) => ({
        date: v.expenseDate.toISOString().slice(0, 10),
        amount: v._sum.amount?.toString() ?? '0',
        count: v._count,
      })),
    );
  }
  async occupancy(q: ReportQueryDto, a: RequestUser) {
    this.dates(q);
    const h = await this.hotel(a);
    const data = await this.prisma.$queryRaw<
      Array<{ date: string; occupiedRooms: number; totalRooms: number; occupancyRate: string }>
    >`WITH days AS (SELECT generate_series(${q.from}::date,${q.to}::date-1,interval '1 day')::date d), totals AS (SELECT count(*)::int n FROM "Room" WHERE "hotelId"=${a.hotelId}::uuid AND "isActive"=true) SELECT days.d::text date,(count(DISTINCT rr."roomId") FILTER (WHERE r.id IS NOT NULL))::int "occupiedRooms",totals.n "totalRooms",CASE WHEN totals.n=0 THEN '0.00' ELSE round((count(DISTINCT rr."roomId") FILTER (WHERE r.id IS NOT NULL))*100.0/totals.n,2)::text END "occupancyRate" FROM days CROSS JOIN totals LEFT JOIN "ReservationRoom" rr ON rr."checkInDate"<=days.d AND rr."checkOutDate">days.d AND rr."bookingStatus" IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT') LEFT JOIN "Reservation" r ON r.id=rr."reservationId" AND r."hotelId"=${a.hotelId}::uuid GROUP BY days.d,totals.n ORDER BY days.d`;
    return this.wrap(q, h, data);
  }
  async reservations(q: ReportQueryDto, a: RequestUser) {
    const d = this.dates(q),
      h = await this.hotel(a);
    const data = await this.prisma.reservation.groupBy({
      by: ['status'],
      where: { hotelId: a.hotelId, checkInDate: { gte: d.from, lt: d.to } },
      _count: true,
    });
    return this.wrap(
      q,
      h,
      data.map((v) => ({ status: v.status, count: v._count })),
    );
  }
  async payments(q: ReportQueryDto, a: RequestUser) {
    this.dates(q);
    const h = await this.hotel(a);
    const data = await this.prisma.$queryRaw<
      Array<{ method: string; kind: string; amount: string; count: number }>
    >`SELECT pm.name method,p.kind::text kind,sum(p.amount)::text amount,count(*)::int count FROM "Payment" p JOIN "PaymentMethod" pm ON pm.id=p."paymentMethodId" WHERE p."hotelId"=${a.hotelId}::uuid AND p.status='COMPLETED' AND (p."paidAt" AT TIME ZONE ${h.timezone})::date>=${q.from}::date AND (p."paidAt" AT TIME ZONE ${h.timezone})::date<${q.to}::date GROUP BY pm.name,p.kind ORDER BY pm.name,p.kind`;
    return this.wrap(q, h, data);
  }
  async outstanding(a: RequestUser) {
    const h = await this.hotel(a);
    const data = await this.prisma.$queryRaw<
      Array<{
        invoiceId: string;
        invoiceNumber: string;
        bookingNumber: string;
        guestName: string;
        totalAmount: string;
        netPaid: string;
        outstandingAmount: string;
      }>
    >`SELECT i.id "invoiceId",i."invoiceNumber",r."bookingNumber",g."fullName" "guestName",i."totalAmount"::text "totalAmount",coalesce(p.net,0)::text "netPaid",greatest(i."totalAmount"-coalesce(p.net,0),0)::text "outstandingAmount" FROM "Invoice" i JOIN "Reservation" r ON r.id=i."reservationId" JOIN "Guest" g ON g.id=r."guestId" LEFT JOIN (SELECT "reservationId",sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END) net FROM "Payment" WHERE status='COMPLETED' GROUP BY "reservationId")p ON p."reservationId"=r.id WHERE i."hotelId"=${a.hotelId}::uuid AND i.status<>'VOIDED' AND i."totalAmount">coalesce(p.net,0) ORDER BY i."issuedAt"`;
    return { generatedAt: new Date().toISOString(), currencyCode: h.currencyCode, data };
  }
  private hotel(a: RequestUser) {
    return this.prisma.hotel.findUniqueOrThrow({
      where: { id: a.hotelId },
      select: { timezone: true, currencyCode: true },
    });
  }
  private wrap(q: ReportQueryDto, h: { timezone: string; currencyCode: string }, data: unknown) {
    return {
      generatedAt: new Date().toISOString(),
      from: q.from,
      toExclusive: q.to,
      timezone: h.timezone,
      currencyCode: h.currencyCode,
      data,
    };
  }
}
