import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { FiscalPeriodStatus } from '../../generated/prisma/enums.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FiscalPeriodsService } from './fiscal-periods.service.js';

jest.mock('../../common/database/serializable-transaction.js', () => ({
  runSerializable: (_prisma: unknown, fn: unknown) => (fn as (tx: unknown) => unknown)(_prisma),
}));

jest.mock('../../generated/prisma/client.js', () => {
  class PrismaClient {
    constructor() {}
  }
  return { PrismaClient, Prisma: {} };
});

interface DraftArgData {
  hotelId: string;
  name: string;
  isOpening: boolean;
  startDate: Date;
  endDate: Date;
}

describe('FiscalPeriodsService', () => {
  const actor = {
    id: '10000000-0000-4000-8000-000000000001',
    hotelId: '20000000-0000-4000-8000-000000000001',
    permissions: [],
  } as unknown as RequestUser;

  type Tx = Prisma.TransactionClient;

  function build(tx: Partial<Record<keyof Prisma.TransactionClient, unknown>>) {
    const audits = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new FiscalPeriodsService(
      tx as unknown as PrismaService,
      audits as unknown as AuditLogsService,
    );
    return { service, audits };
  }

  describe('resolvePeriodForDate', () => {
    it('returns the matching period for a date', async () => {
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'period-1',
            status: FiscalPeriodStatus.OPEN,
          }),
        },
      };
      const { service } = build(tx);

      const result = await service.resolvePeriodForDate(tx as unknown as Tx, actor.hotelId, '2026-08-15', {
        allowCreate: true,
      });

      expect(result).toEqual({ id: 'period-1', status: 'OPEN' });
    });

    it('auto-creates a default month period when none matches and allowCreate is true', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ id: 'created', status: FiscalPeriodStatus.OPEN });
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      };
      const { service } = build(tx);

      const result = await service.resolvePeriodForDate(tx as unknown as Tx, actor.hotelId, '2026-08-15', {
        allowCreate: true,
      });

      expect(create).toHaveBeenCalledTimes(1);
      const createArg = (create.mock.calls as Array<[{ data: DraftArgData }]>)[0][0];
      const data = createArg.data;
      expect(data).toMatchObject({
        hotelId: actor.hotelId,
        name: 'August 2026',
        isOpening: false,
      });
      expect(data.startDate.toISOString()).toBe('2026-08-01T00:00:00.000Z');
      expect(data.endDate.toISOString()).toBe('2026-08-31T00:00:00.000Z');
      expect(result).toEqual({ id: 'created', status: 'OPEN' });
    });

    it('returns null when no period exists and allowCreate is false', async () => {
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const { service } = build(tx);

      const result = await service.resolvePeriodForDate(tx as unknown as Tx, actor.hotelId, '2026-08-15');
      expect(result).toBeNull();
    });
  });

  describe('close', () => {
    it('marks an OPEN period as CLOSED and records an audit entry', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'period-1' }]),
        fiscalPeriod: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'period-1',
            status: FiscalPeriodStatus.OPEN,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'period-1',
            status: FiscalPeriodStatus.CLOSED,
          }),
        },
        journalEntry: {
          count: jest.fn().mockResolvedValue(5),
        },
      };
      const { service, audits } = build(tx);

      const result = await service.close('period-1', actor);

      expect(result.status).toBe(FiscalPeriodStatus.CLOSED);
      expect(audits.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'accounting.fiscal_period_closed',
          entityId: 'period-1',
        }),
        tx,
      );
    });
  });

  describe('reopen', () => {
    it('rejects reopening an opening-balance period', async () => {
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'opening',
            status: FiscalPeriodStatus.CLOSED,
            isOpening: true,
          }),
        },
      };
      const { service } = build(tx);

      await expect(service.reopen('opening', actor)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('create', () => {
    it('creates a single-day opening period and audits it', async () => {
      const created = {
        id: 'opening',
        name: 'Opening',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        isOpening: true,
      };
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
      };
      const { service, audits } = build(tx);

      const result = await service.create(
        { name: 'Opening', startDate: '2026-01-01', endDate: '2026-01-01', isOpening: true },
        actor,
      );

      expect(result.id).toBe('opening');
      expect(audits.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.fiscal_period_created' }),
        tx,
      );
    });

    it('rejects an opening period spanning more than one day', async () => {
      const tx = {
        fiscalPeriod: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const { service } = build(tx);

      await expect(
        service.create(
          { name: 'Opening', startDate: '2026-01-01', endDate: '2026-01-02', isOpening: true },
          actor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
