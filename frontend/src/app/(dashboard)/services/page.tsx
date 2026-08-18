import type { Metadata } from "next";
import { CatalogManager } from "@/components/management/catalog-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getServices } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Guest services" };
export default async function ServicesPage() {
  const [items, user] = await Promise.all([getServices(), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title="Guest services" description="Maintain the service catalog and the default price used for new charges." /><CatalogManager kind="services" items={items} canManage={Boolean(user && can(user, PERMISSIONS.servicesManage))} /></div>;
}
