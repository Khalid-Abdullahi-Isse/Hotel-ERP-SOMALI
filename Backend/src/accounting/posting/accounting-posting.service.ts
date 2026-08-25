import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { JournalEntryStatus } from '../../generated/prisma/enums.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { runSerializable } from '../../common/database/serializable-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { validateBalancedLines } from '../common/accounting-money.js';

export interface PostingLineInput {
  accountId: string;
  description?: string;
  debit: string;
  credit: string;
  sourceType?: string;
  sourceId?: string;
}

export interface AccountingEventInput {
  hotelId: string;
  actorId: string;
  journalId: string;
  businessDate: string;
  sourceType: string;
  sourceId: string;
  reference?: string;
  description: string;
  lines: PostingLineInput[];
}

const ENTRY_INCLUDE = {
  journal: { select: { id: true, code: true, name: true, type: true } },
  createdBy: { select: { id: true, fullName: true } },
  postedBy: { select: { id: true, fullName: true } },
  reversedBy: { select: { id: true, fullName: true } },
  lines: {
    include: {
      account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.JournalEntryInclude;

@Injectable()
export class AccountingPostingService {
  private readonly logger = new Logger(AccountingPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  createManualDraft(
    input: {
      journalId: string;
      businessDate: string;
      reference?: string;
      description: string;
      lines: PostingLineInput[];
    },
    actor: RequestUser,
  ) {
    return runSerializable(this.prisma, async (tx) => {
      validateBalancedLines(input.lines);
      await this.validateJournalAndAccounts(tx, actor.hotelId, input.journalId, input.lines, true);
      const entry = await this.createDraft(tx, {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: input.journalId,
        businessDate: input.businessDate,
        sourceType: 'MANUAL',
        reference: input.reference,
        description: input.description,
        lines: input.lines,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.journal_draft_created',
          entityType: 'JournalEntry',
          entityId: entry.id,
          newValue: { entryNumber: entry.entryNumber, sourceType: entry.sourceType },
        },
        tx,
      );
      return tx.journalEntry.findUniqueOrThrow({ where: { id: entry.id }, include: ENTRY_INCLUDE });
    });
  }

  post(entryId: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      await this.lockEntry(tx, entryId, actor.hotelId);
      const entry = await tx.journalEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: { lines: true, journal: true },
      });
      if (entry.status === JournalEntryStatus.POSTED) {
        return tx.journalEntry.findUniqueOrThrow({
          where: { id: entryId },
          include: ENTRY_INCLUDE,
        });
      }
      if (entry.status !== JournalEntryStatus.DRAFT) {
        throw new ConflictException({
          code: 'JOURNAL_ENTRY_NOT_DRAFT',
          message: 'Only a draft journal entry can be posted.',
        });
      }
      validateBalancedLines(entry.lines);
      await this.validateJournalAndAccounts(
        tx,
        actor.hotelId,
        entry.journalId,
        entry.lines,
        entry.sourceType === 'MANUAL',
      );
      const postedAt = new Date();
      await tx.journalEntry.update({
        where: { id: entryId },
        data: { status: JournalEntryStatus.POSTED, postedById: actor.id, postedAt },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.journal_posted',
          entityType: 'JournalEntry',
          entityId: entryId,
          oldValue: { status: JournalEntryStatus.DRAFT },
          newValue: { status: JournalEntryStatus.POSTED, postedAt: postedAt.toISOString() },
        },
        tx,
      );
      this.logger.log({ entryId, hotelId: actor.hotelId }, 'Journal entry posted');
      return tx.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: ENTRY_INCLUDE });
    });
  }

  reverse(entryId: string, reason: string, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      await this.lockEntry(tx, entryId, actor.hotelId);
      const original = await tx.journalEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: { lines: true },
      });
      if (original.status === JournalEntryStatus.REVERSED && original.reversalEntryId) {
        return tx.journalEntry.findUniqueOrThrow({
          where: { id: original.reversalEntryId },
          include: ENTRY_INCLUDE,
        });
      }
      if (original.status !== JournalEntryStatus.POSTED) {
        throw new ConflictException({
          code: 'INVALID_REVERSAL',
          message: 'Only a posted, unreversed journal entry can be reversed.',
        });
      }
      const reversal = await this.createDraft(tx, {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: original.journalId,
        businessDate: original.businessDate.toISOString().slice(0, 10),
        sourceType: 'REVERSAL',
        sourceId: original.id,
        reference: original.entryNumber,
        description: `Reversal of ${original.entryNumber}: ${reason.trim()}`,
        reversedEntryId: original.id,
        lines: original.lines.map((line) => ({
          accountId: line.accountId,
          description: line.description ?? undefined,
          debit: line.credit.toString(),
          credit: line.debit.toString(),
          sourceType: line.sourceType ?? undefined,
          sourceId: line.sourceId ?? undefined,
        })),
      });
      const now = new Date();
      await tx.journalEntry.update({
        where: { id: reversal.id },
        data: { status: JournalEntryStatus.POSTED, postedById: actor.id, postedAt: now },
      });
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalEntryStatus.REVERSED,
          reversalEntryId: reversal.id,
          reversalReason: reason.trim(),
          reversedById: actor.id,
          reversedAt: now,
        },
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.journal_reversed',
          entityType: 'JournalEntry',
          entityId: original.id,
          oldValue: { status: JournalEntryStatus.POSTED },
          newValue: {
            status: JournalEntryStatus.REVERSED,
            reversalEntryId: reversal.id,
            reason: reason.trim(),
          },
        },
        tx,
      );
      this.logger.warn(
        { entryId, reversalEntryId: reversal.id, hotelId: actor.hotelId },
        'Journal entry reversed',
      );
      return tx.journalEntry.findUniqueOrThrow({
        where: { id: reversal.id },
        include: ENTRY_INCLUDE,
      });
    });
  }

  async postEvent(input: AccountingEventInput, tx: Prisma.TransactionClient) {
    const existing = await tx.journalEntry.findUnique({
      where: {
        hotelId_sourceType_sourceId: {
          hotelId: input.hotelId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      include: ENTRY_INCLUDE,
    });
    if (existing) return { idempotentReplay: true, entry: existing };

    validateBalancedLines(input.lines);
    await this.validateJournalAndAccounts(tx, input.hotelId, input.journalId, input.lines, false);
    const draft = await this.createDraft(tx, input);
    const postedAt = new Date();
    await tx.journalEntry.update({
      where: { id: draft.id },
      data: { status: JournalEntryStatus.POSTED, postedById: input.actorId, postedAt },
    });
    await this.audits.record(
      {
        hotelId: input.hotelId,
        userId: input.actorId,
        action: 'accounting.event_posted',
        entityType: 'JournalEntry',
        entityId: draft.id,
        newValue: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          entryNumber: draft.entryNumber,
        },
      },
      tx,
    );
    return {
      idempotentReplay: false,
      entry: await tx.journalEntry.findUniqueOrThrow({
        where: { id: draft.id },
        include: ENTRY_INCLUDE,
      }),
    };
  }

  private async createDraft(
    tx: Prisma.TransactionClient,
    input: {
      hotelId: string;
      actorId: string;
      journalId: string;
      businessDate: string;
      sourceType: string;
      sourceId?: string;
      reference?: string;
      description: string;
      reversedEntryId?: string;
      lines: PostingLineInput[];
    },
  ) {
    const hotel = await tx.hotel.findUniqueOrThrow({
      where: { id: input.hotelId },
      select: { currencyCode: true },
    });
    const entryNumber = await this.nextEntryNumber(tx, input.hotelId, input.businessDate);
    return tx.journalEntry.create({
      data: {
        hotelId: input.hotelId,
        journalId: input.journalId,
        entryNumber,
        businessDate: new Date(`${input.businessDate}T00:00:00.000Z`),
        postingDate: new Date(),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reference: input.reference?.trim(),
        description: input.description.trim(),
        createdById: input.actorId,
        reversedEntryId: input.reversedEntryId,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            description: line.description?.trim(),
            debit: new Prisma.Decimal(line.debit),
            credit: new Prisma.Decimal(line.credit),
            currency: hotel.currencyCode,
            sourceType: line.sourceType,
            sourceId: line.sourceId,
          })),
        },
      },
    });
  }

  private async nextEntryNumber(
    tx: Prisma.TransactionClient,
    hotelId: string,
    businessDate: string,
  ) {
    const year = businessDate.slice(0, 4);
    const key = `JOURNAL_ENTRY:${year}`;
    await tx.$executeRaw`
      INSERT INTO "AccountingSequence" ("hotelId", "key", "nextValue", "updatedAt")
      VALUES (${hotelId}::uuid, ${key}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("hotelId", "key") DO NOTHING
    `;
    const rows = await tx.$queryRaw<Array<{ value: bigint }>>`
      UPDATE "AccountingSequence"
      SET "nextValue" = "nextValue" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "hotelId" = ${hotelId}::uuid AND "key" = ${key}
      RETURNING "nextValue" - 1 AS value
    `;
    const sequence = rows[0]?.value;
    if (sequence === undefined) throw new Error('Accounting entry sequence was not allocated.');
    return `JE-${year}-${sequence.toString().padStart(6, '0')}`;
  }

  private async validateJournalAndAccounts(
    tx: Prisma.TransactionClient,
    hotelId: string,
    journalId: string,
    lines: readonly { accountId: string }[],
    manual: boolean,
  ) {
    const journal = await tx.accountingJournal.findFirst({
      where: { id: journalId, hotelId, isActive: true },
      select: { id: true },
    });
    if (!journal) {
      throw new ConflictException({
        code: 'JOURNAL_INACTIVE',
        message: 'The selected accounting journal is inactive or unavailable.',
      });
    }
    const ids = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await tx.account.findMany({
      where: { id: { in: ids }, hotelId, isActive: true },
      select: { id: true, allowManualPosting: true },
    });
    if (accounts.length !== ids.length) {
      throw new ConflictException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Every journal line account must be active and belong to the hotel.',
      });
    }
    if (manual && accounts.some((account) => !account.allowManualPosting)) {
      throw new ConflictException({
        code: 'MANUAL_POSTING_NOT_ALLOWED',
        message: 'One or more accounts do not allow manual posting.',
      });
    }
  }

  private async lockEntry(tx: Prisma.TransactionClient, id: string, hotelId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "JournalEntry" WHERE "id"=${id}::uuid AND "hotelId"=${hotelId}::uuid FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new NotFoundException({
        code: 'JOURNAL_ENTRY_NOT_FOUND',
        message: 'Journal entry was not found.',
      });
    }
  }
}
