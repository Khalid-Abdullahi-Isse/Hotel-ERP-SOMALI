import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  ExpenseStatus,
  HousekeepingStatus,
  MaintenancePriority,
  MaintenanceStatus,
  ReservationStatus,
  RoomStatus,
} from '../generated/prisma/enums.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import { runSerializable } from '../common/database/serializable-transaction.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExpenseAccountingService } from '../accounting/expense-accounting.service.js';
import type {
  AssignMaintenanceDto,
  CancelMaintenanceDto,
  CloseMaintenanceDto,
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  HoldMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto.js';
import type { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto.js';
const INCLUDE = {
  room: { select: { id: true, roomNumber: true, status: true } },
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  completedBy: { select: { id: true, fullName: true } },
  verifiedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
} as const;
@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
    private readonly expenseAccounting: ExpenseAccountingService,
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
          category: dto.category?.trim(),
          priority: dto.priority ?? MaintenancePriority.MEDIUM,
          assignedAt: dto.assignedToId ? new Date() : undefined,
        },
        include: INCLUDE,
      });
      await this.audit(tx, actor, 'maintenance.create', value.id, undefined, {
        roomId: value.roomId,
        problem: value.problem,
        category: value.category ?? null,
        priority: value.priority,
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
      if (this.terminal(before.status) || before.status === MaintenanceStatus.IN_PROGRESS)
        throw new ConflictException({
          code: 'MAINTENANCE_NOT_EDITABLE',
          message: 'Only open, assigned or on-hold maintenance can be edited.',
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
          category: dto.category?.trim(),
          priority: dto.priority,
          assignedAt:
            dto.assignedToId && !before.assignedToId ? new Date() : undefined,
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.update',
        id,
        this.json({
          assignedToId: before.assignedToId,
          problem: before.problem,
          category: before.category,
          priority: before.priority,
        }),
        this.json({
          assignedToId: value.assignedToId,
          problem: value.problem,
          category: value.category,
          priority: value.priority,
        }),
      );
      return this.view(value);
    });
  }
  assign(id: string, dto: AssignMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.OPEN)
        this.invalid('Only an open maintenance request can be assigned.');
      await this.assignee(tx, dto.assignedToId, actor.hotelId);
      if (request.assignedToId === dto.assignedToId)
        return this.view(
          await tx.maintenanceRequest.findUniqueOrThrow({ where: { id }, include: INCLUDE }),
        );
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.ASSIGNED,
          assignedToId: dto.assignedToId,
          assignedAt: new Date(),
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.assign',
        id,
        { status: request.status, assignedToId: request.assignedToId },
        { status: value.status, assignedToId: value.assignedToId, assignedAt: value.assignedAt?.toISOString() ?? null },
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
      if (request.status !== MaintenanceStatus.OPEN && request.status !== MaintenanceStatus.ASSIGNED)
        this.invalid('Only an open or assigned maintenance request can be started.');
      await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${request.roomId}::uuid FOR UPDATE`;
      const room = await tx.room.findUniqueOrThrow({ where: { id: request.roomId } });
      if (room.status !== RoomStatus.AVAILABLE && room.status !== RoomStatus.DIRTY)
        throw new ConflictException({
          code: 'ROOM_NOT_READY_FOR_MAINTENANCE',
          message: 'Room must be available or dirty before maintenance starts.',
        });
      const activeBookings = await tx.reservationRoom.findMany({
        where: {
          roomId: room.id,
          bookingStatus: {
            in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
        },
        select: { reservationId: true, bookingStatus: true },
      });
      if (activeBookings.some((b) => b.bookingStatus === ReservationStatus.CHECKED_IN))
        throw new ConflictException({
          code: 'ROOM_HAS_ACTIVE_WORK_OR_BOOKING',
          message: 'Guest is currently checked in. Check out before starting maintenance.',
        });
      const reservationIds = [...new Set(activeBookings.map((b) => b.reservationId))];
      const now = new Date();
      if (reservationIds.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: reservationIds } },
          data: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: now,
            cancellationNote: 'Auto-cancelled: maintenance started.',
          },
        });
      }
      await tx.housekeepingTask.updateMany({
        where: { roomId: room.id, status: HousekeepingStatus.DIRTY },
        data: { status: HousekeepingStatus.CLEANING, startedAt: now },
      });
      await tx.housekeepingTask.updateMany({
        where: { roomId: room.id, status: HousekeepingStatus.CLEANING },
        data: { status: HousekeepingStatus.COMPLETED, completedAt: now },
      });
      await tx.room.update({ where: { id: room.id }, data: { status: RoomStatus.MAINTENANCE } });
      await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.IN_PROGRESS,
          startedAt: now,
          previousRoomStatus: room.status,
          assignedToId: request.assignedToId ?? actor.id,
          assignedAt: request.assignedAt ?? now,
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
  hold(id: string, dto: HoldMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.IN_PROGRESS)
        this.invalid('Only in-progress maintenance can be put on hold.');
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.ON_HOLD,
          heldAt: new Date(),
          resumedAt: null,
          notes: dto.reason?.trim() ?? request.notes,
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.hold',
        id,
        { status: request.status },
        { status: value.status, heldAt: value.heldAt?.toISOString() ?? null, reason: dto.reason?.trim() ?? null },
      );
      return this.view(value);
    });
  }
  resume(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.ON_HOLD)
        this.invalid('Only on-hold maintenance can be resumed.');
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: { status: MaintenanceStatus.IN_PROGRESS, resumedAt: new Date() },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.resume',
        id,
        { status: request.status },
        { status: value.status, resumedAt: value.resumedAt?.toISOString() ?? null },
      );
      return this.view(value);
    });
  }
  complete(id: string, dto: CompleteMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.IN_PROGRESS)
        this.invalid('Only in-progress maintenance can be completed.');
      const now = new Date();
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.COMPLETED,
          completedAt: now,
          completedById: actor.id,
          cost: dto.cost ? new Prisma.Decimal(dto.cost) : request.cost,
          notes: dto.notes?.trim() ?? request.notes,
        },
        include: INCLUDE,
      });
      let expenseId: string | null = null;
      if (value.cost && value.cost.gt(0)) {
        expenseId = await this.createMaintenanceExpense(
          tx,
          {
            id: value.id,
            roomId: value.roomId,
            hotelId: value.hotelId,
            problem: value.problem,
            cost: value.cost,
            completedAt: value.completedAt,
          },
          actor,
        );
      }
      await this.audit(
        tx,
        actor,
        'maintenance.complete',
        id,
        { status: request.status },
        this.json({
          status: value.status,
          completedById: actor.id,
          cost: value.cost?.toString() ?? null,
          expenseId,
        }),
      );
      return this.view(value);
    });
  }
  verify(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.COMPLETED)
        this.invalid('Only completed maintenance can be verified.');
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: { status: MaintenanceStatus.VERIFIED, verifiedAt: new Date(), verifiedById: actor.id },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.verify',
        id,
        { status: request.status },
        { status: value.status, verifiedById: actor.id, verifiedAt: value.verifiedAt?.toISOString() ?? null },
      );
      return this.view(value);
    });
  }
  close(id: string, dto: CloseMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (request.status !== MaintenanceStatus.VERIFIED)
        this.invalid('Only verified maintenance can be closed and return the room to service.');
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
          status: MaintenanceStatus.CLOSED,
          closedAt: new Date(),
          closedById: actor.id,
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
        'maintenance.close',
        id,
        { status: request.status, roomStatus: room.status },
        { status: value.status, closedById: actor.id, roomStatus: target },
      );
      return this.view(value);
    });
  }
  cancel(id: string, dto: CancelMaintenanceDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const request = await this.lock(tx, id, actor.hotelId);
      if (
        request.status !== MaintenanceStatus.OPEN &&
        request.status !== MaintenanceStatus.ASSIGNED &&
        request.status !== MaintenanceStatus.IN_PROGRESS &&
        request.status !== MaintenanceStatus.ON_HOLD
      )
        this.invalid('Maintenance cannot be cancelled in this state.');
      if (request.status === MaintenanceStatus.IN_PROGRESS || request.status === MaintenanceStatus.ON_HOLD) {
        await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${request.roomId}::uuid FOR UPDATE`;
        const room = await tx.room.findUniqueOrThrow({ where: { id: request.roomId } });
        if (room.status === RoomStatus.MAINTENANCE && request.previousRoomStatus) {
          await tx.room.update({
            where: { id: room.id },
            data: { status: request.previousRoomStatus },
          });
        }
      }
      const value = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: actor.id,
          cancelReason: dto.reason.trim(),
        },
        include: INCLUDE,
      });
      await this.audit(
        tx,
        actor,
        'maintenance.cancel',
        id,
        { status: request.status },
        { status: value.status, cancelledById: actor.id, cancelReason: value.cancelReason },
      );
      return this.view(value);
    });
  }
  private async createMaintenanceExpense(
    tx: Prisma.TransactionClient,
    request: { id: string; roomId: string; hotelId: string; problem: string; cost: Prisma.Decimal; completedAt: Date | null },
    actor: RequestUser,
  ) {
    let category = await tx.expenseCategory.findFirst({
      where: { hotelId: actor.hotelId, name: { equals: 'Maintenance', mode: 'insensitive' }, isActive: true },
      select: { id: true, expenseAccountId: true },
    });
    if (!category) {
      category = await tx.expenseCategory.create({
        data: { hotelId: actor.hotelId, name: 'Maintenance' },
        select: { id: true, expenseAccountId: true },
      });
    }
    const now = new Date();
    const expense = await tx.expense.create({
      data: {
        hotelId: actor.hotelId,
        categoryId: category.id,
        createdById: actor.id,
        requestKey: randomUUID(),
        status: ExpenseStatus.APPROVED,
        amount: request.cost,
        expenseDate: request.completedAt ?? now,
        description: `Maintenance: ${request.problem}`,
        submittedAt: now,
        approvedAt: now,
        approvedById: actor.id,
        maintenanceId: request.id,
      },
      select: { id: true, amount: true, expenseDate: true, description: true, paymentMethodId: true },
    });
    await this.expenseAccounting.postExpense(
      {
        id: expense.id,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        description: expense.description,
        reference: null,
        expenseAccountId: category.expenseAccountId ?? null,
        paymentAccountId: null,
        hasPaymentMethod: false,
      },
      actor,
      tx,
    );
    return expense.id;
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
  private terminal(status: MaintenanceStatus) {
    return (
      status === MaintenanceStatus.COMPLETED ||
      status === MaintenanceStatus.VERIFIED ||
      status === MaintenanceStatus.CLOSED ||
      status === MaintenanceStatus.CANCELLED
    );
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
  private invalid(message = 'Maintenance request is not in the required state.'): never {
    throw new ConflictException({
      code: 'INVALID_MAINTENANCE_TRANSITION',
      message,
    });
  }
  private notFound(): never {
    throw new NotFoundException({
      code: 'MAINTENANCE_NOT_FOUND',
      message: 'Maintenance request was not found.',
    });
  }
  private json(v: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonObject;
  }
}
