import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HousekeepingStatus, MaintenanceStatus, RoomStatus } from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { HousekeepingUpdateDto } from './dto/housekeeping.dto.js';
const INCLUDE = {
  room: {
    select: {
      id: true,
      roomNumber: true,
      status: true,
      floor: { select: { number: true, name: true } },
    },
  },
  assignedTo: { select: { id: true, fullName: true } },
  reservation: { select: { id: true, bookingNumber: true } },
} as const;
@Injectable()
export class HousekeepingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}
  async list(actor: RequestUser) {
    return this.prisma.housekeepingTask.findMany({
      where: { hotelId: actor.hotelId },
      include: INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }
  async find(id: string, actor: RequestUser) {
    const value = await this.prisma.housekeepingTask.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: INCLUDE,
    });
    if (!value) this.notFound();
    return value;
  }
  update(id: string, dto: HousekeepingUpdateDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const before = await tx.housekeepingTask.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!before) this.notFound();
      if (before.status === HousekeepingStatus.COMPLETED)
        throw new ConflictException({
          code: 'HOUSEKEEPING_ALREADY_COMPLETED',
          message: 'Completed cleaning tasks cannot be edited.',
        });
      if (dto.assignedToId) {
        const user = await tx.user.findFirst({
          where: { id: dto.assignedToId, hotelId: actor.hotelId, status: 'ACTIVE' },
        });
        if (!user)
          throw new ConflictException({
            code: 'INVALID_HOUSEKEEPING_ASSIGNEE',
            message: 'Assignee must be an active hotel user.',
          });
      }
      const value = await tx.housekeepingTask.update({
        where: { id },
        data: dto,
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'housekeeping.update',
        id,
        { assignedToId: before.assignedToId, notes: before.notes },
        { assignedToId: value.assignedToId, notes: value.notes },
      );
      return value;
    });
  }
  start(id: string, actor: RequestUser) {
    return this.transition(id, HousekeepingStatus.CLEANING, actor);
  }
  complete(id: string, actor: RequestUser) {
    return this.transition(id, HousekeepingStatus.COMPLETED, actor);
  }
  private transition(id: string, target: HousekeepingStatus, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ roomId: string }>
      >`SELECT "roomId" FROM "HousekeepingTask" WHERE "id"=${id}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE`;
      if (rows.length !== 1) this.notFound();
      const roomId = rows[0].roomId;
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${roomId}::uuid FOR UPDATE`;
      const task = await tx.housekeepingTask.findUniqueOrThrow({ where: { id } });
      if (target === HousekeepingStatus.CLEANING) {
        if (task.status === target)
          return tx.housekeepingTask.findUniqueOrThrow({ where: { id }, include: INCLUDE });
        if (task.status !== HousekeepingStatus.DIRTY) this.invalid();
        const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
        if (room.status !== RoomStatus.DIRTY)
          throw new ConflictException({
            code: 'ROOM_NOT_DIRTY',
            message: 'Room must be dirty before cleaning starts.',
          });
        await tx.room.update({ where: { id: roomId }, data: { status: RoomStatus.CLEANING } });
        await tx.housekeepingTask.update({
          where: { id },
          data: {
            status: target,
            startedAt: new Date(),
            assignedToId: task.assignedToId ?? actor.id,
          },
        });
      } else {
        if (task.status === target)
          return tx.housekeepingTask.findUniqueOrThrow({ where: { id }, include: INCLUDE });
        if (task.status !== HousekeepingStatus.CLEANING) this.invalid();
        const activeMaintenance = await tx.maintenanceRequest.count({
          where: {
            roomId,
            status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS] },
          },
        });
        if (activeMaintenance)
          throw new ConflictException({
            code: 'ROOM_HAS_MAINTENANCE',
            message: 'Complete maintenance before releasing this room.',
          });
        await tx.room.update({ where: { id: roomId }, data: { status: RoomStatus.AVAILABLE } });
        await tx.housekeepingTask.update({
          where: { id },
          data: { status: target, completedAt: new Date() },
        });
      }
      await this.audit(
        tx,
        actor,
        `housekeeping.${target.toLowerCase()}`,
        id,
        { status: task.status },
        { status: target, roomId },
      );
      return tx.housekeepingTask.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
  }
  private async audit(
    tx: import('../generated/prisma/client.js').Prisma.TransactionClient,
    actor: RequestUser,
    action: string,
    id: string,
    oldValue: object,
    newValue: object,
  ) {
    await this.audits.record(
      {
        hotelId: actor.hotelId,
        userId: actor.id,
        action,
        entityType: 'HousekeepingTask',
        entityId: id,
        oldValue,
        newValue,
      },
      tx,
    );
  }
  private invalid(): never {
    throw new ConflictException({
      code: 'INVALID_HOUSEKEEPING_TRANSITION',
      message: 'Cleaning task is not in the required state.',
    });
  }
  private notFound(): never {
    throw new NotFoundException({
      code: 'HOUSEKEEPING_TASK_NOT_FOUND',
      message: 'Housekeeping task was not found.',
    });
  }
}
