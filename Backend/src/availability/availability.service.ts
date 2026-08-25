import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma as PrismaTypes } from '../generated/prisma/client.js';
import { ReservationStatus, RoomStatus } from '../generated/prisma/enums.js';
import type { RequestUser } from '../auth/auth.types.js';
import { parseStayDates } from '../common/dates/stay-dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import type { SearchAvailabilityQueryDto } from './dto/search-availability-query.dto.js';

export const ACTIVE_BOOKING_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
] as const;

export const RESERVABLE_ROOM_INCLUDE = {
  floor: { select: { id: true, number: true, name: true } },
  roomType: {
    select: {
      id: true,
      code: true,
      name: true,
      capacityAdults: true,
      capacityChildren: true,
      basePrice: true,
      isActive: true,
    },
  },
} as const;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchAvailabilityQueryDto, actor: RequestUser) {
    const dates = parseStayDates(query.checkInDate, query.checkOutDate);
    const where: PrismaTypes.RoomWhereInput = {
      hotelId: actor.hotelId,
      isActive: true,
      status: query.readyOnly ? RoomStatus.AVAILABLE : { not: RoomStatus.MAINTENANCE },
      roomType: {
        isActive: true,
        capacityAdults: { gte: query.adults },
        capacityChildren: { gte: query.children },
      },
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      reservationRooms: {
        none: {
          bookingStatus: { in: [...ACTIVE_BOOKING_STATUSES] },
          checkInDate: { lt: dates.checkOut },
          checkOutDate: { gt: dates.checkIn },
        },
      },
    };
    const [rooms, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        include: RESERVABLE_ROOM_INCLUDE,
        orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.room.count({ where }),
    ]);
    return {
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      nights: dates.nights,
      pagination: paginatedResponse([], query.page, query.limit, total).pagination,
      data: rooms.map((room) => ({
        ...room,
        nightlyRate: room.roomType.basePrice.toString(),
        estimatedRoomTotal: room.roomType.basePrice.mul(dates.nights).toString(),
        roomType: { ...room.roomType, basePrice: room.roomType.basePrice.toString() },
      })),
    };
  }

  async lockAndValidateRooms(
    transaction: PrismaTypes.TransactionClient,
    hotelId: string,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
    excludedReservationId?: string,
  ) {
    const sortedIds = [...roomIds].sort();
    for (const roomId of sortedIds) {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Room"
        WHERE "id" = ${roomId}::uuid AND "hotelId" = ${hotelId}::uuid
        FOR UPDATE
      `;
      if (locked.length !== 1) this.invalidRooms();
    }

    const rooms = await transaction.room.findMany({
      where: { id: { in: sortedIds }, hotelId },
      include: RESERVABLE_ROOM_INCLUDE,
      orderBy: { id: 'asc' },
    });
    if (rooms.length !== sortedIds.length) this.invalidRooms();
    if (
      rooms.some(
        (room) =>
          !room.isActive || !room.roomType.isActive || room.status === RoomStatus.MAINTENANCE,
      )
    ) {
      throw new ConflictException({
        code: 'ROOM_NOT_RESERVABLE',
        message: 'One or more selected rooms are inactive or under maintenance.',
      });
    }

    const overlap = await transaction.reservationRoom.findFirst({
      where: {
        roomId: { in: sortedIds },
        ...(excludedReservationId ? { reservationId: { not: excludedReservationId } } : {}),
        bookingStatus: { in: [...ACTIVE_BOOKING_STATUSES] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true },
    });
    if (overlap) this.alreadyBooked();
    return rooms;
  }

  alreadyBooked(): never {
    throw new ConflictException({
      code: 'ROOM_ALREADY_BOOKED',
      message: 'One or more selected rooms are no longer available.',
    });
  }

  private invalidRooms(): never {
    throw new ConflictException({
      code: 'INVALID_RESERVATION_ROOM',
      message: 'One or more rooms are invalid or belong to another hotel.',
    });
  }
}
