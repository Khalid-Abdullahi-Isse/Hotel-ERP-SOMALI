import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { FiscalPeriodStatus, JournalEntryStatus } from '../../generated/prisma/enums.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountingPostingService } from './accounting-posting.service.js';
import { FiscalPeriodsService } from '../fiscal-periods/fiscal-periods.service.js';

jest.mock('../../common/database/serializable-transaction.js', () => ({
  runSerializable: (_prisma: unknown, fn: unknown) => (fn as (tx: unknown) => unknown)(_prisma),
}));

jest.mock('../../generated/prisma/client.js', () => {
  class PrismaClient {
    constructor() {}
  }
  class Decimal {
    readonly value: string;
    constructor(n: string | { toString(): string }) {
      this.value = n.toString();
    }
    toString() {
      return this.value;
    }
  }
  return { PrismaClient, Prisma: { Decimal } };
});

describe('AccountingPostingService fiscal-period enforcement', () => {
  const actor = {
    id: '10000000-0000-4000-8000-000000000001',
    hotelId: '20000000-0000-4000-8000-000000000001',
    permissions: [],
  } as unknown as RequestUser;

  type Tx = Prisma.TransactionClient;

  function serviceWith(
    tx: Partial<Record<keyof Prisma.TransactionClient, unknown>>,
    periods: { resolvePeriodForDate: jest.Mock },
  ) {
    const audits = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AccountingPostingService(
      tx as unknown as PrismaService,
      audits as unknown as AuditLogsService,
      periods as unknown as FiscalPeriodsService,
    );
    return {
      service,
      audits,
      create: (tx as { journalEntry: { create: jest.Mock } }).journalEntry.create,
    };
  }

  it('sets fiscalPeriodId on a draft from the resolved period', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
      hotel: { findUniqueOrThrow: jest.fn().mockResolvedValue({ currencyCode: 'USD' }) },
      accountingJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'journal-1' }),
      },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'a1', allowManualPosting: true },
            { id: 'a2', allowManualPosting: true },
          ]),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({
          id: 'entry-1',
          entryNumber: 'JE-2026-000001',
          sourceType: 'MANUAL',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      },
    };
    const periods = {
      resolvePeriodForDate: jest
        .fn()
        .mockResolvedValue({ id: 'period-1', status: FiscalPeriodStatus.OPEN }),
    };
    const { service } = serviceWith(tx, periods);

    await service.createManualDraft(
      {
        journalId: 'journal-1',
        businessDate: '2026-08-15',
        description: 'Test draft',
        lines: [
          { accountId: 'a1', debit: '100.00', credit: '0' },
          { accountId: 'a2', debit: '0', credit: '100.00' },
        ],
      },
      actor,
    );

    expect(periods.resolvePeriodForDate).toHaveBeenCalledWith(
      tx,
      actor.hotelId,
      '2026-08-15',
      { allowCreate: true },
    );
    const createPayload = (tx.journalEntry.create as jest.Mock).mock.calls[0][0];
    expect(createPayload.data.fiscalPeriodId).toBe('period-1');
  });

  it('rejects posting into a closed fiscal period', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'entry-1' }]),
      journalEntry: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'entry-1',
          status: JournalEntryStatus.DRAFT,
          businessDate: new Date('2026-08-15T00:00:00.000Z'),
          hotelId: actor.hotelId,
          journalId: 'journal-1',
          sourceType: 'HOTEL_ROOM_CHARGE',
          lines: [
            { accountId: 'a1', debit: '100.00', credit: '0' },
            { accountId: 'a2', debit: '0', credit: '100.00' },
          ],
        }),
      },
      accountingJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'journal-1' }),
      },
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'a1', allowManualPosting: true },
            { id: 'a2', allowManualPosting: true },
          ]),
      },
    };
    const periods = {
      resolvePeriodForDate: jest
        .fn()
        .mockResolvedValue({ id: 'period-1', status: FiscalPeriodStatus.CLOSED }),
    };
    const { service } = serviceWith(tx, periods);

    const error = await service
      .post('entry-1', actor)
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as { response?: { code?: string } }).response?.code).toBe('FISCAL_PERIOD_CLOSED');
  });
});
