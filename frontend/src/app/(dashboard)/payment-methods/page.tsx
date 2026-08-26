import type { Metadata } from "next";
import { CatalogManager } from "@/components/management/catalog-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getPaymentMethods } from "@/services/catalog.server";
import { getAccountingAccounts, getAccountingSettings } from "@/services/accounting.server";

export const metadata: Metadata = { title: "Payment methods" };
export default async function PaymentMethodsPage() {
  const [items, user, settings] = await Promise.all([getPaymentMethods(), getCurrentUser(), getAccountingSettings()]);
  const ledgerAccounts = settings && user && can(user, PERMISSIONS.chartOfAccountsRead) ? (await getAccountingAccounts({ page: 1, limit: 100, type: "ASSET", isActive: "true" })).data : [];
  return <div className="space-y-6"><PageHeader title="Payment methods" description="Configure accepted settlement methods and the asset account each one posts to." /><CatalogManager kind="payment-methods" items={items} ledgerAccounts={ledgerAccounts} canManage={Boolean(user && can(user, PERMISSIONS.paymentMethodsManage))} /></div>;
}
