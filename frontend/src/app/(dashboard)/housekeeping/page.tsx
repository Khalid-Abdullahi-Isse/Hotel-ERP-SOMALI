import type { Metadata } from "next";
import { HousekeepingBoard } from "@/components/housekeeping/housekeeping-board";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getHousekeepingTasks } from "@/services/housekeeping.server";

export const metadata: Metadata = { title: "Housekeeping" };
export default async function HousekeepingPage() {
  const [tasks, user] = await Promise.all([getHousekeepingTasks(), getCurrentUser()]);
  return <div className="space-y-6"><PageHeader title="Housekeeping" description="Manage cleaning tasks and room readiness." /><HousekeepingBoard tasks={tasks} canUpdate={Boolean(user && can(user, PERMISSIONS.housekeepingUpdate))} /></div>;
}
