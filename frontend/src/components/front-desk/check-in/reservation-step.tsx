import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ReservationStatusBadge } from "@/components/shared/reservation-status-badge";
import { formatShortDate } from "@/lib/format";
import { SummaryGrid, SummaryItem } from "./check-in-summary";
import type { ApiReservation } from "@/types/api-contracts";

const statusMap = { PENDING: "pending", CONFIRMED: "confirmed", CHECKED_IN: "checked_in", CHECKED_OUT: "checked_out", CANCELLED: "cancelled", NO_SHOW: "no_show" } as const;

function unavailableMessage(status: ApiReservation["status"]) {
  if (status === "CHECKED_IN") return "This reservation has already been checked in.";
  if (status === "CHECKED_OUT") return "This stay has already been checked out.";
  if (status === "CANCELLED") return "A cancelled reservation cannot be checked in.";
  if (status === "NO_SHOW") return "A no-show reservation cannot be checked in.";
  return "This reservation must be confirmed before check-in.";
}

export function ReservationStep({ reservation, onContinue }: { reservation: ApiReservation; onContinue: () => void }) {
  const ready = reservation.status === "CONFIRMED";
  return (
    <section aria-labelledby="reservation-step-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="reservation-step-title" className="text-xl font-semibold">Reservation</h1><p className="mt-1 text-sm text-muted-foreground">Confirm that this is the guest&apos;s reservation.</p></div><ReservationStatusBadge status={statusMap[reservation.status]} /></div>
      {!ready ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Check-in unavailable</AlertTitle><AlertDescription>{unavailableMessage(reservation.status)}</AlertDescription></Alert> : null}
      <div className="rounded-lg border bg-muted/20 p-5"><p className="mb-5 text-sm font-semibold">Reservation {reservation.bookingNumber}</p><SummaryGrid><SummaryItem label="Guest">{reservation.guest.fullName}</SummaryItem><SummaryItem label="Arrival">{formatShortDate(reservation.checkInDate)}</SummaryItem><SummaryItem label="Departure">{formatShortDate(reservation.checkOutDate)}</SummaryItem><SummaryItem label="Nights">{reservation.nights}</SummaryItem><SummaryItem label="Guests">{reservation.adults} Adult{reservation.adults === 1 ? "" : "s"}{reservation.children ? ` · ${reservation.children} Child${reservation.children === 1 ? "" : "ren"}` : ""}</SummaryItem><SummaryItem label="Rooms">{reservation.rooms.length}</SummaryItem></SummaryGrid>{reservation.notes ? <div className="mt-5 border-t pt-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p><p className="mt-1 text-sm">{reservation.notes}</p></div> : null}</div>
      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between"><Button asChild variant="outline"><Link href="/front-desk">Back to Front Desk</Link></Button><Button onClick={onContinue} disabled={!ready}>Continue</Button></div>
    </section>
  );
}
