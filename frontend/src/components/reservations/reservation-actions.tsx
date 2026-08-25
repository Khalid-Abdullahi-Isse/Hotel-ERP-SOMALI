"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { reservationService } from "@/services/reservation.service";
import type { ReservationSummary } from "@/types/reservation";

interface ActionPermissions { canCheckIn: boolean; canConfirm: boolean; canCancel: boolean }

export function ReservationActions({ reservation, permissions, businessDate, fullWidth = false }: { reservation: ReservationSummary; permissions: ActionPermissions; businessDate: string; fullWidth?: boolean }) {
  if (reservation.status === "checked_in") return <Button asChild size="sm" variant="outline" className={fullWidth ? "w-full" : undefined}><Link href={`/front-desk/stays/${reservation.id}`}>View stay<ArrowRight /></Link></Button>;
  const arrivalToday = reservation.checkIn === businessDate;
  const arrivalPassed = reservation.checkIn < businessDate;
  return <div className={fullWidth ? "grid gap-2" : "flex justify-end gap-2"}>
    {permissions.canCheckIn && reservation.status === "confirmed" && arrivalToday ? <Button asChild size="sm" className={fullWidth ? "w-full" : undefined}><Link href={`/front-desk/check-in/${reservation.id}`}>Check in<ArrowRight /></Link></Button> : null}
    {permissions.canConfirm && reservation.status === "pending" ? <ReservationMutationDialog reservationId={reservation.id} action="confirm" label="Confirm" /> : null}
    {permissions.canCancel && (reservation.status === "pending" || reservation.status === "confirmed") ? <ReservationMutationDialog reservationId={reservation.id} action={arrivalPassed && reservation.status === "confirmed" ? "no-show" : "cancel"} label={arrivalPassed && reservation.status === "confirmed" ? "No show" : "Cancel"} destructive /> : null}
    {!permissions.canConfirm && !permissions.canCancel && !(permissions.canCheckIn && reservation.status === "confirmed" && arrivalToday) ? <span className="text-xs text-muted-foreground">—</span> : null}
  </div>;
}

function ReservationMutationDialog({ reservationId, action, label, destructive = false }: { reservationId: string; action: "confirm" | "cancel" | "no-show"; label: string; destructive?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => action === "confirm" ? reservationService.confirm(reservationId) : action === "cancel" ? reservationService.cancel(reservationId, note) : reservationService.noShow(reservationId, note),
    onSuccess: () => { setOpen(false); router.refresh(); },
  });
  const needsNote = action !== "confirm";
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" variant={destructive ? "outline" : "default"}>{label}</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{label} reservation?</AlertDialogTitle><AlertDialogDescription>{action === "confirm" ? "The room will be reserved and the booking will become eligible for check-in." : action === "cancel" ? "The room allocation will be released. Record a reason for the reservation history." : "The reservation will be closed as a no-show and its room allocation released."}</AlertDialogDescription></AlertDialogHeader>
      {needsNote ? <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reason (required)" maxLength={500} aria-label={`${label} reason`} /> : null}
      {mutation.error ? <Alert variant="destructive"><AlertTitle>Action failed</AlertTitle><AlertDescription>{getApiError(mutation.error).message}</AlertDescription></Alert> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>Keep reservation</AlertDialogCancel><AlertDialogAction className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined} disabled={mutation.isPending || (needsNote && note.trim().length < 2)} onClick={(event) => { event.preventDefault(); mutation.mutate(); }}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : null}{mutation.isPending ? "Saving..." : label}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
