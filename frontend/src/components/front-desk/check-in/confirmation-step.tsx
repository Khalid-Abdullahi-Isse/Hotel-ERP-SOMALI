"use client";

import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { ApiError } from "@/lib/api-error";
import type { ApiGuest, ApiReservation, ApiReservationPayments } from "@/types/api-contracts";
import { SummaryGrid, SummaryItem } from "./check-in-summary";

function money(value: string, currency?: "USD" | "SOS") {
  return currency ? formatCurrency(Number(value), currency) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value));
}

export function ConfirmationStep({ reservation, guest, payments, currency, canCheckIn, error, isPending, onBack, onConfirm, onChangeRoom }: { reservation: ApiReservation; guest: ApiGuest; payments: ApiReservationPayments; currency?: "USD" | "SOS"; canCheckIn: boolean; error: ApiError | null; isPending: boolean; onBack: () => void; onConfirm: () => void; onChangeRoom: () => void }) {
  const roomReady = reservation.rooms.every((entry) => entry.room.status === "AVAILABLE" && entry.room.isActive);
  const conflict = error?.code === "ROOM_NOT_READY_FOR_CHECK_IN" || error?.code === "ROOM_ALREADY_BOOKED" || error?.code === "ROOM_NOT_RESERVABLE" || error?.code === "TRANSACTION_CONFLICT";
  return (
    <section aria-labelledby="confirmation-step-title" className="space-y-6">
      <div><h1 id="confirmation-step-title" className="text-xl font-semibold">Confirm Check-In</h1><p className="mt-1 text-sm text-muted-foreground">Review the complete stay before committing the backend transaction.</p></div>
      {error ? <Alert variant="destructive"><ShieldAlert /><AlertTitle>{conflict ? "Room unavailable" : error.code === "CHECK_IN_OUTSIDE_STAY_DATES" ? "Check-in unavailable" : error.code === "RESERVATION_NOT_READY_FOR_CHECK_IN" ? "Unable to check in" : error.status ? "Unable to check in" : "Hotel server unavailable"}</AlertTitle><AlertDescription>{conflict ? "One or more assigned rooms are no longer available. Please select another available room before continuing." : error.status ? error.message : "We could not complete this check-in. Your progress has not been lost."}</AlertDescription>{conflict ? <Button variant="outline" size="sm" className="mt-3" onClick={onChangeRoom}>Change room</Button> : null}</Alert> : null}
      <div className="rounded-lg border bg-muted/20 p-5"><h2 className="mb-5 text-sm font-semibold">Ready to check in</h2><SummaryGrid><SummaryItem label="Guest">{guest.fullName}</SummaryItem><SummaryItem label="Reservation">{reservation.bookingNumber}</SummaryItem><SummaryItem label="Room">{reservation.rooms.map((entry) => `${entry.room.roomNumber} — ${entry.room.roomType.name}`).join(", ")}</SummaryItem><SummaryItem label="Stay">{formatShortDate(reservation.checkInDate)} → {formatShortDate(reservation.checkOutDate)}</SummaryItem><SummaryItem label="Nights">{reservation.nights}</SummaryItem><SummaryItem label="Total">{money(payments.summary.totalAmount, currency)}</SummaryItem><SummaryItem label="Paid">{money(payments.summary.netPaidAmount, currency)}</SummaryItem><SummaryItem label="Balance">{money(payments.summary.outstandingAmount, currency)}</SummaryItem></SummaryGrid></div>
      <ul className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2" aria-label="Readiness checks"><Readiness label="Reservation confirmed" ready={reservation.status === "CONFIRMED"} /><Readiness label="Guest verified" ready={Boolean(guest.fullName)} /><Readiness label="Room available" ready={roomReady} /><Readiness label="Room clean" ready={roomReady} /><Readiness label="Stay dates will be validated by the hotel server" ready /></ul>
      {!canCheckIn ? <Alert><ShieldAlert /><AlertTitle>Permission required</AlertTitle><AlertDescription>Your account does not have permission to confirm check-ins.</AlertDescription></Alert> : null}
      <div className="flex justify-between gap-2 border-t pt-5"><Button variant="outline" onClick={onBack} disabled={isPending}>Back</Button>{canCheckIn ? <Button onClick={onConfirm} disabled={isPending || !roomReady || reservation.status !== "CONFIRMED"}>{isPending ? "Checking in..." : "Confirm Check-in"}</Button> : null}</div>
    </section>
  );
}

function Readiness({ label, ready }: { label: string; ready: boolean }) {
  const Icon = ready ? CheckCircle2 : XCircle;
  return <li className={ready ? "flex items-center gap-2 text-status-available" : "flex items-center gap-2 text-destructive"}><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</li>;
}
