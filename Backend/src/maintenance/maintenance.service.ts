import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { MaintenanceStatus, ReservationStatus, RoomStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto.js';
import type { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto.js';
const INCLUDE = {
  room: { select: { id: true, roomNumber: true, status: true } },
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}
  async list(query: ListMaintenanceQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.MaintenanceRequestWhereInput = {
      hotelId: actor.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(search
        ? {
            OR: [
              { problem: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              { room: { roomNumber: { contains: search, mode: 'insensitive' } } },
              { assignedTo: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [values, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return paginatedResponse(values.map((v) => this.view(v)), query.page, query.limit, total);
  }
  async find(id: string, actor: RequestUser) {
    const v = await this.prisma.maintenanceRequest.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: INCLUDE,
    });
    if (!v) this.notFound();
    return this.view(v);
  }
  create(dto: CreateMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const room = await tx.room.findFirst({ where: { id: dto.roomId, hotelId: actor.hotelId } });
      if (!room)
        throw new ConflictException({
          code: 'INVALID_MAINTENANCE_ROOM',
          message: 'Room is invalid or belongs to another hotel.',
        });
      await this.assignee(tx, dto.assignedToId, actor.hotelId);
      const value = await tx.maintenanceRequest.create({
        data: {
          hotelId: actor.hotelId,
          roomId: dto.roomId,
          assignedToId: dto.assignedToId,
          createdById: actor.id,
          problem: dto.problem.trim(),
          notes: dto.notes?.trim(),
        },
        include: INCLUDE,
      });
      await this.audit(tx, actor, 'maintenance.create', value.id, undefined, {
        roomId: value.roomId,
        problem: value.problem,
      });
      return this.view(value);
    });
  }
  update(id: string, dto: UpdateMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await tx.maintenanceRequest.findFirst({
        where: { id, hotelId: actor.hotelId },
      });
      if (!before) this.notFound();
      if (before.status === MaintenanceStatus.DONE)
        throw new ConflictException({
          code: 'MAINTENANCE_COMPLETED',
          message: 'Completed maintenance cannot be edited.',
        });
      if (dto.roomId && dto.roomId !== before.roomId)
        throw new ConflictException({
          code: 'MAINTENANCE_ROOM_IMMUTABLE',
          message: 'Create a new request for another room.',
        });
      await this.assignee(tx, dto.assignedToId, actor.hotelId);
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          assignedToId: dto.assignedToId,
          problem: dto.problem?.trim(),
          notes: dto.notes?.trim(),
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.update',
        id,
        { assignedToId: before.assignedToId, problem: before.problem },
        { assignedToId: value.assignedToId, problem: value.problem },
      );
      return this.view(value);
    });
  }
  start(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status === MaintenanceStatus.IN_PROGRESS)
        return this.view(
          await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, include: INCLUDE }),
        );
      if (request.status !== MaintenanceStatus.OPEN) this.invalid();
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${request.roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUniqueOrThrow({ where: { id: request.roomId } });
      if (room.status !== RoomStatus.AVAILABLE && room.status !== RoomStatus.DIRTY)
        throw new ConflictException({
          code: 'ROOM_NOT_READY_FOR_MAINTENANCE',
          message: 'Room must be available or dirty before maintenance starts.',
        });
      const bookings = await tx.reservationRoom.count({
        where: {
          roomId: room.id,
          bookingStatus: {
            in: [
              ReservationStatus.PENDING,
              ReservationStatus.CONFIRMED,
              ReservationStatus.CHECKED_IN,
            ],
          },
        },
      });
      const cleaning = await tx.housekeepingTask.count({
        where: { roomId: room.id, status: { in: ['DIRTY', 'CLEANING'] } },
      });
      if (bookings || cleaning)
        throw new ConflictException({
          code: 'ROOM_HAS_ACTIVE_WORK_OR_BOOKING',
          message: 'Move bookings and finish cleaning workflow before maintenance.',
        });
      const now = new Date();
      await tx.room.update({ where: { id: room.id }, data: { status: RoomStatus.MAINTENANCE } });
      await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.IN_PROGRESS,
          startedAt: now,
          previousRoomStatus: room.status,
          assignedToId: request.assignedToId ?? actor.id,
        },
      });
      await this.audit(
        tx,
        actor,
        'maintenance.start',
        id,
        { status: request.status, roomStatus: room.status },
        { status: MaintenanceStatus.IN_PROGRESS, roomStatus: RoomStatus.MAINTENANCE },
      );
      return this.view(
        await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, include: INCLUDE }),
      );
    });
  }
  complete(id: string, dto: CompleteMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status === MaintenanceStatus.DONE)
        return this.view(
          await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, include: INCLUDE }),
        );
      if (request.status !== MaintenanceStatus.IN_PROGRESS || !request.previousRoomStatus)
        this.invalid();
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${request.roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUniqueOrThrow({ where: { id: request.roomId } });
      if (room.status !== RoomStatus.MAINTENANCE)
        throw new ConflictException({
          code: 'ROOM_STATE_CONFLICT',
          message: 'Room is no longer in maintenance state.',
        });
      const target =
        request.previousRoomStatus === RoomStatus.DIRTY ? RoomStatus.DIRTY : RoomStatus.AVAILABLE;
      await tx.room.update({ where: { id: room.id }, data: { status: target } });
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.DONE,
          completedAt: new Date(),
          cost: dto.cost,
          notes: dto.notes?.trim() ?? request.notes,
        },
        include: INCLUDE,
      });
      if (target === RoomStatus.DIRTY)
        await tx.housekeepingTask.create({
          data: {
            hotelId: actor.hotelId,
            roomId: room.id,
            notes: 'Cleaning required after maintenance.',
          },
        });
      await this.audit(
        tx,
        actor,
        'maintenance.complete',
        id,
        { status: request.status },
        { status: value.status, cost: value.cost?.toString() ?? null, roomStatus: target },
      );
      return this.view(value);
    });
  }
  private async lock(tx: Prisma.TransactionClient, id: string, hotelId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "MaintenanceRequest" WHERE "id"=${id}::uuid AND "hotelId"=${hotelId}::uuid FOR UPDATE`;
    if (rows.length !== 1) this.notFound();
    return tx.maintenanceRequest.findUniqueOrThrow({ where: { id } });
  }
  private async assignee(tx: Prisma.TransactionClient, id: string | undefined, hotelId: string) {
    if (!id) return;
    const user = await tx.user.findFirst({ where: { id, hotelId, status: 'ACTIVE' } });
    if (!user)
      throw new ConflictException({
        code: 'INVALID_MAINTENANCE_ASSIGNEE',
        message: 'Assignee must be an active hotel user.',
      });
  }
  private view<T extends { cost: { toString(): string } | null }>(v: T) {
    return { ...v, cost: v.cost?.toString() ?? null };
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: string,
    id: string,
    oldValue: object | undefined,
    newValue: object,
  ) {
    await this.audits.record(
      {
        hotelId: actor.hotelId,
        userId: actor.id,
        action,
        entityType: 'MaintenanceRequest',
        entityId: id,
        ...(oldValue ? { oldValue } : {}),
        newValue,
      },
      tx,
    );
  }
  private invalid(): never {
    throw new ConflictException({
      code: 'INVALID_MAINTENANCE_TRANSITION',
      message: 'Maintenance request is not in the required state.',
    });
  }
  private notFound(): never {
    throw new NotFoundException({
      code: 'MAINTENANCE_NOT_FOUND',
      message: 'Maintenance request was not found.',
    });
  }
}
