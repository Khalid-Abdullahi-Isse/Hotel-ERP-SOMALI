import type { Metadata } from "next";
import { AccountingNav } from "@/components/accounting/accounting-nav";
import { AccountingSettingsPanel } from "@/components/accounting/accounting-settings-panel";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getAccountingAccounts, getAccountingSettings } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";

export const metadata: Metadata = { title: "Accounting Setup" };

export default async function AccountingSettingsPage() {
  const [settings, user] = await Promise.all([getAccountingSettings(), getCurrentUser()]);
  const accounts = settings ? (await getAccountingAccounts({ page: 1, limit: 100 })).data : [];
  return <div className="space-y-6">
    <PageHeader title="Accounting Setup" description="Initialize the ledger and connect hotel activity to the correct accounts." />
    <AccountingNav />
    <AccountingSettingsPanel settings={settings} accounts={accounts} canManage={Boolean(user && can(user, PERMISSIONS.accountingManage))} />
  </div>;
}
