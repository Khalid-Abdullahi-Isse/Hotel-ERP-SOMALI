import type { Metadata } from "next";
import { HousekeepingBoard } from "@/components/housekeeping/housekeeping-board";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getHousekeepingTasks } from "@/services/housekeeping.server";
import { Pagination } from "@/components/shared/pagination";
import { parsePage } from "@/lib/pagination";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Housekeeping" };

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = parsePage(params.page);
  const [tasks, user] = await Promise.all([
    getHousekeepingTasks({
      page: currentPage,
      status: params.status,
      search: params.search,
    }),
    getCurrentUser(),
  ]);

  redirectOutOfRangePage(
    currentPage,
    tasks.pagination.totalPages,
    "/housekeeping",
    params,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Housekeeping"
        description="Manage cleaning tasks and room readiness."
      />
      <div>
        <HousekeepingBoard
          tasks={tasks.data}
          total={tasks.pagination.total}
          canUpdate={Boolean(
            user && can(user, PERMISSIONS.housekeepingUpdate),
          )}
        />
        <Pagination
          {...tasks.pagination}
          itemLabel="tasks"
          searchParams={{ status: params.status, search: params.search }}
        />
      </div>
    </div>
  );
}
