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
