import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoomTypeDto } from './dto/create-room-type.dto.js';
import type { UpdateRoomTypeDto } from './dto/update-room-type.dto.js';

const ROOM_TYPE_INCLUDE = { _count: { select: { rooms: true } } } as const;

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateRoomTypeDto, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const roomType = await transaction.roomType.create({
        data: { ...dto, hotelId: actor.hotelId },
        include: ROOM_TYPE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'room_type.create',
          entityType: 'RoomType',
          entityId: roomType.id,
          newValue: this.json(this.view(roomType)),
        },
        transaction,
      );
      return this.view(roomType);
    });
  }

  async list(actor: RequestUser) {
    const roomTypes = await this.prisma.roomType.findMany({
      where: { hotelId: actor.hotelId },
      include: ROOM_TYPE_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return roomTypes.map((roomType) => this.view(roomType));
  }

  async findOne(id: string, actor: RequestUser) {
    return this.view(await this.findHotelRoomType(id, actor.hotelId));
  }

  async update(id: string, dto: UpdateRoomTypeDto, actor: RequestUser) {
    const before = await this.findHotelRoomType(id, actor.hotelId);
    return this.prisma.$transaction(async (transaction) => {
      const roomType = await transaction.roomType.update({
        where: { id },
        data: dto,
        include: ROOM_TYPE_INCLUDE,
      });
      const priceChanged =
        dto.basePrice !== undefined &&
        before.basePrice.toString() !== roomType.basePrice.toString();
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: priceChanged ? 'room_type.price_update' : 'room_type.update',
          entityType: 'RoomType',
          entityId: id,
          oldValue: this.json(this.view(before)),
          newValue: this.json(this.view(roomType)),
        },
        transaction,
      );
      return this.view(roomType);
    });
  }

  async deactivate(id: string, actor: RequestUser) {
    return this.setActive(id, false, actor);
  }

  async restore(id: string, actor: RequestUser) {
    return this.setActive(id, true, actor);
  }

  private async setActive(id: string, isActive: boolean, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.roomType.findFirst({
        where: { id, hotelId: actor.hotelId },
        include: ROOM_TYPE_INCLUDE,
      });
      if (!before) this.notFound();
      if (!isActive) {
        await transaction.$queryRaw`
          SELECT "id" FROM "RoomType"
          WHERE "id" = ${id}::uuid AND "hotelId" = ${actor.hotelId}::uuid
          FOR UPDATE
        `;
        const activeRooms = await transaction.room.count({
          where: { hotelId: actor.hotelId, roomTypeId: id, isActive: true },
        });
        if (activeRooms > 0) {
          throw new ConflictException({
            code: 'ROOM_TYPE_HAS_ACTIVE_ROOMS',
            message: 'Move or deactivate active rooms before deactivating this room type.',
          });
        }
      }
      const roomType = await transaction.roomType.update({
        where: { id },
        data: { isActive },
        include: ROOM_TYPE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: isActive ? 'room_type.restore' : 'room_type.deactivate',
          entityType: 'RoomType',
          entityId: id,
          oldValue: this.json(this.view(before)),
          newValue: this.json(this.view(roomType)),
        },
        transaction,
      );
      return this.view(roomType);
    });
  }

  private async findHotelRoomType(id: string, hotelId: string) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, hotelId },
      include: ROOM_TYPE_INCLUDE,
    });
    if (!roomType) this.notFound();
    return roomType;
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'ROOM_TYPE_NOT_FOUND',
      message: 'Room type was not found.',
    });
  }

  private view<T extends { basePrice: { toString(): string } }>(roomType: T) {
    return { ...roomType, basePrice: roomType.basePrice.toString() };
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
