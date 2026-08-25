import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateJournalDto } from './dto/create-journal.dto.js';
import type { ListJournalsQueryDto } from './dto/list-journals-query.dto.js';
import type { UpdateJournalDto } from './dto/update-journal.dto.js';

@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async list(query: ListJournalsQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.AccountingJournalWhereInput = {
      hotelId: actor.hotelId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.accountingJournal.findMany({
        where,
        include: { _count: { select: { entries: true } } },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.accountingJournal.count({ where }),
    ]);
    return paginatedResponse(data, query.page, query.limit, total);
  }

  async create(dto: CreateJournalDto, actor: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.accountingJournal.create({
        data: { hotelId: actor.hotelId, ...dto },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.journal_created',
          entityType: 'AccountingJournal',
          entityId: journal.id,
          newValue: this.json(journal),
        },
        tx,
      );
      return journal;
    });
  }

  async update(id: string, dto: UpdateJournalDto, actor: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountingJournal.findFirst({
        where: { id, hotelId: actor.hotelId },
      });
      if (!existing) this.notFound();
      const updated = await tx.accountingJournal.update({ where: { id }, data: dto });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.journal_updated',
          entityType: 'AccountingJournal',
          entityId: id,
          oldValue: this.json(existing),
          newValue: this.json(updated),
        },
        tx,
      );
      return updated;
    });
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'JOURNAL_NOT_FOUND',
      message: 'Accounting journal was not found.',
    });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
