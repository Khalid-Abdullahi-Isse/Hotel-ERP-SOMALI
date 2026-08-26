import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { JournalManager } from "@/components/accounting/journal-manager";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PERMISSIONS } from "@/constants/permissions";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAccountingJournals } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";

export const metadata: Metadata = { title: "Accounting Journals" };
export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const [journals, user] = await Promise.all([getAccountingJournals({ page: parsePage(params.page), search: params.search }), getCurrentUser()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Journals"
        description="Controlled books for sales, cash, bank, adjustments, and night audit."
      />
      <AccountingNav />
      <JournalManager journals={journals.data} canManage={Boolean(user && can(user, PERMISSIONS.accountingManage))} toolbar={<ListToolbar placeholder="Search journal code or name" />} pagination={<Pagination
          {...journals.pagination}
          itemLabel="journals"
          searchParams={{ search: params.search }}
        />} />
    </div>
  );
}
