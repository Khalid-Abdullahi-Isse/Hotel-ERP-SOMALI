import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateFloorDto } from './dto/create-floor.dto.js';
import type { UpdateFloorDto } from './dto/update-floor.dto.js';

const FLOOR_INCLUDE = { _count: { select: { rooms: true } } } as const;

@Injectable()
export class FloorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateFloorDto, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const floor = await transaction.floor.create({
        data: { hotelId: actor.hotelId, number: dto.number, name: dto.name },
        include: FLOOR_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'floor.create',
          entityType: 'Floor',
          entityId: floor.id,
          newValue: this.json(floor),
        },
        transaction,
      );
      return floor;
    });
  }

  list(actor: RequestUser) {
    return this.prisma.floor.findMany({
      where: { hotelId: actor.hotelId },
      include: FLOOR_INCLUDE,
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string, actor: RequestUser) {
    return this.findHotelFloor(id, actor.hotelId);
  }

  async update(id: string, dto: UpdateFloorDto, actor: RequestUser) {
    const before = await this.findHotelFloor(id, actor.hotelId);
    return this.prisma.$transaction(async (transaction) => {
      const floor = await transaction.floor.update({
        where: { id },
        data: dto,
        include: FLOOR_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'floor.update',
          entityType: 'Floor',
          entityId: id,
          oldValue: this.json(before),
          newValue: this.json(floor),
        },
        transaction,
      );
      return floor;
    });
  }

  async remove(id: string, actor: RequestUser): Promise<{ id: string; deleted: true }> {
    return this.prisma.$transaction(async (transaction) => {
      const floor = await transaction.floor.findFirst({
        where: { id, hotelId: actor.hotelId },
        include: FLOOR_INCLUDE,
      });
      if (!floor) this.notFound();
      if (floor._count.rooms > 0) {
        throw new ConflictException({
          code: 'FLOOR_NOT_EMPTY',
          message: 'Move all rooms off this floor before deleting it.',
        });
      }
      await transaction.floor.delete({ where: { id } });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'floor.delete',
          entityType: 'Floor',
          entityId: id,
          oldValue: this.json(floor),
        },
        transaction,
      );
      return { id, deleted: true as const };
    });
  }

  private async findHotelFloor(id: string, hotelId: string) {
    const floor = await this.prisma.floor.findFirst({
      where: { id, hotelId },
      include: FLOOR_INCLUDE,
    });
    if (!floor) this.notFound();
    return floor;
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'FLOOR_NOT_FOUND', message: 'Floor was not found.' });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
