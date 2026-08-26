import { Decimal } from '@prisma/client-runtime-utils';
import type { Prisma } from '../generated/prisma/client.js';
import { ChargeType } from '../generated/prisma/enums.js';
import type { RequestUser } from '../auth/auth.types.js';
import { GuestAccountingService } from './guest-accounting.service.js';
import type { AccountingPostingService } from './posting/accounting-posting.service.js';

jest.mock('../generated/prisma/client.js', () => {
  const runtime = jest.requireActual<typeof import('@prisma/client-runtime-utils')>(
    '@prisma/client-runtime-utils',
  );
  return { Prisma: { Decimal: runtime.Decimal } };
});
jest.mock('./posting/accounting-posting.service.js', () => ({
  AccountingPostingService: class {},
}));

describe('GuestAccountingService', () => {
  type PostedEvent = {
    sourceType: string;
    journalId: string;
    lines: Array<{ accountId: string; debit: string; credit: string }>;
  };
  const actor = {
    id: '10000000-0000-0000-0000-000000000001',
    hotelId: '20000000-0000-0000-0000-000000000001',
    permissions: [],
  } as unknown as RequestUser;
  const reservationId = '30000000-0000-0000-0000-000000000001';
  const settings = {
    defaultRoomRevenueAccountId: 'room-revenue',
    defaultGuestReceivableAccountId: 'receivable',
    defaultCashAccountId: 'cash',
    defaultBankAccountId: 'bank',
    defaultMobileMoneyAccountId: 'mobile',
    defaultDepositAccountId: 'deposit',
    defaultServiceRevenueAccountId: 'service-revenue',
  };
  const journals = ['GEN', 'SALES', 'CASH', 'BANK', 'MOBILE'].map((code) => ({
    id: `${code.toLowerCase()}-journal`,
    code,
  }));

  function setup(balance = { debit: '0', credit: '0' }) {
    const posting = {
      postEvent: jest.fn().mockResolvedValue({ idempotentReplay: false }),
      reverseEvent: jest.fn().mockResolvedValue({ reversed: false }),
    };
    const tx = {
      accountingSettings: { findUnique: jest.fn().mockResolvedValue(settings) },
      accountingJournal: { findMany: jest.fn().mockResolvedValue(journals) },
      journalLine: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            debit: new Decimal(balance.debit),
            credit: new Decimal(balance.credit),
          },
        }),
      },
    };
    return {
      service: new GuestAccountingService(posting as unknown as AccountingPostingService),
      posting,
      tx: tx as unknown as Prisma.TransactionClient,
      rawTx: tx,
    };
  }

  it('does not create ledger entries before accounting is initialized', async () => {
    const { service, posting, tx, rawTx } = setup();
    rawTx.accountingSettings.findUnique.mockResolvedValue(null);

    await service.postPayment(
      {
        id: '40000000-0000-0000-0000-000000000001',
        reservationId,
        amount: new Decimal(50),
        occurredAt: new Date('2026-08-25T10:00:00Z'),
        description: 'Advance payment',
        paymentAccountId: 'cash',
      },
      actor,
      tx,
    );

    expect(posting.postEvent).not.toHaveBeenCalled();
  });

  it('posts a service charge to receivables and mapped revenue', async () => {
    const { service, posting, tx } = setup();

    await service.postCharge(
      {
        id: '40000000-0000-0000-0000-000000000002',
        reservationId,
        amount: new Decimal(25),
        occurredAt: new Date('2026-08-25T11:00:00Z'),
        description: 'Laundry',
        type: ChargeType.SERVICE,
        revenueAccountId: 'laundry-revenue',
      },
      actor,
      tx,
    );

    expect(posting.postEvent).toHaveBeenCalledTimes(1);
    expect((posting.postEvent.mock.calls as unknown as Array<[PostedEvent]>)[0][0]).toMatchObject({
      sourceType: 'GUEST_CHARGE',
      journalId: 'sales-journal',
      lines: [
        { accountId: 'receivable', debit: '25', credit: '0' },
        { accountId: 'laundry-revenue', debit: '0', credit: '25' },
      ],
    });
  });

  it('splits a receipt between earned receivables and guest deposits', async () => {
    const { service, posting, tx } = setup({ debit: '80', credit: '0' });

    await service.postPayment(
      {
        id: '40000000-0000-0000-0000-000000000003',
        reservationId,
        amount: new Decimal(100),
        occurredAt: new Date('2026-08-25T12:00:00Z'),
        description: 'Guest payment',
        paymentAccountId: 'cash',
      },
      actor,
      tx,
    );

    expect((posting.postEvent.mock.calls as unknown as Array<[PostedEvent]>)[0][0]).toMatchObject({
      sourceType: 'GUEST_PAYMENT',
      journalId: 'cash-journal',
      lines: [
        { accountId: 'cash', debit: '100', credit: '0' },
        { accountId: 'receivable', debit: '0', credit: '80' },
        { accountId: 'deposit', debit: '0', credit: '20' },
      ],
    });
  });

  it('applies available deposits when a charge becomes earned', async () => {
    const { service, posting, tx } = setup({ debit: '0', credit: '30' });

    await service.postCharge(
      {
        id: '40000000-0000-0000-0000-000000000004',
        reservationId,
        amount: new Decimal(50),
        occurredAt: new Date('2026-08-25T13:00:00Z'),
        description: 'Room charge',
        type: ChargeType.ROOM,
      },
      actor,
      tx,
    );

    expect(posting.postEvent).toHaveBeenCalledTimes(2);
    expect((posting.postEvent.mock.calls as unknown as Array<[PostedEvent]>)[1][0]).toMatchObject({
      sourceType: 'GUEST_DEPOSIT_APPLIED',
      lines: [
        { accountId: 'deposit', debit: '30', credit: '0' },
        { accountId: 'receivable', debit: '0', credit: '30' },
      ],
    });
  });

  it('reverses deposit application before reversing a voided charge', async () => {
    const { service, posting, tx } = setup();

    await service.voidCharge(
      '40000000-0000-0000-0000-000000000005',
      'Posted to the wrong folio',
      actor,
      tx,
    );

    const reversals = posting.reverseEvent.mock.calls as unknown as Array<[{ sourceType: string }]>;
    expect(reversals.map(([input]) => input.sourceType)).toEqual([
      'GUEST_DEPOSIT_APPLIED',
      'GUEST_CHARGE',
    ]);
  });
});
