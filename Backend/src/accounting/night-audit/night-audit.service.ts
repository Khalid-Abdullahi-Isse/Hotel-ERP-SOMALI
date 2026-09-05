import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { ChargeType } from '../../generated/prisma/enums.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import { runSerializable } from '../../common/database/serializable-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { GuestAccountingService } from '../guest-accounting.service.js';

type BusinessDateRow = {
  id: string;
  hotelId: string;
  businessDate: string;
  status: string;
  roomNights: number;
  totalRoomRevenue: string;
};

@Injectable()
export class NightAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
    private readonly guestAccounting: GuestAccountingService,
  ) {}

  async postBusinessDate(hotelId: string, businessDate: string, actor: RequestUser) {
    return runSerializable(this.prisma, (tx) => this.postBusinessDateInTransaction(tx, hotelId, businessDate, actor));
  }

  private async postBusinessDateInTransaction(
    tx: Prisma.TransactionClient,
    hotelId: string,
    businessDate: string,
    actor: RequestUser,
  ) {
      const current = await this.ensureBusinessDate(tx, hotelId, businessDate);
      if (current.status === 'POSTED') {
        return current;
      }

      const rows = await tx.reservationRoom.findMany({
        where: {
          reservation: {
            hotelId,
            status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
          },
          checkInDate: { lte: new Date(`${businessDate}T00:00:00.000Z`) },
          checkOutDate: { gt: new Date(`${businessDate}T00:00:00.000Z`) },
        },
        include: {
          room: { select: { id: true, roomNumber: true } },
          reservation: { select: { id: true, status: true } },
        },
      });

      for (const row of rows) {
        const nightlyRate = new Prisma.Decimal(row.nightlyRate ?? '0');
        const existingNight = await tx.reservationRoomNight.findUnique({
          where: {
            hotelId_reservationRoomId_businessDate: {
              hotelId,
              reservationRoomId: row.id,
              businessDate: new Date(`${businessDate}T00:00:00.000Z`),
            },
          },
        });

        if (existingNight) continue;

        const created = await tx.reservationRoomNight.create({
          data: {
            hotelId,
            reservationRoomId: row.id,
            businessDate: new Date(`${businessDate}T00:00:00.000Z`),
            nightlyRate,
            amount: nightlyRate,
          },
        });

        await this.guestAccounting.postCharge(
          {
            id: created.id,
            reservationId: row.reservationId,
            amount: nightlyRate,
            occurredAt: new Date(`${businessDate}T12:00:00.000Z`),
            description: `Room ${row.room.roomNumber} night ${businessDate}`,
            type: ChargeType.ROOM,
          },
          actor,
          tx,
        );
      }

      // Recompute totals from the full night set for this business date. This
      // makes posting idempotent and correct when a closed date is reopened and
      // re-posted (new nights are added, existing ones are never duplicated).
      const date = new Date(`${businessDate}T00:00:00.000Z`);
      const nightTotals = await tx.reservationRoomNight.aggregate({
        where: { hotelId, businessDate: date },
        _sum: { amount: true },
        _count: true,
      });
      const totalRevenue = nightTotals._sum.amount ?? new Prisma.Decimal(0);
      const roomNights = nightTotals._count ?? 0;

      const posted = await tx.hotelBusinessDate.update({
        where: { id: current.id },
        data: {
          status: 'POSTED',
          roomNights,
          totalRoomRevenue: totalRevenue,
        },
      });

      await this.audits.record(
        {
          hotelId,
          userId: actor.id,
          action: 'accounting.night_audit_posted',
          entityType: 'HotelBusinessDate',
          entityId: posted.id,
          newValue: {
            businessDate,
            roomNights: posted.roomNights,
            totalRoomRevenue: posted.totalRoomRevenue.toString(),
          },
        },
        tx,
      );

      return {
        id: posted.id,
        hotelId,
        businessDate,
        status: posted.status,
        roomNights: posted.roomNights,
        totalRoomRevenue: posted.totalRoomRevenue.toString(),
      } as BusinessDateRow & { totalRoomRevenue: string };
  }

  async advanceBusinessDate(hotelId: string, businessDate: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const previous = await tx.hotelBusinessDate.findFirst({
        where: {
          hotelId,
          businessDate: { lt: new Date(`${businessDate}T00:00:00.000Z`) },
        },
        orderBy: { businessDate: 'desc' },
      });

      if (previous && previous.status !== 'POSTED') {
        throw new ConflictException({
          code: 'PRIOR_BUSINESS_DATE_NOT_CLOSED',
          message: 'Resolve the previous business date before advancing to the next date.',
        });
      }

      const existing = await this.ensureBusinessDate(tx, hotelId, businessDate);
      if (existing.status === 'POSTED') return { ...existing, businessDate, status: existing.status };

      return this.postBusinessDateInTransaction(tx, hotelId, businessDate, actor);
    });
  }

  async reopen(hotelId: string, businessDate: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const target = new Date(`${businessDate}T00:00:00.000Z`);
      const row = await tx.hotelBusinessDate.findUnique({
        where: { hotelId_businessDate: { hotelId, businessDate: target } },
      });
      if (!row)
        throw new NotFoundException({
          code: 'BUSINESS_DATE_NOT_FOUND',
          message: 'The requested business date was not found.',
        });
      if (row.status !== 'POSTED')
        throw new ConflictException({
          code: 'BUSINESS_DATE_NOT_POSTED',
          message: 'Only a posted business date can be reopened.',
        });
      const later = await tx.hotelBusinessDate.findFirst({
        where: { hotelId, businessDate: { gt: target } },
        select: { businessDate: true },
      });
      if (later)
        throw new ConflictException({
          code: 'LATER_BUSINESS_DATE_EXISTS',
          message: 'Reopen the most recent posted business date before earlier dates.',
        });
      const updated = await tx.hotelBusinessDate.update({
        where: { id: row.id },
        data: { status: 'OPEN' },
      });
      await this.audits.record(
        {
          hotelId,
          userId: actor.id,
          action: 'accounting.night_audit_reopened',
          entityType: 'HotelBusinessDate',
          entityId: updated.id,
          oldValue: { status: 'POSTED' },
          newValue: { status: 'OPEN', businessDate },
        },
        tx,
      );
      return {
        id: updated.id,
        hotelId,
        businessDate: updated.businessDate.toISOString().slice(0, 10),
        status: updated.status,
        roomNights: updated.roomNights,
        totalRoomRevenue: updated.totalRoomRevenue.toString(),
      };
    });
  }

  async getBusinessDate(hotelId: string, businessDate: string) {
    const row = await this.prisma.hotelBusinessDate.findUnique({
      where: { hotelId_businessDate: { hotelId, businessDate: new Date(`${businessDate}T00:00:00.000Z`) } },
    });

    if (!row) throw new NotFoundException({ code: 'BUSINESS_DATE_NOT_FOUND', message: 'The requested business date was not found.' });

    return {
      id: row.id,
      hotelId: row.hotelId,
      businessDate: row.businessDate.toISOString().slice(0, 10),
      status: row.status,
      roomNights: row.roomNights,
      totalRoomRevenue: row.totalRoomRevenue.toString(),
    };
  }

  private async ensureBusinessDate(
    tx: Pick<Prisma.TransactionClient, 'hotelBusinessDate'>,
    hotelId: string,
    businessDate: string,
  ) {
    const target = new Date(`${businessDate}T00:00:00.000Z`);
    const existing = await tx.hotelBusinessDate.findUnique({
      where: { hotelId_businessDate: { hotelId, businessDate: target } },
    });

    if (existing) return existing;

    return tx.hotelBusinessDate.create({
      data: {
        hotelId,
        businessDate: target,
        status: 'OPEN',
        roomNights: 0,
        totalRoomRevenue: new Prisma.Decimal(0),
      },
    });
  }
}