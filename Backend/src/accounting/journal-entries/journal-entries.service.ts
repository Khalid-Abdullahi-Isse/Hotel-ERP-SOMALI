import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountingPostingService } from '../posting/accounting-posting.service.js';
import type { CreateJournalEntryDto } from './dto/create-journal-entry.dto.js';
import type { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto.js';

const LIST_INCLUDE = {
  journal: { select: { id: true, code: true, name: true, type: true } },
  postedBy: { select: { id: true, fullName: true } },
  lines: { select: { debit: true, credit: true } },
} as const;

const DETAIL_INCLUDE = {
  journal: { select: { id: true, code: true, name: true, type: true } },
  createdBy: { select: { id: true, fullName: true } },
  postedBy: { select: { id: true, fullName: true } },
  reversedBy: { select: { id: true, fullName: true } },
  reversedEntry: { select: { id: true, entryNumber: true } },
  reversalEntry: { select: { id: true, entryNumber: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.JournalEntryInclude;

@Injectable()
export class JournalEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: AccountingPostingService,
  ) {}

  create(dto: CreateJournalEntryDto, actor: RequestUser) {
    return this.posting.createManualDraft(dto, actor);
  }

  async list(query: ListJournalEntriesQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.JournalEntryWhereInput = {
      hotelId: actor.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.journalId ? { journalId: query.journalId } : {}),
      ...(query.accountId ? { lines: { some: { accountId: query.accountId } } } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            businessDate: {
              ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
              ...(query.dateTo ? { lte: new Date(`${query.dateTo}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { entryNumber: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ businessDate: 'desc' }, { entryNumber: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    const data = entries.map((entry) => {
      const totalDebit = entry.lines.reduce(
        (totalValue, line) => totalValue.plus(line.debit),
        new Prisma.Decimal(0),
      );
      const totalCredit = entry.lines.reduce(
        (totalValue, line) => totalValue.plus(line.credit),
        new Prisma.Decimal(0),
      );
      return {
        ...entry,
        lines: undefined,
        totalDebit: totalDebit.toFixed(4),
        totalCredit: totalCredit.toFixed(4),
        difference: totalDebit.minus(totalCredit).toFixed(4),
      };
    });
    return paginatedResponse(data, query.page, query.limit, total);
  }

  async find(id: string, actor: RequestUser) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: DETAIL_INCLUDE,
    });
    if (!entry) {
      throw new NotFoundException({
        code: 'JOURNAL_ENTRY_NOT_FOUND',
        message: 'Journal entry was not found.',
      });
    }
    const totalDebit = entry.lines.reduce(
      (totalValue, line) => totalValue.plus(line.debit),
      new Prisma.Decimal(0),
    );
    const totalCredit = entry.lines.reduce(
      (totalValue, line) => totalValue.plus(line.credit),
      new Prisma.Decimal(0),
    );
    return {
      ...entry,
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      difference: totalDebit.minus(totalCredit).toFixed(4),
    };
  }
}
