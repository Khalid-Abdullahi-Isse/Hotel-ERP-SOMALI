import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Plus } from "lucide-react";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getReservations } from "@/services/reservation.server";

export const metadata: Metadata = { title: "Reservations" };

export default async function ReservationsPage() {
  const reservations = await getReservations({ page: 1, pageSize: 25 });
  return (
    <div className="space-y-6">
      <PageHeader title="Reservations" description="Manage bookings, stays, and guest arrivals from one place." actions={<><Button asChild variant="outline" className="h-9"><Link href="/reservations/timeline"><CalendarRange />Timeline</Link></Button><Button asChild className="h-9"><Link href="/reservations/new"><Plus />New reservation</Link></Button></>} />
      <Card className="py-0"><ReservationsTable reservations={reservations.data} /></Card>
    </div>
  );
}
