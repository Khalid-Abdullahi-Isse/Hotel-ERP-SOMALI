import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { ReservationStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { parseStayDates } from '../common/dates/stay-dates.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GuestsService } from '../guests/guests.service.js';
import type { ApplyDiscountDto } from './dto/apply-discount.dto.js';
import type { CreateReservationDto } from './dto/create-reservation.dto.js';
import type { CreateReservationWithGuestDto } from './dto/create-reservation-with-guest.dto.js';
import type { ListReservationsQueryDto } from './dto/list-reservations-query.dto.js';
import type { ReplaceReservationRoomsDto } from './dto/replace-reservation-rooms.dto.js';
import type { ReservationActionDto } from './dto/reservation-action.dto.js';
import type { UpdateReservationDto } from './dto/update-reservation.dto.js';
import type { ReservationTimelineQueryDto } from './dto/reservation-timeline-query.dto.js';

const RESERVATION_INCLUDE = {
  guest: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
  rooms: {
    include: {
      room: {
        include: {
          floor: { select: { id: true, number: true, name: true } },
          roomType: { select: { id: true, code: true, name: true, isActive: true } },
        },
      },
    },
    orderBy: { room: { roomNumber: 'asc' } },
  },
  history: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      changedById: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

type ReservationRecord = Prisma.ReservationGetPayload<{ include: typeof RESERVATION_INCLUDE }>;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly auditLogs: AuditLogsService,
    private readonly guests: GuestsService,
  ) {}

  async create(dto: CreateReservationDto, actor: RequestUser) {
    const dates = parseStayDates(dto.checkInDate, dto.checkOutDate);
    for (let bookingAttempt = 0; bookingAttempt < 3; bookingAttempt += 1) {
      const bookingNumber = this.generateBookingNumber();
      try {
        return await this.serializable(async (transaction) => {
          await this.assertGuest(transaction, dto.guestId, actor.hotelId);
          return this.createInTransaction(transaction, dto, dto.guestId, actor, bookingNumber, dates);
        });
      } catch (error) {
        if (this.isOverlapError(error)) this.availability.alreadyBooked();
        if (this.isUniqueError(error) && bookingAttempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'BOOKING_NUMBER_CONFLICT',
      message: 'Could not generate a unique booking number. Please retry.',
    });
  }

  async createWithGuest(dto: CreateReservationWithGuestDto, actor: RequestUser) {
    const dates = parseStayDates(dto.checkInDate, dto.checkOutDate);
    for (let bookingAttempt = 0; bookingAttempt < 3; bookingAttempt += 1) {
      const bookingNumber = this.generateBookingNumber();
      try {
        return await this.serializable(async (transaction) => {
          const guest = await this.guests.createInTransaction(
            { ...dto.guest, allowPossibleDuplicate: false },
            actor,
            transaction,
          );
          return this.createInTransaction(
            transaction,
            dto,
            guest.id,
            actor,
            bookingNumber,
            dates,
          );
        });
      } catch (error) {
        if (this.isOverlapError(error)) this.availability.alreadyBooked();
        if (this.isUniqueError(error) && bookingAttempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'BOOKING_NUMBER_CONFLICT',
      message: 'Could not generate a unique booking number. Please retry.',
    });
  }

  async list(query: ListReservationsQueryDto, actor: RequestUser) {
    const where: Prisma.ReservationWhereInput = {
      hotelId: actor.hotelId,
      ...(query.guestId ? { guestId: query.guestId } : {}),
      ...(query.roomId ? { rooms: { some: { roomId: query.roomId } } } : {}),
      ...(query.roomIds?.length ? { rooms: { some: { roomId: { in: query.roomIds } } } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { bookingNumber: { contains: query.search.trim(), mode: 'insensitive' } },
              { guest: { fullName: { contains: query.search.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.arrivalFrom || query.arrivalTo
        ? {
            checkInDate: {
              ...(query.arrivalFrom
                ? {
                    gte: parseStayDates(query.arrivalFrom, this.nextDate(query.arrivalFrom))
                      .checkIn,
                  }
                : {}),
              ...(query.arrivalTo
                ? { lte: parseStayDates(query.arrivalTo, this.nextDate(query.arrivalTo)).checkIn }
                : {}),
            },
          }
        : {}),
    };
    const [reservations, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: RESERVATION_INCLUDE,
        orderBy: [{ checkInDate: 'asc' }, { bookingNumber: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginatedResponse(
      reservations.map((reservation) => this.view(reservation)),
      query.page,
      query.limit,
      total,
    );
  }

  async findOne(id: string, actor: RequestUser) {
    return this.view(await this.findHotelReservation(id, actor.hotelId));
  }

  async timeline(query: ReservationTimelineQueryDto, actor: RequestUser) {
    const start = parseStayDates(query.startDate, this.nextDate(query.startDate)).checkIn;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const [rooms, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where: { hotelId: actor.hotelId, isActive: true },
        include: {
          floor: { select: { id: true, number: true, name: true } },
          roomType: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.room.count({ where: { hotelId: actor.hotelId, isActive: true } }),
    ]);
    const roomIds = rooms.map((room) => room.id);
    const reservations = roomIds.length
      ? await this.prisma.reservation.findMany({
        where: {
          hotelId: actor.hotelId,
          checkInDate: { lt: end },
          checkOutDate: { gt: start },
          rooms: { some: { roomId: { in: roomIds } } },
        },
        select: {
          id: true,
          bookingNumber: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
          guest: { select: { fullName: true } },
          rooms: { select: { roomId: true } },
        },
        orderBy: [{ checkInDate: 'asc' }, { bookingNumber: 'asc' }],
      })
      : [];

    return {
      startDate: query.startDate,
      endDate: end.toISOString().slice(0, 10),
      pagination: paginatedResponse([], query.page, query.limit, total).pagination,
      rooms: rooms.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomType: room.roomType,
      })),
      reservations: reservations.map((reservation) => ({
        ...reservation,
        checkInDate: reservation.checkInDate.toISOString(),
        checkOutDate: reservation.checkOutDate.toISOString(),
      })),
    };
  }

  async update(id: string, dto: UpdateReservationDto, actor: RequestUser) {
    try {
      return await this.serializable(async (transaction) => {
        await this.lockReservation(transaction, id, actor.hotelId);
        const before = await this.findHotelReservation(id, actor.hotelId, transaction);
        this.assertEditable(before.status);
        if (dto.guestId) await this.assertGuest(transaction, dto.guestId, actor.hotelId);
        const checkInValue = dto.checkInDate ?? before.checkInDate.toISOString().slice(0, 10);
        const checkOutValue = dto.checkOutDate ?? before.checkOutDate.toISOString().slice(0, 10);
        const dates = parseStayDates(checkInValue, checkOutValue);
        const roomIds = before.rooms.map((entry) => entry.roomId);
        const rooms = await this.availability.lockAndValidateRooms(
          transaction,
          actor.hotelId,
          roomIds,
          dates.checkIn,
          dates.checkOut,
          id,
        );
        this.assertCapacity(rooms, dto.adults ?? before.adults, dto.children ?? before.children);
        const projectedSubtotal = before.rooms.reduce(
          (total, entry) => total.plus(entry.nightlyRate.mul(dates.nights)),
          new Prisma.Decimal(0),
        );
        this.assertDiscountFits(before.discountAmount, projectedSubtotal);
        await transaction.reservation.update({
          where: { id },
          data: {
            ...dto,
            checkInDate: dates.checkIn,
            checkOutDate: dates.checkOut,
          },
        });
        const updated = await transaction.reservation.findUniqueOrThrow({
          where: { id },
          include: RESERVATION_INCLUDE,
        });
        await this.auditLogs.record(
          {
            hotelId: actor.hotelId,
            userId: actor.id,
            action: 'reservation.update',
            entityType: 'Reservation',
            entityId: id,
            oldValue: this.auditView(before),
            newValue: this.auditView(updated),
          },
          transaction,
        );
        return this.view(updated);
      });
    } catch (error) {
      if (this.isOverlapError(error)) this.availability.alreadyBooked();
      throw error;
    }
  }

  async replaceRooms(id: string, dto: ReplaceReservationRoomsDto, actor: RequestUser) {
    try {
      return await this.serializable(async (transaction) => {
        await this.lockReservation(transaction, id, actor.hotelId);
        const before = await this.findHotelReservation(id, actor.hotelId, transaction);
        this.assertEditable(before.status);
        const rooms = await this.availability.lockAndValidateRooms(
          transaction,
          actor.hotelId,
          dto.roomIds,
          before.checkInDate,
          before.checkOutDate,
          id,
        );
        this.assertCapacity(rooms, before.adults, before.children);
        const oldRates = new Map(
          before.rooms.map((entry) => [entry.roomId, entry.nightlyRate] as const),
        );
        const nights = Math.round(
          (before.checkOutDate.getTime() - before.checkInDate.getTime()) / 86_400_000,
        );
        const projectedSubtotal = rooms.reduce(
          (total, room) =>
            total.plus((oldRates.get(room.id) ?? room.roomType.basePrice).mul(nights)),
          new Prisma.Decimal(0),
        );
        this.assertDiscountFits(before.discountAmount, projectedSubtotal);
        await transaction.reservationRoom.deleteMany({ where: { reservationId: id } });
        await transaction.reservationRoom.createMany({
          data: rooms.map((room) => ({
            reservationId: id,
            roomId: room.id,
            checkInDate: before.checkInDate,
            checkOutDate: before.checkOutDate,
            nightlyRate: oldRates.get(room.id) ?? room.roomType.basePrice,
          })),
        });
        const updated = await transaction.reservation.findUniqueOrThrow({
          where: { id },
          include: RESERVATION_INCLUDE,
        });
        await this.auditLogs.record(
          {
            hotelId: actor.hotelId,
            userId: actor.id,
            action: 'reservation.rooms_update',
            entityType: 'Reservation',
            entityId: id,
            oldValue: this.auditView(before),
            newValue: this.auditView(updated),
          },
          transaction,
        );
        return this.view(updated);
      });
    } catch (error) {
      if (this.isOverlapError(error)) this.availability.alreadyBooked();
      throw error;
    }
  }

  async applyDiscount(id: string, dto: ApplyDiscountDto, actor: RequestUser) {
    return this.serializable(async (transaction) => {
      await this.lockReservation(transaction, id, actor.hotelId);
      const before = await this.findHotelReservation(id, actor.hotelId, transaction);
      if (
        before.status !== ReservationStatus.PENDING &&
        before.status !== ReservationStatus.CONFIRMED &&
        before.status !== ReservationStatus.CHECKED_IN
      ) {
        throw new ConflictException({
          code: 'DISCOUNT_NOT_EDITABLE',
          message: 'A discount can only be changed before checkout.',
        });
      }
      const amount = new Prisma.Decimal(dto.amount);
      const serviceTotals = await transaction.charge.aggregate({
        where: {
          reservationId: id,
          voidedAt: null,
          type: { not: 'ROOM' },
        },
        _sum: { totalAmount: true },
      });
      const subtotal = this.calculateSubtotal(before).plus(
        serviceTotals._sum.totalAmount ?? new Prisma.Decimal(0),
      );
      if (amount.gt(subtotal)) {
        throw new BadRequestException({
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: 'Discount cannot exceed the current room and service subtotal.',
        });
      }
      await transaction.reservation.update({
        where: { id },
        data: { discountAmount: amount },
      });
      const updated = await transaction.reservation.findUniqueOrThrow({
        where: { id },
        include: RESERVATION_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'reservation.discount_update',
          entityType: 'Reservation',
          entityId: id,
          oldValue: { discountAmount: before.discountAmount.toString() },
          newValue: { discountAmount: updated.discountAmount.toString() },
        },
        transaction,
      );
      return this.view(updated);
    });
  }

  confirm(id: string, actor: RequestUser) {
    return this.transition(id, ReservationStatus.CONFIRMED, undefined, actor);
  }

  cancel(id: string, dto: ReservationActionDto, actor: RequestUser) {
    return this.transition(id, ReservationStatus.CANCELLED, dto.note, actor);
  }

  noShow(id: string, dto: ReservationActionDto, actor: RequestUser) {
    return this.transition(id, ReservationStatus.NO_SHOW, dto.note, actor);
  }

  private async transition(
    id: string,
    target: ReservationStatus,
    note: string | undefined,
    actor: RequestUser,
  ) {
    return this.serializable(async (transaction) => {
      await this.lockReservation(transaction, id, actor.hotelId);
      const before = await this.findHotelReservation(id, actor.hotelId, transaction);
      this.assertTransition(before.status, target);
      if (target === ReservationStatus.NO_SHOW) {
        const hotel = await transaction.hotel.findUniqueOrThrow({
          where: { id: actor.hotelId },
          select: { timezone: true },
        });
        const today = this.todayInTimeZone(hotel.timezone);
        if (today < before.checkInDate.toISOString().slice(0, 10)) {
          throw new ConflictException({
            code: 'NO_SHOW_TOO_EARLY',
            message: 'A reservation cannot be marked no-show before its arrival date.',
          });
        }
      }
      await transaction.reservation.update({
        where: { id },
        data: {
          status: target,
          ...(target === ReservationStatus.CANCELLED
            ? { cancelledAt: new Date(), cancellationNote: note }
            : {}),
        },
      });
      await transaction.reservationHistory.create({
        data: {
          reservationId: id,
          fromStatus: before.status,
          toStatus: target,
          note,
          changedById: actor.id,
        },
      });
      const updated = await transaction.reservation.findUniqueOrThrow({
        where: { id },
        include: RESERVATION_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: `reservation.${target.toLowerCase()}`,
          entityType: 'Reservation',
          entityId: id,
          oldValue: { status: before.status },
          newValue: { status: updated.status, note: note ?? null },
        },
        transaction,
      );
      return this.view(updated);
    });
  }

  private async serializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    let finalError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        });
      } catch (error) {
        finalError = error;
        if (!this.isRetryableTransactionError(error) || attempt === 2) throw error;
      }
    }
    throw finalError;
  }

  private assertCapacity(
    rooms: Array<{ roomType: { capacityAdults: number; capacityChildren: number } }>,
    adults: number,
    children: number,
  ) {
    const adultCapacity = rooms.reduce((sum, room) => sum + room.roomType.capacityAdults, 0);
    const childCapacity = rooms.reduce((sum, room) => sum + room.roomType.capacityChildren, 0);
    if (adults > adultCapacity || children > childCapacity) {
      throw new ConflictException({
        code: 'ROOM_CAPACITY_EXCEEDED',
        message: 'The selected rooms do not have enough guest capacity.',
        details: {
          requested: { adults, children },
          capacity: { adults: adultCapacity, children: childCapacity },
        },
      });
    }
  }

  private assertDiscountFits(discount: Prisma.Decimal, subtotal: Prisma.Decimal) {
    if (discount.gt(subtotal)) {
      throw new ConflictException({
        code: 'DISCOUNT_EXCEEDS_NEW_SUBTOTAL',
        message: 'Reduce the reservation discount before shortening the stay or changing rooms.',
      });
    }
  }

  private assertEditable(status: ReservationStatus) {
    if (status !== ReservationStatus.PENDING && status !== ReservationStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'RESERVATION_NOT_EDITABLE',
        message: 'Only pending or confirmed reservations can be edited.',
      });
    }
  }

  private assertTransition(from: ReservationStatus, target: ReservationStatus) {
    const allowed =
      (target === ReservationStatus.CONFIRMED && from === ReservationStatus.PENDING) ||
      ((target === ReservationStatus.CANCELLED || target === ReservationStatus.NO_SHOW) &&
        (from === ReservationStatus.PENDING || from === ReservationStatus.CONFIRMED));
    if (!allowed) {
      throw new ConflictException({
        code: 'INVALID_RESERVATION_STATUS_TRANSITION',
        message: `Reservation cannot transition from ${from} to ${target}.`,
      });
    }
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    dto: Pick<
      CreateReservationDto,
      'roomIds' | 'adults' | 'children' | 'notes' | 'checkInDate' | 'checkOutDate'
    >,
    guestId: string,
    actor: RequestUser,
    bookingNumber: string,
    dates: { checkIn: Date; checkOut: Date },
  ) {
    const rooms = await this.availability.lockAndValidateRooms(
      transaction,
      actor.hotelId,
      dto.roomIds,
      dates.checkIn,
      dates.checkOut,
    );
    this.assertCapacity(rooms, dto.adults, dto.children);
    const reservation = await transaction.reservation.create({
      data: {
        hotelId: actor.hotelId,
        guestId,
        bookingNumber,
        checkInDate: dates.checkIn,
        checkOutDate: dates.checkOut,
        adults: dto.adults,
        children: dto.children,
        notes: dto.notes,
      },
    });
    await transaction.reservationRoom.createMany({
      data: rooms.map((room) => ({
        reservationId: reservation.id,
        roomId: room.id,
        checkInDate: dates.checkIn,
        checkOutDate: dates.checkOut,
        nightlyRate: room.roomType.basePrice,
      })),
    });
    await transaction.reservationHistory.create({
      data: {
        reservationId: reservation.id,
        toStatus: ReservationStatus.PENDING,
        note: 'Reservation created',
        changedById: actor.id,
      },
    });
    const completed = await transaction.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: RESERVATION_INCLUDE,
    });
    await this.auditLogs.record(
      {
        hotelId: actor.hotelId,
        userId: actor.id,
        action: 'reservation.create',
        entityType: 'Reservation',
        entityId: reservation.id,
        newValue: this.auditView(completed),
      },
      transaction,
    );
    return this.view(completed);
  }

  private assertGuest(transaction: Prisma.TransactionClient, guestId: string, hotelId: string) {
    return transaction.guest
      .findFirst({
        where: { id: guestId, hotelId },
        select: { id: true },
      })
      .then((guest) => {
        if (!guest) {
          throw new ConflictException({
            code: 'INVALID_RESERVATION_GUEST',
            message: 'Guest is invalid or belongs to another hotel.',
          });
        }
      });
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
    if (rows.length !== 1) this.notFound();
  }

  private async findHotelReservation(
    id: string,
    hotelId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<ReservationRecord> {
    const database = transaction ?? this.prisma;
    const reservation = await database.reservation.findFirst({
      where: { id, hotelId },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) this.notFound();
    return reservation;
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'RESERVATION_NOT_FOUND',
      message: 'Reservation was not found.',
    });
  }

  private view(reservation: ReservationRecord) {
    const nights = Math.round(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86_400_000,
    );
    const roomLines = reservation.rooms.map((entry) => ({
      ...entry,
      nightlyRate: entry.nightlyRate.toString(),
      roomTotal: entry.nightlyRate.mul(nights).toString(),
    }));
    const subtotal = this.calculateSubtotal(reservation);
    const total = subtotal.minus(reservation.discountAmount);
    return {
      ...reservation,
      nights,
      rooms: roomLines,
      discountAmount: reservation.discountAmount.toString(),
      subtotal: subtotal.toString(),
      estimatedTotal: total.toString(),
    };
  }

  private calculateSubtotal(
    reservation: Pick<ReservationRecord, 'rooms' | 'checkInDate' | 'checkOutDate'>,
  ) {
    const nights = Math.round(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86_400_000,
    );
    return reservation.rooms.reduce(
      (total, entry) => total.plus(entry.nightlyRate.mul(nights)),
      new Prisma.Decimal(0),
    );
  }

  private auditView(reservation: ReservationRecord): Prisma.InputJsonObject {
    return {
      bookingNumber: reservation.bookingNumber,
      guestId: reservation.guestId,
      status: reservation.status,
      checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
      checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
      adults: reservation.adults,
      children: reservation.children,
      discountAmount: reservation.discountAmount.toString(),
      roomIds: reservation.rooms.map((entry) => entry.roomId),
      nightlyRates: reservation.rooms.map((entry) => ({
        roomId: entry.roomId,
        amount: entry.nightlyRate.toString(),
      })),
    };
  }

  private generateBookingNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(2, 10).replace(/-/g, '');
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `RSV-${date}-${suffix}`;
  }

  private nextDate(value: string): string {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return value;
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  private todayInTimeZone(timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private isUniqueError(error: unknown): boolean {
    return this.hasErrorMarker(error, ['P2002']);
  }

  private isOverlapError(error: unknown): boolean {
    return this.hasErrorMarker(error, ['23P01', 'ReservationRoom_no_active_overlap']);
  }

  private isRetryableTransactionError(error: unknown): boolean {
    return this.hasErrorMarker(error, ['P2034', '40001', '40P01']);
  }

  private hasErrorMarker(error: unknown, markers: string[]): boolean {
    const visited = new WeakSet<object>();
    const inspect = (value: unknown, depth: number): boolean => {
      if (depth > 5) return false;
      if (typeof value === 'string') return markers.some((marker) => value.includes(marker));
      if (typeof value !== 'object' || value === null || visited.has(value)) return false;
      visited.add(value);
      return Object.values(value).some((entry) => inspect(entry, depth + 1));
    };
    return inspect(error, 0);
  }
}
