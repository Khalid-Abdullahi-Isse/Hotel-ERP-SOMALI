import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck, Wrench } from "lucide-react";
import { RecentReservations } from "@/components/dashboard/recent-reservations";
import { RoomStatusOverview } from "@/components/dashboard/room-status-overview";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { formatCurrency, titleCase } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getDashboardSummary } from "@/services/dashboard.server";
import { getReservations } from "@/services/reservation.server";
import type { DashboardMetric, RoomStatusCount } from "@/types/dashboard";
import { ROOM_STATUSES } from "@/types/room";
import { SectionHeader } from "@/components/shared/section-header";

export const metadata: Metadata = { title: "Dashboard" };

function total(values: Record<string, number>) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.dashboardRead)) redirect("/front-desk");

  const summary = await getDashboardSummary();
  const canViewReservations = can(user, PERMISSIONS.reservationsRead);
  const reservations = canViewReservations ? await getReservations({ page: 1, limit: 5, arrivalFrom: summary.businessDate }) : null;
  const occupied = summary.rooms.occupied ?? 0;
  const occupancy = summary.rooms.total ? Math.round((occupied / summary.rooms.total) * 100) : 0;
  const metrics: DashboardMetric[] = [
    { id: "occupancy", label: "Occupancy", value: `${occupancy}%`, supportingText: `${occupied} of ${summary.rooms.total} rooms`, icon: "occupancy" },
    { id: "arrivals", label: "Arrivals", value: String(summary.guests.arrivals), supportingText: "due today", icon: "arrivals" },
    { id: "departures", label: "Departures", value: String(summary.guests.departures), supportingText: "due today", icon: "departures" },
    { id: "available", label: "Available rooms", value: String(summary.rooms.available ?? 0), supportingText: "ready to assign", icon: "rooms" },
    ...(can(user, PERMISSIONS.paymentsRead) && can(user, PERMISSIONS.expensesRead) ? [{ id: "revenue", label: "Net revenue", value: formatCurrency(Number(summary.financial.net), summary.currencyCode), supportingText: "for this business date", icon: "revenue" } as DashboardMetric] : []),
  ];
  const roomStatuses: RoomStatusCount[] = ROOM_STATUSES.map((status) => ({
    status,
    label: titleCase(status),
    count: summary.rooms[status] ?? 0,
  }));
  const housekeeping = total(summary.operations.housekeeping);
  const maintenance = total(summary.operations.maintenance);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Operational overview for ${summary.businessDate} · ${summary.timezone}`}
        actions={can(user, PERMISSIONS.reservationsCreate) ? <Button asChild><Link href="/reservations/new">New reservation</Link></Button> : null}
      />
      <SectionHeader title="Operational summary" description="Live counts for the current business date" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => <StatCard key={metric.id} metric={metric} />)}
      </div>
      <SectionHeader title="Today's activity" description="Bookings and room inventory that shape the current shift" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        {reservations ? <RecentReservations reservations={reservations.data} title="Upcoming reservations" description="Saved bookings ordered by arrival date" viewAllHref={`/reservations?arrivalFrom=${encodeURIComponent(summary.businessDate)}`} /> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Reservation access is not enabled for this account.</CardContent></Card>}
        <RoomStatusOverview statuses={roomStatuses} />
      </div>
      <SectionHeader title="Requires attention" description="Open operational work by department" />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ...(can(user, PERMISSIONS.housekeepingRead) ? [{ title: "Housekeeping", count: housekeeping, detail: "open tasks", href: "/housekeeping", icon: ClipboardCheck }] : []),
          ...(can(user, PERMISSIONS.maintenanceRead) ? [{ title: "Maintenance", count: maintenance, detail: "open requests", href: "/maintenance", icon: Wrench }] : []),
        ].map((item) => <Card key={item.title}><CardHeader className="grid grid-cols-[1fr_auto]"><div><CardTitle>{item.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div><item.icon className="size-5 text-primary" /></CardHeader><CardContent className="flex items-end justify-between"><span className="text-3xl font-semibold tabular-nums">{item.count}</span><Button asChild variant="ghost" size="sm"><Link href={item.href}>Manage <ArrowRight /></Link></Button></CardContent></Card>)}
      </div>
    </div>
  );
}
