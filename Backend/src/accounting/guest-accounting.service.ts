import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ChargeType, JournalEntryStatus } from '../generated/prisma/enums.js';
import type { RequestUser } from '../auth/auth.types.js';
import { AccountingPostingService } from './posting/accounting-posting.service.js';

const SOURCE = {
  charge: 'GUEST_CHARGE',
  depositApplied: 'GUEST_DEPOSIT_APPLIED',
  payment: 'GUEST_PAYMENT',
  refund: 'GUEST_PAYMENT_REFUND',
} as const;

type MoneyEvent = {
  id: string;
  reservationId: string;
  amount: Prisma.Decimal;
  occurredAt: Date;
  reference?: string | null;
  description: string;
};

@Injectable()
export class GuestAccountingService {
  constructor(private readonly posting: AccountingPostingService) {}

  async postCharge(
    charge: MoneyEvent & {
      type: ChargeType;
      revenueAccountId?: string | null;
    },
    actor: RequestUser,
    tx: Prisma.TransactionClient,
  ) {
    const context = await this.context(actor.hotelId, tx);
    if (!context) return { accountingEnabled: false };
    const revenueAccountId =
      charge.revenueAccountId ??
      (charge.type === ChargeType.ROOM
        ? context.settings.defaultRoomRevenueAccountId
        : context.settings.defaultServiceRevenueAccountId);
    const businessDate = this.date(charge.occurredAt);
    await this.posting.postEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: context.salesJournalId,
        businessDate,
        sourceType: SOURCE.charge,
        sourceId: charge.id,
        reference: charge.reference ?? undefined,
        description: charge.description,
        lines: [
          this.line(
            context.settings.defaultGuestReceivableAccountId,
            charge.amount,
            true,
            charge.reservationId,
            charge.description,
          ),
          this.line(
            revenueAccountId,
            charge.amount,
            false,
            charge.reservationId,
            charge.description,
          ),
        ],
      },
      tx,
    );

    const availableDeposit = await this.accountBalance(
      tx,
      actor.hotelId,
      context.settings.defaultDepositAccountId,
      charge.reservationId,
      'credit',
    );
    const applied = Prisma.Decimal.min(availableDeposit, charge.amount);
    if (applied.gt(0)) {
      await this.posting.postEvent(
        {
          hotelId: actor.hotelId,
          actorId: actor.id,
          journalId: context.generalJournalId,
          businessDate,
          sourceType: SOURCE.depositApplied,
          sourceId: charge.id,
          reference: charge.reference ?? undefined,
          description: `Apply guest deposit to ${charge.description}`,
          lines: [
            this.line(
              context.settings.defaultDepositAccountId,
              applied,
              true,
              charge.reservationId,
              'Guest deposit applied',
            ),
            this.line(
              context.settings.defaultGuestReceivableAccountId,
              applied,
              false,
              charge.reservationId,
              'Guest deposit applied',
            ),
          ],
        },
        tx,
      );
    }
    return { accountingEnabled: true };
  }

  async voidCharge(
    chargeId: string,
    reason: string,
    actor: RequestUser,
    tx: Prisma.TransactionClient,
  ) {
    const context = await this.context(actor.hotelId, tx);
    if (!context) return { accountingEnabled: false };
    await this.posting.reverseEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        sourceType: SOURCE.depositApplied,
        sourceId: chargeId,
        reason,
      },
      tx,
    );
    await this.posting.reverseEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        sourceType: SOURCE.charge,
        sourceId: chargeId,
        reason,
      },
      tx,
    );
    return { accountingEnabled: true };
  }

  async postPayment(
    payment: MoneyEvent & { paymentAccountId?: string | null },
    actor: RequestUser,
    tx: Prisma.TransactionClient,
  ) {
    const context = await this.context(actor.hotelId, tx);
    if (!context) return { accountingEnabled: false };
    const paymentAccountId = payment.paymentAccountId;
    if (!paymentAccountId) {
      throw new ConflictException({
        code: 'PAYMENT_LEDGER_ACCOUNT_NOT_CONFIGURED',
        message: 'Configure a ledger account for this payment method before posting payments.',
      });
    }
    const receivable = await this.accountBalance(
      tx,
      actor.hotelId,
      context.settings.defaultGuestReceivableAccountId,
      payment.reservationId,
      'debit',
    );
    const settlement = Prisma.Decimal.min(receivable, payment.amount);
    const deposit = payment.amount.minus(settlement);
    const lines = [
      this.line(paymentAccountId, payment.amount, true, payment.reservationId, payment.description),
    ];
    if (settlement.gt(0)) {
      lines.push(
        this.line(
          context.settings.defaultGuestReceivableAccountId,
          settlement,
          false,
          payment.reservationId,
          'Guest receivable settled',
        ),
      );
    }
    if (deposit.gt(0)) {
      lines.push(
        this.line(
          context.settings.defaultDepositAccountId,
          deposit,
          false,
          payment.reservationId,
          'Guest deposit received',
        ),
      );
    }
    await this.posting.postEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: this.paymentJournal(context, paymentAccountId),
        businessDate: this.date(payment.occurredAt),
        sourceType: SOURCE.payment,
        sourceId: payment.id,
        reference: payment.reference ?? undefined,
        description: payment.description,
        lines,
      },
      tx,
    );
    return { accountingEnabled: true };
  }

  async postRefund(
    refund: MoneyEvent & { paymentAccountId?: string | null },
    actor: RequestUser,
    tx: Prisma.TransactionClient,
  ) {
    const context = await this.context(actor.hotelId, tx);
    if (!context) return { accountingEnabled: false };
    const paymentAccountId = refund.paymentAccountId;
    if (!paymentAccountId) {
      throw new ConflictException({
        code: 'PAYMENT_LEDGER_ACCOUNT_NOT_CONFIGURED',
        message: 'Configure a ledger account for this payment method before posting refunds.',
      });
    }
    const availableDeposit = await this.accountBalance(
      tx,
      actor.hotelId,
      context.settings.defaultDepositAccountId,
      refund.reservationId,
      'credit',
    );
    const depositRefund = Prisma.Decimal.min(availableDeposit, refund.amount);
    const receivableRefund = refund.amount.minus(depositRefund);
    const lines = [];
    if (depositRefund.gt(0)) {
      lines.push(
        this.line(
          context.settings.defaultDepositAccountId,
          depositRefund,
          true,
          refund.reservationId,
          'Guest deposit refunded',
        ),
      );
    }
    if (receivableRefund.gt(0)) {
      lines.push(
        this.line(
          context.settings.defaultGuestReceivableAccountId,
          receivableRefund,
          true,
          refund.reservationId,
          'Guest settlement refunded',
        ),
      );
    }
    lines.push(
      this.line(paymentAccountId, refund.amount, false, refund.reservationId, refund.description),
    );
    await this.posting.postEvent(
      {
        hotelId: actor.hotelId,
        actorId: actor.id,
        journalId: this.paymentJournal(context, paymentAccountId),
        businessDate: this.date(refund.occurredAt),
        sourceType: SOURCE.refund,
        sourceId: refund.id,
        reference: refund.reference ?? undefined,
        description: refund.description,
        lines,
      },
      tx,
    );
    return { accountingEnabled: true };
  }

  private async context(hotelId: string, tx: Prisma.TransactionClient) {
    const settings = await tx.accountingSettings.findUnique({ where: { hotelId } });
    if (!settings) return null;
    const journals = await tx.accountingJournal.findMany({
      where: { hotelId, code: { in: ['GEN', 'SALES', 'CASH', 'BANK', 'MOBILE'] }, isActive: true },
      select: { id: true, code: true },
    });
    const byCode = new Map(journals.map((journal) => [journal.code, journal.id]));
    const required = (code: string) => {
      const id = byCode.get(code);
      if (!id) {
        throw new ConflictException({
          code: 'ACCOUNTING_JOURNAL_NOT_CONFIGURED',
          message: `Accounting journal ${code} is missing or inactive.`,
        });
      }
      return id;
    };
    return {
      settings,
      generalJournalId: required('GEN'),
      salesJournalId: required('SALES'),
      cashJournalId: required('CASH'),
      bankJournalId: required('BANK'),
      mobileJournalId: required('MOBILE'),
    };
  }

  private paymentJournal(
    context: NonNullable<Awaited<ReturnType<GuestAccountingService['context']>>>,
    accountId: string,
  ) {
    if (accountId === context.settings.defaultCashAccountId) return context.cashJournalId;
    if (accountId === context.settings.defaultMobileMoneyAccountId) return context.mobileJournalId;
    return context.bankJournalId;
  }

  private async accountBalance(
    tx: Prisma.TransactionClient,
    hotelId: string,
    accountId: string,
    reservationId: string,
    normalSide: 'debit' | 'credit',
  ) {
    const totals = await tx.journalLine.aggregate({
      where: {
        accountId,
        sourceType: 'RESERVATION',
        sourceId: reservationId,
        journalEntry: {
          hotelId,
          status: { in: [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED] },
        },
      },
      _sum: { debit: true, credit: true },
    });
    const debit = totals._sum.debit ?? new Prisma.Decimal(0);
    const credit = totals._sum.credit ?? new Prisma.Decimal(0);
    return Prisma.Decimal.max(
      normalSide === 'debit' ? debit.minus(credit) : credit.minus(debit),
      0,
    );
  }

  private line(
    accountId: string,
    amount: Prisma.Decimal,
    debit: boolean,
    reservationId: string,
    description: string,
  ) {
    return {
      accountId,
      description,
      debit: debit ? amount.toString() : '0',
      credit: debit ? '0' : amount.toString(),
      sourceType: 'RESERVATION',
      sourceId: reservationId,
    };
  }

  private date(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
