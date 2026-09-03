import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../../common/pagination/pagination.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountingPostingService } from '../posting/accounting-posting.service.js';
import type { CreateJournalEntryDto } from './dto/create-journal-entry.dto.js';
import type { CreateOpeningBalanceDto } from './dto/create-opening-balance.dto.js';
import type { ListJournalEntriesQueryDto } from './dto/list-journal-entries-query.dto.js';

const LIST_INCLUDE = {
  journal: { select: { id: true, code: true, name: true, type: true } },
  fiscalPeriod: { select: { id: true, name: true, status: true } },
  postedBy: { select: { id: true, fullName: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.JournalEntryInclude;

const DETAIL_INCLUDE = {
  journal: { select: { id: true, code: true, name: true, type: true } },
  fiscalPeriod: { select: { id: true, name: true, status: true } },
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

  createOpeningBalance(dto: CreateOpeningBalanceDto, actor: RequestUser) {
    return this.prisma.$transaction(async (tx) =>
      this.posting.postEvent(
        {
          hotelId: actor.hotelId,
          actorId: actor.id,
          journalId: dto.journalId,
          businessDate: dto.businessDate,
          sourceType: 'OPENING_BALANCE',
          sourceId: dto.sourceId,
          reference: dto.reference,
          description: dto.description,
          lines: dto.lines,
        },
        tx,
      ),
    );
  }

  async list(query: ListJournalEntriesQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const description = query.description?.trim();

    const lineMatch: Prisma.JournalLineWhereInput = {
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.accountCode
        ? { account: { code: { equals: query.accountCode, mode: 'insensitive' } } }
        : {}),
      ...(query.currency ? { currency: { equals: query.currency, mode: 'insensitive' } } : {}),
      ...(query.debit !== undefined ? { debit: new Prisma.Decimal(String(query.debit)) } : {}),
      ...(query.credit !== undefined ? { credit: new Prisma.Decimal(String(query.credit)) } : {}),
    };

    const hasLineMatch = Object.keys(lineMatch).length > 0;

    const where: Prisma.JournalEntryWhereInput = {
      hotelId: actor.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.journalId ? { journalId: query.journalId } : {}),
      ...(hasLineMatch ? { lines: { some: lineMatch } } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            postingDate: {
              ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
              ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(description
        ? {
            OR: [
              { description: { contains: description, mode: 'insensitive' } },
              { lines: { some: { description: { contains: description, mode: 'insensitive' } } } },
            ],
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
        orderBy:
          query.order === 'asc'
            ? [{ businessDate: 'asc' }, { postingDate: 'asc' }, { entryNumber: 'asc' }]
            : [{ businessDate: 'desc' }, { postingDate: 'desc' }, { entryNumber: 'desc' }],
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
        lines: entry.lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          description: line.description,
          debit: line.debit.toFixed(4),
          credit: line.credit.toFixed(4),
          currency: line.currency,
          exchangeRate: line.exchangeRate.toFixed(8),
          createdAt: line.createdAt.toISOString(),
          account: line.account,
        })),
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
      lines: entry.lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        description: line.description,
        debit: line.debit.toFixed(4),
        credit: line.credit.toFixed(4),
        currency: line.currency,
        exchangeRate: line.exchangeRate.toFixed(8),
        createdAt: line.createdAt.toISOString(),
        account: line.account,
      })),
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      difference: totalDebit.minus(totalCredit).toFixed(4),
    };
  }
}
