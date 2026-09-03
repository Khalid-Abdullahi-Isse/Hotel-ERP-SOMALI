import "server-only";

import { serverApi } from "@/lib/server-api";
import type {
  AccountingAccount,
  AccountingJournal,
  AccountingPage,
  AccountingSettings,
  BalanceRow,
  JournalEntrySummary,
  JournalEntryDetail,
  LedgerRow,
  ReportMetadata,
  TrialBalanceRow,
} from "@/types/accounting";

function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
}

export function getJournalEntry(id: string) {
  return serverApi<JournalEntryDetail>(`/accounting/journal-entries/${id}`);
}

export function getAccountingAccounts(
  values: { page?: number; limit?: number; search?: string; type?: string; isActive?: string } = {},
) {
  return serverApi<AccountingPage<AccountingAccount>>(
    `/accounting/accounts?${queryString(values)}`,
  );
}

export function getAccountingJournals(
  values: { page?: number; limit?: number; search?: string; isActive?: string } = {},
) {
  return serverApi<AccountingPage<AccountingJournal>>(
    `/accounting/journals?${queryString(values)}`,
  );
}

export async function getAccountingSettings() {
  try {
    return await serverApi<AccountingSettings>("/accounting/settings");
  } catch (error) {
    const { ApiError } = await import("@/lib/api-error");
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function getJournalEntries(
  values: {
    page?: number;
    search?: string;
    status?: string;
    description?: string;
    accountId?: string;
    accountCode?: string;
    currency?: string;
    debit?: string;
    credit?: string;
    dateFrom?: string;
    dateTo?: string;
    order?: "asc" | "desc";
  } = {},
) {
  return serverApi<AccountingPage<JournalEntrySummary>>(
    `/accounting/journal-entries?${queryString(values)}`,
  );
}

export function getGeneralLedger(values: {
  page?: number;
  dateFrom: string;
  dateTo: string;
  search?: string;
}) {
  return serverApi<AccountingPage<LedgerRow> & { report: ReportMetadata }>(
    `/accounting/general-ledger?${queryString(values)}`,
  );
}

export function getTrialBalance(dateFrom: string, dateTo: string) {
  return serverApi<{
    report: ReportMetadata;
    data: TrialBalanceRow[];
    totals: {
      openingDebit: string;
      openingCredit: string;
      periodDebit: string;
      periodCredit: string;
      closingDebit: string;
      closingCredit: string;
      difference: string;
      balanced: boolean;
    };
    warning: string | null;
  }>(`/accounting/trial-balance?${queryString({ dateFrom, dateTo })}`);
}

export function getProfitLoss(dateFrom: string, dateTo: string) {
  return serverApi<{
    report: ReportMetadata;
    revenue: BalanceRow[];
    expenses: BalanceRow[];
    totals: { revenue: string; expenses: string; netProfitLoss: string };
  }>(`/accounting/profit-loss?${queryString({ dateFrom, dateTo })}`);
}



export default function getBalanceSheet(dateFrom: string, dateTo: string) {
  return serverApi<{
    report: ReportMetadata;
    assets: BalanceRow[];
    liabilities: BalanceRow[];
    equity: BalanceRow[];
    totals: {
      assets: string;
      liabilities: string;
      equity: string;
      currentProfitLoss: string;
      difference: string;
      balanced: boolean;
    };
    warning: string | null;
  }>(
    `/accounting/balance-sheet?${queryString({
      dateFrom,
      dateTo,
    })}`,
  );
}