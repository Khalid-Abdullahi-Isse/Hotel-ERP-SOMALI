import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { ReservationStatus, RoomStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoomDto } from './dto/create-room.dto.js';
import type { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import type { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';
import type { UpdateRoomDto } from './dto/update-room.dto.js';

const ROOM_INCLUDE = {
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
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateRoomDto, actor: RequestUser) {
    await this.assertReferences(actor.hotelId, dto.roomTypeId, dto.floorId);
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.room.create({
        data: { ...dto, hotelId: actor.hotelId },
        include: ROOM_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'room.create',
          entityType: 'Room',
          entityId: room.id,
          newValue: this.json(this.view(room)),
        },
        transaction,
      );
      return this.view(room);
    });
  }

  async list(query: ListRoomsQueryDto, actor: RequestUser) {
    const where: Prisma.RoomWhereInput = {
      hotelId: actor.hotelId,
      ...(query.search
        ? { roomNumber: { contains: query.search.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
    };
    const [rooms, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        include: ROOM_INCLUDE,
        orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.room.count({ where }),
    ]);
    return paginatedResponse(rooms.map((room) => this.view(room)), query.page, query.limit, total);
  }

  async findOne(id: string, actor: RequestUser) {
    return this.view(await this.findHotelRoom(id, actor.hotelId));
  }

  async update(id: string, dto: UpdateRoomDto, actor: RequestUser) {
    const before = await this.findHotelRoom(id, actor.hotelId);
    await this.assertReferences(
      actor.hotelId,
      dto.roomTypeId ?? before.roomTypeId,
      dto.floorId === undefined ? before.floorId : dto.floorId,
    );
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.room.update({
        where: { id },
        data: dto,
        include: ROOM_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'room.update',
          entityType: 'Room',
          entityId: id,
          oldValue: this.json(this.view(before)),
          newValue: this.json(this.view(room)),
        },
        transaction,
      );
      return this.view(room);
    });
  }

  async updateStatus(id: string, dto: UpdateRoomStatusDto, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockRoom(transaction, id, actor.hotelId);
      const before = await transaction.room.findUniqueOrThrow({
        where: { id },
        include: ROOM_INCLUDE,
      });
      if (!before.isActive) {
        throw new ConflictException({
          code: 'ROOM_INACTIVE',
          message: 'Restore the room before changing its status.',
        });
      }
      if (before.status !== RoomStatus.AVAILABLE && before.status !== RoomStatus.MAINTENANCE) {
        throw new ConflictException({
          code: 'ROOM_STATUS_MANAGED_BY_WORKFLOW',
          message: 'This room status is managed by reservation, stay, or housekeeping workflows.',
        });
      }
      if (dto.status === RoomStatus.MAINTENANCE) {
        await this.assertNoActiveReservations(transaction, id);
      }
      const room = await transaction.room.update({
        where: { id },
        data: { status: dto.status },
        include: ROOM_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'room.status_update',
          entityType: 'Room',
          entityId: id,
          oldValue: { status: before.status },
          newValue: { status: room.status },
        },
        transaction,
      );
      return this.view(room);
    });
  }

  deactivate(id: string, actor: RequestUser) {
    return this.setActive(id, false, actor);
  }

  restore(id: string, actor: RequestUser) {
    return this.setActive(id, true, actor);
  }

  private async setActive(id: string, isActive: boolean, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockRoom(transaction, id, actor.hotelId);
      const before = await transaction.room.findUniqueOrThrow({
        where: { id },
        include: ROOM_INCLUDE,
      });
      if (
        !isActive &&
        (before.status === RoomStatus.RESERVED || before.status === RoomStatus.OCCUPIED)
      ) {
        throw new ConflictException({
          code: 'ROOM_CURRENTLY_IN_USE',
          message: 'A reserved or occupied room cannot be deactivated.',
        });
      }
      if (!isActive) await this.assertNoActiveReservations(transaction, id);
      if (isActive) {
        const roomType = await transaction.roomType.findFirst({
          where: { id: before.roomTypeId, hotelId: actor.hotelId, isActive: true },
          select: { id: true },
        });
        if (!roomType) {
          throw new ConflictException({
            code: 'INVALID_ROOM_TYPE',
            message: 'Restore the room type before restoring this room.',
          });
        }
      }
      const room = await transaction.room.update({
        where: { id },
        data: { isActive },
        include: ROOM_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: isActive ? 'room.restore' : 'room.deactivate',
          entityType: 'Room',
          entityId: id,
          oldValue: this.json(this.view(before)),
          newValue: this.json(this.view(room)),
        },
        transaction,
      );
      return this.view(room);
    });
  }

  private async assertReferences(hotelId: string, roomTypeId: string, floorId?: string | null) {
    const [roomType, floor] = await Promise.all([
      this.prisma.roomType.findFirst({
        where: { id: roomTypeId, hotelId, isActive: true },
        select: { id: true },
      }),
      floorId
        ? this.prisma.floor.findFirst({ where: { id: floorId, hotelId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (!roomType) {
      throw new ConflictException({
        code: 'INVALID_ROOM_TYPE',
        message: 'The room type is inactive, invalid, or belongs to another hotel.',
      });
    }
    if (floorId && !floor) {
      throw new ConflictException({
        code: 'INVALID_FLOOR',
        message: 'The floor is invalid or belongs to another hotel.',
      });
    }
  }

  private async findHotelRoom(id: string, hotelId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, hotelId },
      include: ROOM_INCLUDE,
    });
    if (!room) {
      throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room was not found.' });
    }
    return room;
  }

  private async lockRoom(transaction: Prisma.TransactionClient, id: string, hotelId: string) {
    const rooms = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Room"
      WHERE "id" = ${id}::uuid AND "hotelId" = ${hotelId}::uuid
      FOR UPDATE
    `;
    if (rooms.length !== 1) {
      throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room was not found.' });
    }
  }

  private async assertNoActiveReservations(transaction: Prisma.TransactionClient, roomId: string) {
    const count = await transaction.reservationRoom.count({
      where: {
        roomId,
        bookingStatus: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
          ],
        },
      },
    });
    if (count > 0) {
      throw new ConflictException({
        code: 'ROOM_HAS_ACTIVE_RESERVATIONS',
        message: 'Cancel or reassign active reservations before changing this room.',
      });
    }
  }

  private view<T extends { roomType: { basePrice: { toString(): string } } }>(room: T) {
    return {
      ...room,
      effectivePrice: room.roomType.basePrice.toString(),
      roomType: { ...room.roomType, basePrice: room.roomType.basePrice.toString() },
    };
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
