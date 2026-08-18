import type { Metadata } from "next";
import { CatalogManager } from "@/components/management/catalog-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getPaymentMethods } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Payment methods" };
export default async function PaymentMethodsPage() {
  const [items, user] = await Promise.all([getPaymentMethods(), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title="Payment methods" description="Configure the accepted ways guests and staff can settle transactions." /><CatalogManager kind="payment-methods" items={items} canManage={Boolean(user && can(user, PERMISSIONS.paymentMethodsManage))} /></div>;
}
