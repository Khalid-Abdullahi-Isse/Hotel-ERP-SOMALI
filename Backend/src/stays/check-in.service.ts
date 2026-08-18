import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus, RoomStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { currentDateInTimeZone } from '../common/dates/stay-dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CHECK_IN_INCLUDE = {
  guest: { select: { id: true, fullName: true, phone: true } },
  rooms: {
    include: { room: { select: { id: true, roomNumber: true, status: true } } },
    orderBy: { room: { roomNumber: 'asc' } },
  },
} as const;

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  checkIn(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Reservation"
        WHERE "id" = ${id}::uuid AND "hotelId" = ${actor.hotelId}::uuid
        FOR UPDATE
      `;
      if (locked.length !== 1) this.notFound();

      const reservation = await transaction.reservation.findUniqueOrThrow({
        where: { id },
        include: CHECK_IN_INCLUDE,
      });
      if (reservation.status === ReservationStatus.CHECKED_IN) {
        return { alreadyCompleted: true, reservation: this.view(reservation) };
      }
      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'RESERVATION_NOT_READY_FOR_CHECK_IN',
          message: 'Only a confirmed reservation can be checked in.',
        });
      }

      const hotel = await transaction.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { timezone: true },
      });
      const today = currentDateInTimeZone(hotel.timezone);
      const arrival = reservation.checkInDate.toISOString().slice(0, 10);
      const departure = reservation.checkOutDate.toISOString().slice(0, 10);
      if (today < arrival || today >= departure) {
        throw new ConflictException({
          code: 'CHECK_IN_OUTSIDE_STAY_DATES',
          message: 'Check-in is only allowed from the arrival date until before checkout.',
          details: { hotelDate: today, checkInDate: arrival, checkOutDate: departure },
        });
      }

      const rooms = await this.availability.lockAndValidateRooms(
        transaction,
        actor.hotelId,
        reservation.rooms.map((entry) => entry.roomId),
        reservation.checkInDate,
        reservation.checkOutDate,
        reservation.id,
      );
      if (rooms.some((room) => room.status !== RoomStatus.AVAILABLE)) {
        throw new ConflictException({
          code: 'ROOM_NOT_READY_FOR_CHECK_IN',
          message: 'Every reserved room must be available before check-in.',
        });
      }

      const checkedInAt = new Date();
      await transaction.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CHECKED_IN, checkedInAt },
      });
      await transaction.room.updateMany({
        where: { id: { in: rooms.map((room) => room.id) }, hotelId: actor.hotelId },
        data: { status: RoomStatus.OCCUPIED },
      });
      await transaction.reservationHistory.create({
        data: {
          reservationId: id,
          fromStatus: ReservationStatus.CONFIRMED,
          toStatus: ReservationStatus.CHECKED_IN,
          note: 'Guest checked in.',
          changedById: actor.id,
        },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'reservation.check_in',
          entityType: 'Reservation',
          entityId: id,
          oldValue: { status: ReservationStatus.CONFIRMED },
          newValue: {
            status: ReservationStatus.CHECKED_IN,
            checkedInAt: checkedInAt.toISOString(),
            roomIds: rooms.map((room) => room.id),
          },
        },
        transaction,
      );
      const updated = await transaction.reservation.findUniqueOrThrow({
        where: { id },
        include: CHECK_IN_INCLUDE,
      });
      return { alreadyCompleted: false, reservation: this.view(updated) };
    });
  }

  private view<T extends { checkInDate: Date; checkOutDate: Date }>(reservation: T) {
    return {
      ...reservation,
      checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
      checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
    };
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation was not found.',
    });
  }
}
