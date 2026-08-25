import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, UserRoundPlus, UserRoundSearch } from "lucide-react";
import { FrontDeskSummary } from "@/components/front-desk/front-desk-summary";
import { RoomBoard } from "@/components/front-desk/room-board";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFrontDeskData } from "@/services/front-desk.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";
import { redirectOutOfRangePage } from "@/lib/pagination.server";
import { SectionHeader } from "@/components/shared/section-header";

export const metadata: Metadata = { title: "Front Desk" };
export default async function FrontDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const [{ rooms, metrics, pagination, businessDate }, user] =
    await Promise.all([
      getFrontDeskData({
        page: parsePage(params.page),
        search: params.search,
        status: params.status,
      }),
      getCurrentUser(),
    ]);
  const permissions = {
    canCheckIn: Boolean(user && can(user, PERMISSIONS.checkInCreate)),
    canCreateReservation: Boolean(
      user && can(user, PERMISSIONS.reservationsCreate),
    ),
    canUpdateReservation: Boolean(
      user && can(user, PERMISSIONS.reservationsUpdate),
    ),
    canViewHousekeeping: Boolean(
      user && can(user, PERMISSIONS.housekeepingRead),
    ),
    canViewMaintenance: Boolean(user && can(user, PERMISSIONS.maintenanceRead)),
  };
  redirectOutOfRangePage(
    parsePage(params.page),
    pagination.totalPages,
    "/front-desk",
    params,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Front Desk"
        description="See room readiness, arrivals, active stays, and tasks requiring attention."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/reservations?status=confirmed">
                <Search />
                Find reservation
              </Link>
            </Button>
            {permissions.canCreateReservation ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/guests?mode=reservation">
                    <UserRoundSearch />
                    Existing guest
                  </Link>
                </Button>
                <Button asChild variant="tonal">
                  <Link href="/reservations/new?mode=walk-in">
                    <UserRoundPlus />
                    Walk-in guest
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/reservations/new">
                    <Plus />
                    New reservation
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        }
      />
      <FrontDeskSummary metrics={metrics} />
      <SectionHeader
        title="Room board"
        description={`${pagination.total.toLocaleString()} rooms in the current operational view`}
      />
      <Card className="py-0">
        <Suspense fallback={<div className="h-17 border-b" />}>
          <ListToolbar
            placeholder="Search room number"
            statuses={[
              { value: "available", label: "Available" },
              { value: "reserved", label: "Reserved" },
              { value: "occupied", label: "Occupied" },
              { value: "dirty", label: "Dirty" },
              { value: "cleaning", label: "Cleaning" },
              { value: "maintenance", label: "Maintenance" },
            ]}
          />
        </Suspense>
        <RoomBoard
          rooms={rooms}
          permissions={permissions}
          businessDate={businessDate}
          total={pagination.total}
        />
        <Pagination
          {...pagination}
          itemLabel="rooms"
          searchParams={{ search: params.search, status: params.status }}
        />
      </Card>
    </div>
  );
}
