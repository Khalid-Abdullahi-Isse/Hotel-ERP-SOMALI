import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Plus } from "lucide-react";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getReservations } from "@/services/reservation.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { ReservationStatus } from "@/types/reservation";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";
import { getHotelContext } from "@/services/system.server";
import { currentDateInTimeZone } from "@/lib/format";

export const metadata: Metadata = { title: "Reservations" };

const statuses: Array<{ value: ReservationStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "checked_out", label: "Checked out" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; arrivalFrom?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const arrivalFrom = params.arrivalFrom && /^\d{4}-\d{2}-\d{2}$/.test(params.arrivalFrom)
    ? params.arrivalFrom
    : undefined;
  const status = statuses.some((item) => item.value === params.status)
    ? (params.status as ReservationStatus)
    : undefined;
  const [reservations, user, hotel] = await Promise.all([getReservations({ page, limit: 30, search: params.search, status, arrivalFrom }), getCurrentUser(), getHotelContext()]);
  if (
    reservations.pagination.totalPages > 0 &&
    page > reservations.pagination.totalPages
  ) {
    const query = new URLSearchParams({
      page: String(reservations.pagination.totalPages),
    });
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (arrivalFrom) query.set("arrivalFrom", arrivalFrom);
    redirect(`/reservations?${query}`);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Manage bookings, stays, and guest arrivals from one place."
        actions={
          <>
            <Button asChild variant="outline" className="h-9">
              <Link href="/reservations/timeline">
                <CalendarRange />
                Timeline
              </Link>
            </Button>
            {user && can(user, PERMISSIONS.reservationsCreate) ? <Button asChild className="h-9">
              <Link href="/reservations/new">
                <Plus />
                New reservation
              </Link>
            </Button> : null}
          </>
        }
      />
      <Card className="py-0">
        <Suspense fallback={<div className="h-17 border-b" />}>
          <ListToolbar
            placeholder="Search guest or booking ID"
            statuses={statuses}
          />
        </Suspense>
        <ReservationsTable reservations={reservations.data} businessDate={currentDateInTimeZone(hotel.timezone)} permissions={{ canCheckIn: Boolean(user && can(user, PERMISSIONS.checkInCreate)), canConfirm: Boolean(user && can(user, PERMISSIONS.reservationsConfirm)), canCancel: Boolean(user && can(user, PERMISSIONS.reservationsCancel)) }} />
        <Pagination
          {...reservations.pagination}
          itemLabel="reservations"
          searchParams={{ search: params.search, status: params.status, arrivalFrom }}
        />
      </Card>
    </div>
  );
}
