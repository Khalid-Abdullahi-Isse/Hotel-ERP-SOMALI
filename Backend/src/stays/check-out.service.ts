import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ReservationStatus, RoomStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { ChargesService } from '../charges/charges.service.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CHECK_OUT_INCLUDE = {
  rooms: {
    include: { room: { select: { id: true, roomNumber: true, status: true, isActive: true } } },
    orderBy: { room: { roomNumber: 'asc' } },
  },
} as const;

@Injectable()
export class CheckOutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charges: ChargesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  checkOut(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (transaction) => {
      const lockedReservation = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Reservation"
        WHERE "id" = ${id}::uuid AND "hotelId" = ${actor.hotelId}::uuid
        FOR UPDATE
      `;
      if (lockedReservation.length !== 1) this.notFound();
      const reservation = await transaction.reservation.findUniqueOrThrow({
        where: { id },
        include: CHECK_OUT_INCLUDE,
      });
      if (reservation.status === ReservationStatus.CHECKED_OUT) {
        return {
          alreadyCompleted: true,
          folio: await this.charges.buildFolio(id, transaction),
        };
      }
      if (reservation.status !== ReservationStatus.CHECKED_IN) {
        throw new ConflictException({
          code: 'RESERVATION_NOT_READY_FOR_CHECK_OUT',
          message: 'Only a checked-in reservation can be checked out.',
        });
      }

      const sortedRoomIds = reservation.rooms.map((entry) => entry.roomId).sort();
      for (const roomId of sortedRoomIds) {
        const lockedRoom = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Room"
          WHERE "id" = ${roomId}::uuid AND "hotelId" = ${actor.hotelId}::uuid
          FOR UPDATE
        `;
        if (lockedRoom.length !== 1) this.roomStateConflict();
      }
      const roomStates = await transaction.room.findMany({
        where: { id: { in: sortedRoomIds }, hotelId: actor.hotelId },
        select: { id: true, status: true, isActive: true },
      });
      if (
        roomStates.length !== sortedRoomIds.length ||
        roomStates.some((room) => !room.isActive || room.status !== RoomStatus.OCCUPIED)
      ) {
        this.roomStateConflict();
      }

      await this.charges.createRoomCharges(transaction, id);
      const provisionalFolio = await this.charges.buildFolio(id, transaction);
      if (new Prisma.Decimal(provisionalFolio.total).isNegative()) {
        throw new ConflictException({
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: 'Reduce the reservation discount before checkout.',
        });
      }

      const checkedOutAt = new Date();
      await transaction.reservation.update({
        where: { id },
        data: { status: ReservationStatus.CHECKED_OUT, checkedOutAt },
      });
      await transaction.room.updateMany({
        where: { id: { in: sortedRoomIds }, hotelId: actor.hotelId },
        data: { status: RoomStatus.DIRTY },
      });
      await transaction.housekeepingTask.createMany({
        data: sortedRoomIds.map((roomId) => ({
          hotelId: actor.hotelId,
          roomId,
          reservationId: id,
          status: 'DIRTY',
          notes: 'Automatically created at checkout.',
        })),
      });
      await transaction.reservationHistory.create({
        data: {
          reservationId: id,
          fromStatus: ReservationStatus.CHECKED_IN,
          toStatus: ReservationStatus.CHECKED_OUT,
          note: 'Guest checked out; rooms require housekeeping.',
          changedById: actor.id,
        },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'reservation.check_out',
          entityType: 'Reservation',
          entityId: id,
          oldValue: { status: ReservationStatus.CHECKED_IN },
          newValue: {
            status: ReservationStatus.CHECKED_OUT,
            checkedOutAt: checkedOutAt.toISOString(),
            roomIds: sortedRoomIds,
            total: provisionalFolio.total,
          },
        },
        transaction,
      );
      return {
        alreadyCompleted: false,
        folio: await this.charges.buildFolio(id, transaction),
      };
    });
  }

  private roomStateConflict(): never {
    throw new ConflictException({
      code: 'ROOM_STATE_CONFLICT',
      message: 'Every stay room must be occupied and active before checkout.',
    });
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation was not found.',
    });
  }
}
