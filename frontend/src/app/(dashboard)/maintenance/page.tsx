import type { Metadata } from "next";
import { MaintenanceManager } from "@/components/maintenance/maintenance-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getMaintenanceRequests, getMaintenanceRooms, getMaintenanceUsers } from "@/services/catalog.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Maintenance" };
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [requests, rooms, users] = await Promise.all([
    getMaintenanceRequests({ page: parsePage(params.page), search: params.search, status: params.status }),
    user && can(user, PERMISSIONS.roomsRead) ? getMaintenanceRooms() : Promise.resolve([]),
    user && can(user, PERMISSIONS.usersManage) ? getMaintenanceUsers() : Promise.resolve([]),
  ]);
  redirectOutOfRangePage(parsePage(params.page), requests.pagination.totalPages, "/maintenance", params);
  return <div className="space-y-6"><PageHeader title="Maintenance" description="Create, assign, track, complete, verify, and close room maintenance work." /><Suspense fallback={<div className="h-17 border" />}><ListToolbar placeholder="Search problem, room, notes, or assignee" statuses={[{ value: "open", label: "Open" }, { value: "assigned", label: "Assigned" }, { value: "in_progress", label: "In progress" }, { value: "on_hold", label: "On hold" }, { value: "completed", label: "Completed" }, { value: "verified", label: "Verified" }, { value: "closed", label: "Closed" }, { value: "cancelled", label: "Cancelled" }]} /></Suspense><MaintenanceManager requests={requests.data} rooms={rooms} users={users} canCreate={Boolean(user && can(user, PERMISSIONS.maintenanceCreate))} canUpdate={Boolean(user && can(user, PERMISSIONS.maintenanceUpdate))} /><Pagination {...requests.pagination} itemLabel="requests" searchParams={{ search: params.search, status: params.status }} /></div>;
}
