import type { Metadata } from "next";
import { CatalogManager } from "@/components/management/catalog-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getAllRoomTypes } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Room types" };
export default async function RoomTypesPage() {
  const [items, user] = await Promise.all([getAllRoomTypes(), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title="Room types" description="Configure room categories, occupancy limits, and default nightly prices." /><CatalogManager kind="room-types" items={items} canManage={Boolean(user && can(user, PERMISSIONS.roomTypesManage))} /></div>;
}
