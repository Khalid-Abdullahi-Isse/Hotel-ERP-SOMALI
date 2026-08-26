import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { JournalEntryForm } from "@/components/accounting/journal-entry-form";
import { PageHeader } from "@/components/shared/page-header";
import { accountingPeriod } from "@/lib/accounting";
import { getAccountingAccounts, getAccountingJournals } from "@/services/accounting.server";

export const metadata: Metadata = { title: "New Journal Entry" };
export default async function NewJournalEntryPage() {
  const [accounts, journals] = await Promise.all([getAccountingAccounts({ page: 1, limit: 100, isActive: "true" }), getAccountingJournals({ page: 1, limit: 100, isActive: "true" })]);
  return <div className="space-y-6"><PageHeader title="New Journal Entry" description="Create a balanced manual draft. Review it before posting to the ledger." /><AccountingNav /><JournalEntryForm accounts={accounts.data.filter((account) => account.allowManualPosting)} journals={journals.data} businessDate={accountingPeriod().dateTo} /></div>;
}
