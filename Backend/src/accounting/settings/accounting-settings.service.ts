import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, AccountingJournalType, NormalBalance } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditLogsService } from '../../audit-logs/audit-logs.service.js';
import type { RequestUser } from '../../auth/auth.types.js';
import { runSerializable } from '../../common/database/serializable-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateAccountingSettingsDto } from './dto/update-accounting-settings.dto.js';

const SETTINGS_INCLUDE = {
  defaultRoomRevenueAccount: true,
  defaultGuestReceivableAccount: true,
  defaultCashAccount: true,
  defaultBankAccount: true,
  defaultMobileMoneyAccount: true,
  defaultDepositAccount: true,
  defaultTaxPayableAccount: true,
  defaultServiceRevenueAccount: true,
  defaultDiscountAccount: true,
  defaultExpenseAccount: true,
} as const;

const DEFAULT_ACCOUNTS = [
  ['1000', 'Assets', AccountType.ASSET, NormalBalance.DEBIT, null, false],
  ['1100', 'Cash and Cash Equivalents', AccountType.ASSET, NormalBalance.DEBIT, '1000', false],
  ['1110', 'Front Desk Cash', AccountType.ASSET, NormalBalance.DEBIT, '1100', true],
  ['1120', 'Bank', AccountType.ASSET, NormalBalance.DEBIT, '1100', true],
  ['1130', 'Mobile Money', AccountType.ASSET, NormalBalance.DEBIT, '1100', true],
  ['1200', 'Guest Accounts Receivable', AccountType.ASSET, NormalBalance.DEBIT, '1000', true],
  ['2000', 'Liabilities', AccountType.LIABILITY, NormalBalance.CREDIT, null, false],
  ['2100', 'Accounts Payable', AccountType.LIABILITY, NormalBalance.CREDIT, '2000', true],
  ['2200', 'Guest Deposits', AccountType.LIABILITY, NormalBalance.CREDIT, '2000', false],
  ['2300', 'Taxes Payable', AccountType.LIABILITY, NormalBalance.CREDIT, '2000', false],
  ['3000', 'Equity', AccountType.EQUITY, NormalBalance.CREDIT, null, false],
  ['3100', 'Owner Equity', AccountType.EQUITY, NormalBalance.CREDIT, '3000', true],
  ['3200', 'Retained Earnings', AccountType.EQUITY, NormalBalance.CREDIT, '3000', false],
  ['4000', 'Revenue', AccountType.REVENUE, NormalBalance.CREDIT, null, false],
  ['4090', 'Sales Discounts', AccountType.REVENUE, NormalBalance.DEBIT, '4000', false],
  ['4100', 'Room Revenue', AccountType.REVENUE, NormalBalance.CREDIT, '4000', false],
  ['4200', 'Restaurant Revenue', AccountType.REVENUE, NormalBalance.CREDIT, '4000', false],
  ['4300', 'Laundry Revenue', AccountType.REVENUE, NormalBalance.CREDIT, '4000', false],
  ['4400', 'Transport Revenue', AccountType.REVENUE, NormalBalance.CREDIT, '4000', false],
  ['4500', 'Other Revenue', AccountType.REVENUE, NormalBalance.CREDIT, '4000', false],
  ['5000', 'Cost of Sales', AccountType.EXPENSE, NormalBalance.DEBIT, null, true],
  ['6000', 'Operating Expenses', AccountType.EXPENSE, NormalBalance.DEBIT, null, false],
  ['6100', 'Salaries', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6200', 'Electricity', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6300', 'Water', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6400', 'Internet', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6500', 'Cleaning', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6600', 'Maintenance', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6700', 'Rent', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6800', 'Marketing', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
  ['6900', 'Other Expenses', AccountType.EXPENSE, NormalBalance.DEBIT, '6000', true],
] as const;

const DEFAULT_JOURNALS = [
  ['GEN', 'General Journal', AccountingJournalType.GENERAL],
  ['SALES', 'Sales Journal', AccountingJournalType.SALES],
  ['CASH', 'Cash Journal', AccountingJournalType.CASH],
  ['BANK', 'Bank Journal', AccountingJournalType.BANK],
  ['MOBILE', 'Mobile Money Journal', AccountingJournalType.MOBILE_MONEY],
  ['PURCHASE', 'Purchase Journal', AccountingJournalType.PURCHASE],
  ['ADJUST', 'Adjustment Journal', AccountingJournalType.ADJUSTMENT],
  ['NIGHT', 'Night Audit Journal', AccountingJournalType.NIGHT_AUDIT],
] as const;

@Injectable()
export class AccountingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditLogsService,
  ) {}

  async get(actor: RequestUser) {
    const settings = await this.prisma.accountingSettings.findUnique({
      where: { hotelId: actor.hotelId },
      include: SETTINGS_INCLUDE,
    });
    if (!settings) this.notInitialized();
    return settings;
  }

  initialize(actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const existing = await tx.accountingSettings.findUnique({
        where: { hotelId: actor.hotelId },
        include: SETTINGS_INCLUDE,
      });
      if (existing) return { initialized: false, settings: existing };
      const hotel = await tx.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { currencyCode: true },
      });
      const accounts = new Map<string, string>();
      for (const [
        code,
        name,
        type,
        normalBalance,
        parentCode,
        allowManualPosting,
      ] of DEFAULT_ACCOUNTS) {
        const found = await tx.account.findUnique({
          where: { hotelId_code: { hotelId: actor.hotelId, code } },
        });
        if (found && (found.type !== type || found.normalBalance !== normalBalance)) {
          throw new ConflictException({
            code: 'ACCOUNTING_DEFAULT_CODE_CONFLICT',
            message: `Account ${code} already exists with incompatible accounting properties.`,
          });
        }
        const account =
          found ??
          (await tx.account.create({
            data: {
              hotelId: actor.hotelId,
              code,
              name,
              type,
              normalBalance,
              parentAccountId: parentCode ? accounts.get(parentCode) : undefined,
              currency: hotel.currencyCode,
              allowManualPosting,
            },
          }));
        accounts.set(code, account.id);
      }
      for (const [code, name, type] of DEFAULT_JOURNALS) {
        await tx.accountingJournal.upsert({
          where: { hotelId_code: { hotelId: actor.hotelId, code } },
          update: {},
          create: { hotelId: actor.hotelId, code, name, type },
        });
      }
      const settings = await tx.accountingSettings.create({
        data: {
          hotelId: actor.hotelId,
          baseCurrency: hotel.currencyCode,
          defaultRoomRevenueAccountId: this.requiredAccount(accounts, '4100'),
          defaultGuestReceivableAccountId: this.requiredAccount(accounts, '1200'),
          defaultCashAccountId: this.requiredAccount(accounts, '1110'),
          defaultBankAccountId: this.requiredAccount(accounts, '1120'),
          defaultMobileMoneyAccountId: this.requiredAccount(accounts, '1130'),
          defaultDepositAccountId: this.requiredAccount(accounts, '2200'),
          defaultTaxPayableAccountId: this.requiredAccount(accounts, '2300'),
          defaultServiceRevenueAccountId: this.requiredAccount(accounts, '4500'),
          defaultDiscountAccountId: this.requiredAccount(accounts, '4090'),
          defaultExpenseAccountId: this.requiredAccount(accounts, '6900'),
        },
        include: SETTINGS_INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.settings_initialized',
          entityType: 'AccountingSettings',
          entityId: settings.id,
          newValue: {
            baseCurrency: settings.baseCurrency,
            accountsCreated: accounts.size,
            journalsCreated: DEFAULT_JOURNALS.length,
          },
        },
        tx,
      );
      return { initialized: true, settings };
    });
  }

  update(dto: UpdateAccountingSettingsDto, actor: RequestUser) {
    return runSerializable(this.prisma, async (tx) => {
      const existing = await tx.accountingSettings.findUnique({
        where: { hotelId: actor.hotelId },
      });
      if (!existing) this.notInitialized();
      const mapping = { ...existing, ...dto };
      await this.validateMappings(tx, actor.hotelId, mapping);
      const updated = await tx.accountingSettings.update({
        where: { hotelId: actor.hotelId },
        data: dto,
        include: SETTINGS_INCLUDE,
      });
      await this.audits.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'accounting.settings_updated',
          entityType: 'AccountingSettings',
          entityId: updated.id,
          oldValue: this.json(existing),
          newValue: this.json(updated),
        },
        tx,
      );
      return updated;
    });
  }

  private async validateMappings(
    tx: Prisma.TransactionClient,
    hotelId: string,
    value: Record<string, unknown>,
  ) {
    const expectations: Array<[string, AccountType]> = [
      ['defaultRoomRevenueAccountId', AccountType.REVENUE],
      ['defaultGuestReceivableAccountId', AccountType.ASSET],
      ['defaultCashAccountId', AccountType.ASSET],
      ['defaultBankAccountId', AccountType.ASSET],
      ['defaultMobileMoneyAccountId', AccountType.ASSET],
      ['defaultDepositAccountId', AccountType.LIABILITY],
      ['defaultTaxPayableAccountId', AccountType.LIABILITY],
      ['defaultServiceRevenueAccountId', AccountType.REVENUE],
      ['defaultDiscountAccountId', AccountType.REVENUE],
      ['defaultExpenseAccountId', AccountType.EXPENSE],
    ];
    for (const [field, type] of expectations) {
      const id = value[field];
      const account =
        typeof id === 'string'
          ? await tx.account.findFirst({
              where: { id, hotelId, type, isActive: true },
              select: { id: true },
            })
          : null;
      if (!account) {
        throw new ConflictException({
          code: 'INVALID_ACCOUNT_MAPPING',
          message: `${field} must reference an active same-hotel ${type.toLowerCase()} account.`,
        });
      }
    }
  }

  private requiredAccount(accounts: Map<string, string>, code: string) {
    const id = accounts.get(code);
    if (!id) throw new Error(`Default account ${code} was not created.`);
    return id;
  }

  private notInitialized(): never {
    throw new NotFoundException({
      code: 'ACCOUNTING_NOT_INITIALIZED',
      message: 'Initialize accounting settings for this hotel first.',
    });
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }
}
