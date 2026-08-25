import "server-only";

import { serverApi } from "@/lib/server-api";
import type {
  AccountingAccount,
  AccountingJournal,
  AccountingPage,
  BalanceRow,
  JournalEntrySummary,
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

export function getAccountingAccounts(
  values: { page?: number; search?: string; type?: string } = {},
) {
  return serverApi<AccountingPage<AccountingAccount>>(
    `/accounting/accounts?${queryString(values)}`,
  );
}

export function getAccountingJournals(
  values: { page?: number; search?: string } = {},
) {
  return serverApi<AccountingPage<AccountingJournal>>(
    `/accounting/journals?${queryString(values)}`,
  );
}

export function getJournalEntries(
  values: { page?: number; search?: string; status?: string } = {},
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
      debit: string;
      credit: string;
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

export function getBalanceSheet(dateTo: string) {
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
    `/accounting/balance-sheet?${queryString({ dateFrom: "0001-01-01", dateTo })}`,
  );
}
