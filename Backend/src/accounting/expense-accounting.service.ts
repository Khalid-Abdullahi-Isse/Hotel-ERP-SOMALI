import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AccountingPostingService } from './posting/accounting-posting.service.js';

const EXPENSE_SOURCE = 'HOTEL_EXPENSE';

type ExpenseEvent = {
  id: string;
  amount: { toString(): string };
  expenseDate: Date;
  description: string;
  reference?: string | null;
  expenseAccountId?: string | null;
  paymentAccountId?: string | null;
  hasPaymentMethod: boolean;
};

@Injectable()
export class ExpenseAccountingService {
  constructor(private readonly posting: AccountingPostingService) {}

  async postExpense(expense: ExpenseEvent, actor: RequestUser, tx: Prisma.TransactionClient) {
    const settings = await tx.accountingSettings.findUnique({ where: { hotelId: actor.hotelId } });
    if (!settings) return { accountingEnabled: false };
    if (expense.hasPaymentMethod && !expense.paymentAccountId) {
      throw new ConflictException({
        code: 'PAYMENT_LEDGER_ACCOUNT_NOT_CONFIGURED',
        message: 'Configure a ledger account for this expense payment method before posting.',
      });
    }
    const journal = await tx.accountingJournal.findUnique({
      where: { hotelId_code: { hotelId: actor.hotelId, code: 'PURCHASE' } },
      select: { id: true, isActive: true },
    });
    if (!journal?.isActive) {
      throw new ConflictException({
        code: 'ACCOUNTING_JOURNAL_NOT_CONFIGURED',
        message: 'Accounting journal PURCHASE is missing or inactive.',
      });
    }
    const creditAccountId = expense.paymentAccountId ?? settings.defaultAccountsPayableAccountId;
    await this.posting.postEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: journal.id,
        businessDate: expense.expenseDate.toISOString().slice(0, 10),
        sourceType: EXPENSE_SOURCE,
        sourceId: expense.id,
        reference: expense.reference ?? undefined,
        description: expense.description,
        lines: [
          {
            accountId: expense.expenseAccountId ?? settings.defaultExpenseAccountId,
            description: expense.description,
            debit: expense.amount.toString(),
            credit: '0',
            sourceType: 'EXPENSE',
            sourceId: expense.id,
          },
          {
            accountId: creditAccountId,
            description: expense.hasPaymentMethod ? 'Expense paid' : 'Supplier balance payable',
            debit: '0',
            credit: expense.amount.toString(),
            sourceType: 'EXPENSE',
            sourceId: expense.id,
          },
        ],
      },
      tx,
    );
    return { accountingEnabled: true };
  }

  async reverseExpense(
    expenseId: string,
    reason: string,
    actor: RequestUser,
    tx: Prisma.TransactionClient,
  ) {
    const settings = await tx.accountingSettings.findUnique({ where: { hotelId: actor.hotelId } });
    if (!settings) return { accountingEnabled: false };
    await this.posting.reverseEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        sourceType: EXPENSE_SOURCE,
        sourceId: expenseId,
        reason,
      },
      tx,
    );
    return { accountingEnabled: true };
  }
}
