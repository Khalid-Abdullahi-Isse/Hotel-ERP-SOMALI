import type { PaginatedResponse } from "@/types/api";

export type AccountType =
  "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  isActive: boolean;
  allowManualPosting: boolean;
  parent: { id: string; code: string; name: string } | null;
  _count: { children: number; journalLines: number };
}

export interface AccountingJournal {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  _count: { entries: number };
}

export type AccountingJournalType =
  | "GENERAL"
  | "SALES"
  | "CASH"
  | "BANK"
  | "MOBILE_MONEY"
  | "PURCHASE"
  | "ADJUSTMENT"
  | "NIGHT_AUDIT";

export interface AccountingSettings {
  id: string;
  hotelId: string;
  baseCurrency: string;
  discountPostingMode: "CONTRA_REVENUE" | "REDUCE_REVENUE";
  defaultRoomRevenueAccountId: string;
  defaultGuestReceivableAccountId: string;
  defaultCashAccountId: string;
  defaultBankAccountId: string;
  defaultMobileMoneyAccountId: string;
  defaultDepositAccountId: string;
  defaultTaxPayableAccountId: string;
  defaultServiceRevenueAccountId: string;
  defaultDiscountAccountId: string;
  defaultExpenseAccountId: string;
  defaultAccountsPayableAccountId: string;
}

export type AccountingSettingsInput = Pick<
  AccountingSettings,
  | "discountPostingMode"
  | "defaultRoomRevenueAccountId"
  | "defaultGuestReceivableAccountId"
  | "defaultCashAccountId"
  | "defaultBankAccountId"
  | "defaultMobileMoneyAccountId"
  | "defaultDepositAccountId"
  | "defaultTaxPayableAccountId"
  | "defaultServiceRevenueAccountId"
  | "defaultDiscountAccountId"
  | "defaultExpenseAccountId"
  | "defaultAccountsPayableAccountId"
>;

export interface JournalEntrySummary {
  id: string;
  entryNumber: string;
  businessDate: string;
  sourceType: string;
  reference: string | null;
  description: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  totalDebit: string;
  totalCredit: string;
  difference: string;
  journal: { id: string; code: string; name: string; type: string };
  postedBy: { id: string; fullName: string } | null;
}

export interface JournalEntryDetail extends JournalEntrySummary {
  createdBy: { id: string; fullName: string };
  reversedBy: { id: string; fullName: string } | null;
  reversedEntry: { id: string; entryNumber: string } | null;
  reversalEntry: { id: string; entryNumber: string } | null;
  reversedAt: string | null;
  reversalReason: string | null;
  lines: Array<{
    id: string;
    description: string | null;
    debit: string;
    credit: string;
    account: Pick<
      AccountingAccount,
      "id" | "code" | "name" | "type" | "normalBalance"
    >;
  }>;
}

export interface AccountInput {
  code: string;
  name: string;
  type: AccountType;
  subType?: string;
  normalBalance: "DEBIT" | "CREDIT";
  parentAccountId?: string;
  isActive?: boolean;
  allowManualPosting?: boolean;
}

export interface JournalInput {
  code: string;
  name: string;
  type: AccountingJournalType;
  isActive?: boolean;
}

export interface JournalEntryInput {
  journalId: string;
  businessDate: string;
  reference?: string;
  description: string;
  lines: Array<{
    accountId: string;
    description?: string;
    debit: string;
    credit: string;
  }>;
}

export interface ReportMetadata {
  reportId: string;
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  currency: string;
  status: string;
  hotel: { id: string; code: string; name: string };
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: "DEBIT" | "CREDIT";
  openingBalance: string;
  debit: string;
  credit: string;
  closingBalance: string;
}

export interface BalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: string;
}

export interface LedgerRow {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  businessDate: string;
  entryId: string;
  entryNumber: string;
  reference: string | null;
  description: string;
  debit: string;
  credit: string;
  sourceType: string;
  runningBalance: string;
}

export type AccountingPage<T> = PaginatedResponse<T>;
