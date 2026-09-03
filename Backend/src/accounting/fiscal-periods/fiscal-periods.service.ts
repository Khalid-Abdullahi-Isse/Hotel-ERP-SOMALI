import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { FiscalPeriodStatus } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { runSerializable } from '../../common/database/serializable-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateFiscalPeriodDto } from './dto/create-fiscal-period.dto.js';
import type { ListFiscalPeriodsQueryDto } from './dto/list-fiscal-periods-query.dto.js';
import type { UpdateFiscalPeriodDto } from './dto/update-fiscal-period.dto.js';

@Injectable()
export class FiscalPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async list(query: ListFiscalPeriodsQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.FiscalPeriodWhereInput = {
      hotelId: actor.hotelId,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.fiscalPeriod.findMany({
        where,
        include: { _count: { select: { entries: true } } },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.fiscalPeriod.count({ where }),
    ]);
    return paginatedResponse(data, query.page, query.limit, total);
  }

  async find(id: string, actor: RequestUser) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: { _count: { select: { entries: true } } },
    });
    if (!period) this.notFound();
    return period;
  }

  create(dto: CreateFiscalPeriodDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      await this.assertNoOverlap(tx, actor.hotelId, dto.startDate, dto.endDate, undefined, dto.isOpening);
      const period = await tx.fiscalPeriod.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name.trim(),
          startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
          endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
          isOpening: dto.isOpening ?? false,
        },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.fiscal_period_created',
          entityType: 'FiscalPeriod',
          entityId: period.id,
          newValue: this.json(period),
        },
        tx,
      );
      return period;
    });
  }

  update(id: string, dto: UpdateFiscalPeriodDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const existing = await tx.fiscalPeriod.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!existing) this.notFound();
      const startDate = dto.startDate ?? this.date(existing.startDate);
      const endDate = dto.endDate ?? this.date(existing.endDate);
      const isOpening = dto.isOpening ?? existing.isOpening;
      if (startDate > endDate) this.invalidRange();
      await this.assertNoOverlap(
        tx,
        actor.hotelId,
        startDate,
        endDate,
        existing.id,
        isOpening,
      );
      if (existing.status === FiscalPeriodStatus.CLOSED && (dto.startDate || dto.endDate)) {
        throw new ConflictException({
          code: 'CLOSED_PERIOD_IMMUTABLE',
          message: 'A closed fiscal period cannot change its date range.',
        });
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          startDate: dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : undefined,
          endDate: dto.endDate ? new Date(`${dto.endDate}T00:00:00.000Z`) : undefined,
          isOpening: dto.isOpening,
        },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.fiscal_period_updated',
          entityType: 'FiscalPeriod',
          entityId: id,
          oldValue: this.json(existing),
          newValue: this.json(updated),
        },
        tx,
      );
      return updated;
    });
  }

  close(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "FiscalPeriod"
        WHERE "id"=${id}::uuid AND "hotelId"=${actor.hotelId}::uuid FOR UPDATE
      `;
      if (locked.length !== 1) this.notFound();
      const period = await tx.fiscalPeriod.findUniqueOrThrow({ where: { id } });
      if (period.status === FiscalPeriodStatus.CLOSED) return period;
      const posted = await tx.journalEntry.count({
        where: {
          fiscalPeriodId: id,
          status: { in: ['POSTED', 'REVERSED'] },
        },
      });
      const updated = await tx.fiscalPeriod.update({
        where: { id },
        data: { status: FiscalPeriodStatus.CLOSED },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.fiscal_period_closed',
          entityType: 'FiscalPeriod',
          entityId: id,
          oldValue: { status: FiscalPeriodStatus.OPEN, postedEntries: undefined },
          newValue: { status: FiscalPeriodStatus.CLOSED, postedEntries: posted },
        },
        tx,
      );
      return updated;
    });
  }

  reopen(id: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!period) this.notFound();
      if (period.status === FiscalPeriodStatus.OPEN) return period;
      if (period.isOpening) {
        throw new ConflictException({
          code: 'OPENING_PERIOD_LOCKED',
          message: 'The opening-balance period cannot be reopened.',
        });
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id },
        data: { status: FiscalPeriodStatus.OPEN },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.fiscal_period_reopened',
          entityType: 'FiscalPeriod',
          entityId: id,
          oldValue: { status: FiscalPeriodStatus.CLOSED },
          newValue: { status: FiscalPeriodStatus.OPEN },
        },
        tx,
      );
      return updated;
    });
  }

  async resolvePeriodForDate(
    tx: Prisma.TransactionClient,
    hotelId: string,
    businessDate: string,
    options: { allowCreate?: boolean } = {},
  ) {
    const date = new Date(`${businessDate}T00:00:00.000Z`);
    const period = await tx.fiscalPeriod.findFirst({
      where: { hotelId, startDate: { lte: date }, endDate: { gte: date } },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      select: { id: true, status: true },
    });
    if (period) return period;
    if (options.allowCreate) {
      const created = await tx.fiscalPeriod.create({
        data: {
          hotelId,
          name: this.defaultPeriodName(businessDate),
          startDate: this.periodStart(businessDate),
          endDate: this.periodEnd(businessDate),
          isOpening: false,
        },
        select: { id: true, status: true },
      });
      return created;
    }
    return null;
  }

  private periodStart(businessDate: string) {
    return new Date(`${businessDate.slice(0, 8)}01T00:00:00.000Z`);
  }

  private periodEnd(businessDate: string) {
    const year = Number(businessDate.slice(0, 4));
    const month = Number(businessDate.slice(5, 7)) - 1;
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    return new Date(`${lastDay.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  private defaultPeriodName(businessDate: string) {
    const [year, month] = businessDate.split('-');
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${names[Number(month) - 1]} ${year}`;
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    hotelId: string,
    startDate: string,
    endDate: string,
    excludeId: string | undefined,
    isOpening: boolean | undefined,
  ) {
    if (startDate > endDate) this.invalidRange();
    if (isOpening && startDate !== endDate) {
      throw new ConflictException({
        code: 'OPENING_PERIOD_SINGLE_DAY',
        message: 'An opening-balance period must be a single day.',
      });
    }
    const overlap = await tx.fiscalPeriod.findFirst({
      where: {
        hotelId,
        id: excludeId ? { not: excludeId } : undefined,
        startDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
      },
      select: { id: true, name: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: 'FISCAL_PERIOD_OVERLAP',
        message: `The ${startDate}..${endDate} range overlaps period "${overlap.name}".`,
      });
    }
  }

  private date(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private invalidRange(): never {
    throw new ConflictException({
      code: 'FISCAL_PERIOD_INVALID_RANGE',
      message: 'startDate must be on or before endDate.',
    });
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'FISCAL_PERIOD_NOT_FOUND', message: 'Fiscal period was not found.' });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
