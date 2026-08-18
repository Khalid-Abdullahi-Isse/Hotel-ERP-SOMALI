import type { Metadata } from "next";
import { MaintenanceManager } from "@/components/maintenance/maintenance-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getMaintenanceRequests, getMaintenanceRooms, getMaintenanceUsers } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Maintenance" };
export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const [requests, rooms, users] = await Promise.all([
    getMaintenanceRequests(),
    user && can(user, PERMISSIONS.roomsRead) ? getMaintenanceRooms() : Promise.resolve([]),
    user && can(user, PERMISSIONS.usersManage) ? getMaintenanceUsers() : Promise.resolve([]),
  ]);
  return <div className="space-y-6"><PageHeader title="Maintenance" description="Open, assign, start, and complete room maintenance work." /><MaintenanceManager requests={requests} rooms={rooms} users={users} canCreate={Boolean(user && can(user, PERMISSIONS.maintenanceCreate))} canUpdate={Boolean(user && can(user, PERMISSIONS.maintenanceUpdate))} /></div>;
}
