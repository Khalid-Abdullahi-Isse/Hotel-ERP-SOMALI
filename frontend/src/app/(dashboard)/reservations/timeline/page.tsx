import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReservationTimeline } from "@/components/reservations/reservation-timeline";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getReservationTimeline } from "@/services/reservation.server";

export const metadata: Metadata = { title: "Reservation timeline" };
function dateValue(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}
function shift(value: string, days: number) { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export default async function ReservationTimelinePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const start = dateValue((await searchParams).start);
  const rooms = await getReservationTimeline(start);
  const formatter = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(`${start}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + index); const parts = formatter.formatToParts(date); return { weekday: parts.find((part) => part.type === "weekday")?.value ?? "", date: `${parts.find((part) => part.type === "month")?.value} ${parts.find((part) => part.type === "day")?.value}` }; });
  const end = shift(start, 6);
  return <div className="space-y-6"><PageHeader title="Reservation timeline" description="Weekly room occupancy from saved reservation records." actions={<><Button asChild variant="outline" size="sm"><Link href={`/reservations/timeline?start=${shift(start, -7)}`}><ChevronLeft />Previous</Link></Button><Button asChild variant="outline" size="sm"><Link href={`/reservations/timeline?start=${shift(start, 7)}`}>Next<ChevronRight /></Link></Button></>} /><ReservationTimeline rooms={rooms} dates={dates} dateLabel={`${start}–${end}`} /></div>;
}
