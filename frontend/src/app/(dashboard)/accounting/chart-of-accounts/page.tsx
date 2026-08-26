import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { AccountManager } from "@/components/accounting/account-manager";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PERMISSIONS } from "@/constants/permissions";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAccountingAccounts } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";

export const metadata: Metadata = { title: "Chart of Accounts" };
export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const [accounts, allAccounts, user] = await Promise.all([
    getAccountingAccounts({ page: parsePage(params.page), search: params.search }),
    getAccountingAccounts({ page: 1, limit: 100 }),
    getCurrentUser(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="Hotel-scoped ledger accounts and posting controls."
      />
      <AccountingNav />
      <AccountManager accounts={accounts.data} allAccounts={allAccounts.data} canManage={Boolean(user && can(user, PERMISSIONS.chartOfAccountsManage))} toolbar={<ListToolbar placeholder="Search account code or name" />} pagination={<Pagination
          {...accounts.pagination}
          itemLabel="accounts"
          searchParams={{ search: params.search }}
        />} />
    </div>
  );
}
