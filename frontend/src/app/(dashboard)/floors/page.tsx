import type { Metadata } from "next";
import { CatalogManager } from "@/components/management/catalog-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getAllFloors } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Floors" };
export default async function FloorsPage() {
  const [items, user] = await Promise.all([getAllFloors(), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title="Floors" description="Organize rooms by floor and keep the property structure accurate." /><CatalogManager kind="floors" items={items} canManage={Boolean(user && can(user, PERMISSIONS.floorsManage))} /></div>;
}
