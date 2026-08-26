import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { RequestUser } from '../auth/auth.types.js';
import { ExpenseAccountingService } from './expense-accounting.service.js';
import type { AccountingPostingService } from './posting/accounting-posting.service.js';

jest.mock('./posting/accounting-posting.service.js', () => ({
  AccountingPostingService: class {},
}));

describe('ExpenseAccountingService', () => {
  type PostedEvent = {
    lines: Array<{ accountId: string; debit: string; credit: string }>;
  };
  const actor = {
    id: '10000000-0000-4000-8000-000000000001',
    hotelId: '20000000-0000-4000-8000-000000000001',
    permissions: [],
  } as unknown as RequestUser;
  const settings = {
    defaultExpenseAccountId: 'default-expense',
    defaultAccountsPayableAccountId: 'accounts-payable',
  };

  function setup(accountingSettings: typeof settings | null = settings) {
    const posting = {
      postEvent: jest.fn().mockResolvedValue({ idempotentReplay: false }),
      reverseEvent: jest.fn().mockResolvedValue({ reversed: true }),
    };
    const tx = {
      accountingSettings: { findUnique: jest.fn().mockResolvedValue(accountingSettings) },
      accountingJournal: {
        findUnique: jest.fn().mockResolvedValue({ id: 'purchase-journal', isActive: true }),
      },
    };
    return {
      service: new ExpenseAccountingService(posting as unknown as AccountingPostingService),
      posting,
      tx: tx as unknown as Prisma.TransactionClient,
    };
  }

  const baseExpense = {
    id: '30000000-0000-4000-8000-000000000001',
    amount: { toString: () => '125.50' },
    expenseDate: new Date('2026-08-25T00:00:00.000Z'),
    description: 'Generator maintenance',
    reference: 'EXP-1001',
    expenseAccountId: 'maintenance-expense',
  };

  it('posts a paid expense to its category and payment accounts', async () => {
    const { service, posting, tx } = setup();

    await service.postExpense(
      { ...baseExpense, hasPaymentMethod: true, paymentAccountId: 'bank' },
      actor,
      tx,
    );

    expect(posting.postEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        journalId: 'purchase-journal',
        sourceType: 'HOTEL_EXPENSE',
        lines: [
          expect.objectContaining({
            accountId: 'maintenance-expense',
            debit: '125.50',
            credit: '0',
          }),
          expect.objectContaining({ accountId: 'bank', debit: '0', credit: '125.50' }),
        ],
      }),
      tx,
    );
  });

  it('credits accounts payable for an unpaid expense', async () => {
    const { service, posting, tx } = setup();

    await service.postExpense(
      { ...baseExpense, hasPaymentMethod: false, paymentAccountId: null },
      actor,
      tx,
    );

    const event = (posting.postEvent.mock.calls as unknown as Array<[PostedEvent]>)[0][0];
    expect(event.lines[1]).toMatchObject({
      accountId: 'accounts-payable',
      credit: '125.50',
    });
  });

  it('requires a ledger mapping for a selected expense payment method', async () => {
    const { service, tx } = setup();

    await expect(
      service.postExpense(
        { ...baseExpense, hasPaymentMethod: true, paymentAccountId: null },
        actor,
        tx,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('skips event posting until the hotel initializes accounting', async () => {
    const { service, posting, tx } = setup(null);

    await service.postExpense(
      { ...baseExpense, hasPaymentMethod: false, paymentAccountId: null },
      actor,
      tx,
    );

    expect(posting.postEvent).not.toHaveBeenCalled();
  });

  it('creates a linked reversal for a reversed expense', async () => {
    const { service, posting, tx } = setup();

    await service.reverseExpense(baseExpense.id, 'Duplicate supplier invoice', actor, tx);

    expect(posting.reverseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'HOTEL_EXPENSE',
        sourceId: baseExpense.id,
        reason: 'Duplicate supplier invoice',
      }),
      tx,
    );
  });
});
