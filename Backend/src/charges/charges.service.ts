import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ChargeType, ReservationStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import type { PaginationQueryDto } from '../common/pagination/pagination-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddServiceChargeDto } from './dto/add-service-charge.dto.js';
import type { VoidChargeDto } from './dto/void-charge.dto.js';

const FOLIO_INCLUDE = {
  guest: { select: { id: true, fullName: true } },
  rooms: {
    include: {
      room: { select: { id: true, roomNumber: true } },
      roomCharge: true,
    },
    orderBy: { room: { roomNumber: 'asc' } },
  },
  charges: {
    include: {
      service: { select: { id: true, name: true } },
      voidedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { chargeDate: 'asc' },
  },
} as const;

type FolioRecord = Prisma.ReservationGetPayload<{ include: typeof FOLIO_INCLUDE }>;

@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  addServiceCharge(reservationId: string, dto: AddServiceChargeDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (transaction) => {
      await this.lockReservation(transaction, reservationId, actor.hotelId);
      const reservation = await transaction.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      });
      this.assertActiveStay(reservation.status);
      const service = await transaction.service.findFirst({
        where: { id: dto.serviceId, hotelId: actor.hotelId, isActive: true },
      });
      if (!service) {
        throw new ConflictException({
          code: 'SERVICE_NOT_AVAILABLE',
          message: 'The selected service is inactive or does not belong to this hotel.',
        });
      }
      const quantity = new Prisma.Decimal(dto.quantity);
      const charge = await transaction.charge.create({
        data: {
          reservationId,
          serviceId: service.id,
          type: ChargeType.SERVICE,
          description: service.name,
          quantity,
          unitPrice: service.defaultPrice,
          totalAmount: service.defaultPrice.mul(quantity),
        },
        include: { service: { select: { id: true, name: true } } },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'charge.service_create',
          entityType: 'Charge',
          entityId: charge.id,
          newValue: this.json(this.chargeView(charge)),
        },
        transaction,
      );
      return this.chargeView(charge);
    });
  }

  async list(reservationId: string, query: PaginationQueryDto, actor: RequestUser) {
    await this.assertHotelReservation(reservationId, actor.hotelId);
    const [charges, total] = await this.prisma.$transaction([
      this.prisma.charge.findMany({
        where: { reservationId },
        include: {
          service: { select: { id: true, name: true } },
          voidedBy: { select: { id: true, fullName: true } },
        },
        orderBy: [{ chargeDate: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.charge.count({ where: { reservationId } }),
    ]);
    return paginatedResponse(charges.map((charge) => this.chargeView(charge)), query.page, query.limit, total);
  }

  async folio(reservationId: string, actor: RequestUser) {
    await this.assertHotelReservation(reservationId, actor.hotelId);
    return this.buildFolio(reservationId, this.prisma);
  }

  void(id: string, dto: VoidChargeDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (transaction) => {
      const lockedReservation = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT r."id" FROM "Reservation" r
        JOIN "Charge" c ON c."reservationId" = r."id"
        WHERE c."id" = ${id}::uuid AND r."hotelId" = ${actor.hotelId}::uuid
        FOR UPDATE OF r
      `;
      if (lockedReservation.length !== 1) this.chargeNotFound();
      const reservationId = lockedReservation[0].id;
      const lockedCharge = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Charge" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (lockedCharge.length !== 1) this.chargeNotFound();
      const reservation = await transaction.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, discountAmount: true },
      });
      this.assertActiveStay(reservation.status);
      const charge = await transaction.charge.findUniqueOrThrow({ where: { id } });
      if (charge.voidedAt) {
        throw new ConflictException({
          code: 'CHARGE_ALREADY_VOIDED',
          message: 'This charge has already been voided.',
        });
      }
      const folio = await this.buildFolio(reservationId, transaction, id);
      if (reservation.discountAmount.gt(new Prisma.Decimal(folio.subtotal))) {
        throw new ConflictException({
          code: 'VOID_WOULD_EXCEED_DISCOUNT',
          message: 'Reduce the reservation discount before voiding this charge.',
        });
      }
      const voidedAt = new Date();
      const updated = await transaction.charge.update({
        where: { id },
        data: { voidedAt, voidedById: actor.id, voidReason: dto.reason },
        include: {
          service: { select: { id: true, name: true } },
          voidedBy: { select: { id: true, fullName: true } },
        },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'charge.void',
          entityType: 'Charge',
          entityId: id,
          oldValue: { voidedAt: null, voidReason: null },
          newValue: { voidedAt: voidedAt.toISOString(), voidReason: dto.reason },
        },
        transaction,
      );
      return this.chargeView(updated);
    });
  }

  async createRoomCharges(transaction: Prisma.TransactionClient, reservationId: string) {
    const reservation: FolioRecord = await transaction.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: FOLIO_INCLUDE,
    });
    const nights = this.nights(reservation.checkInDate, reservation.checkOutDate);
    for (const entry of reservation.rooms) {
      if (entry.roomCharge) continue;
      await transaction.charge.create({
        data: {
          reservationId: reservation.id,
          reservationRoomId: entry.id,
          type: ChargeType.ROOM,
          description: `Room ${entry.room.roomNumber} — ${nights} night${nights === 1 ? '' : 's'}`,
          quantity: new Prisma.Decimal(nights),
          unitPrice: entry.nightlyRate,
          totalAmount: entry.nightlyRate.mul(nights),
        },
      });
    }
  }

  async buildFolio(
    reservationId: string,
    database: Prisma.TransactionClient | PrismaService,
    excludedChargeId?: string,
  ) {
    const reservation = await database.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: FOLIO_INCLUDE,
    });
    const nights = this.nights(reservation.checkInDate, reservation.checkOutDate);
    let subtotal = new Prisma.Decimal(0);
    const roomLines = reservation.rooms.map((entry) => {
      const posted = entry.roomCharge;
      const amount = posted ? posted.totalAmount : entry.nightlyRate.mul(nights);
      if (!posted || (posted.voidedAt === null && posted.id !== excludedChargeId)) {
        subtotal = subtotal.plus(amount);
      }
      return {
        reservationRoomId: entry.id,
        roomId: entry.roomId,
        roomNumber: entry.room.roomNumber,
        nights,
        nightlyRate: entry.nightlyRate.toString(),
        amount: amount.toString(),
        chargeId: posted?.id ?? null,
        posted: Boolean(posted),
        voided: Boolean(posted?.voidedAt),
      };
    });
    const otherCharges = reservation.charges.filter((charge) => charge.type !== ChargeType.ROOM);
    for (const charge of otherCharges) {
      if (charge.voidedAt === null && charge.id !== excludedChargeId) {
        subtotal = subtotal.plus(charge.totalAmount);
      }
    }
    const total = subtotal.minus(reservation.discountAmount);
    return {
      reservation: {
        id: reservation.id,
        bookingNumber: reservation.bookingNumber,
        status: reservation.status,
        guest: reservation.guest,
        checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
        checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
        checkedInAt: reservation.checkedInAt,
        checkedOutAt: reservation.checkedOutAt,
      },
      roomLines,
      charges: otherCharges.map((charge) => this.chargeView(charge)),
      subtotal: subtotal.toString(),
      discountAmount: reservation.discountAmount.toString(),
      total: total.toString(),
      roomChargesPosted: reservation.rooms.every((entry) => entry.roomCharge !== null),
    };
  }

  private async lockReservation(
    transaction: Prisma.TransactionClient,
    id: string,
    hotelId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Reservation"
      WHERE "id" = ${id}::uuid AND "hotelId" = ${hotelId}::uuid
      FOR UPDATE
    `;
    if (rows.length !== 1) this.reservationNotFound();
  }

  private async assertHotelReservation(id: string, hotelId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });
    if (!reservation) this.reservationNotFound();
  }

  private assertActiveStay(status: ReservationStatus) {
    if (status !== ReservationStatus.CHECKED_IN) {
      throw new ConflictException({
        code: 'CHARGES_REQUIRE_ACTIVE_STAY',
        message: 'Charges can only be changed while the reservation is checked in.',
      });
    }
  }

  private chargeView<
    T extends { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; totalAmount: Prisma.Decimal },
  >(charge: T) {
    return {
      ...charge,
      quantity: charge.quantity.toString(),
      unitPrice: charge.unitPrice.toString(),
      totalAmount: charge.totalAmount.toString(),
      voided: 'voidedAt' in charge && Boolean(charge.voidedAt),
    };
  }

  private nights(checkIn: Date, checkOut: Date) {
    return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private reservationNotFound(): never {
    throw new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation was not found.',
    });
  }

  private chargeNotFound(): never {
    throw new NotFoundException({ code: 'CHARGE_NOT_FOUND', message: 'Charge was not found.' });
  }
}
