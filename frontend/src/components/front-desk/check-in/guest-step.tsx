"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { reservationService } from "@/services/reservation.service";
import type { ApiGuest, ApiReservation } from "@/types/api-contracts";
import { SummaryGrid, SummaryItem } from "./check-in-summary";

type GuestValues = Pick<ApiGuest, "fullName" | "phone" | "email" | "nationality" | "passportNumber" | "nationalId" | "address" | "notes">;

export function GuestStep({ guest, reservation, canEdit, onGuestChange, onBack, onContinue }: { guest: ApiGuest; reservation: ApiReservation; canEdit: boolean; onGuestChange: (guest: ApiGuest) => void; onBack: () => void; onContinue: () => void }) {
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [values, setValues] = useState<GuestValues>(() => ({ fullName: guest.fullName, phone: guest.phone, email: guest.email, nationality: guest.nationality, passportNumber: guest.passportNumber ?? null, nationalId: guest.nationalId ?? null, address: guest.address ?? null, notes: guest.notes ?? null }));
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: () => reservationService.updateGuest(guest.id, values),
    onSuccess: (updated) => {
      onGuestChange(updated);
      queryClient.setQueryData(["guest", guest.id], updated);
      setSuccess(true);
      setEditing(false);
    },
  });
  const set = (field: keyof GuestValues, value: string) => setValues((current) => ({ ...current, [field]: value || null }));

  return (
    <section aria-labelledby="guest-step-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="guest-step-title" className="text-xl font-semibold">Guest</h1><p className="mt-1 text-sm text-muted-foreground">Verify the guest&apos;s contact and identity details.</p></div>{canEdit ? <Button variant="outline" size="sm" onClick={() => { setSuccess(false); setEditing((value) => !value); }}><Pencil />{editing ? "Cancel editing" : "Edit guest"}</Button> : null}</div>
      {success ? <Alert><Check /><AlertTitle>Guest updated</AlertTitle><AlertDescription>The existing guest record was updated. No duplicate was created.</AlertDescription></Alert> : null}
      {update.error ? <Alert variant="destructive"><AlertTitle>Unable to update guest</AlertTitle><AlertDescription>{getApiError(update.error).message}</AlertDescription></Alert> : null}
      {editing ? (
        <form className="grid gap-4 rounded-lg border bg-muted/20 p-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
          <GuestField label="Full name" value={values.fullName} onChange={(value) => set("fullName", value)} required />
          <GuestField label="Phone" value={values.phone ?? ""} onChange={(value) => set("phone", value)} />
          <GuestField label="Email" type="email" value={values.email ?? ""} onChange={(value) => set("email", value)} />
          <GuestField label="Nationality" value={values.nationality ?? ""} onChange={(value) => set("nationality", value)} />
          <GuestField label="Passport number" value={values.passportNumber ?? ""} onChange={(value) => set("passportNumber", value)} />
          <GuestField label="National ID" value={values.nationalId ?? ""} onChange={(value) => set("nationalId", value)} />
          <GuestField label="Address" value={values.address ?? ""} onChange={(value) => set("address", value)} />
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="guest-notes">Notes</Label><Textarea id="guest-notes" value={values.notes ?? ""} onChange={(event) => set("notes", event.target.value)} /></div>
          <div className="sm:col-span-2 sm:text-right"><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving..." : "Save guest"}</Button></div>
        </form>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-5"><SummaryGrid><SummaryItem label="Full name">{guest.fullName}</SummaryItem><SummaryItem label="Phone">{guest.phone || "Not provided"}</SummaryItem><SummaryItem label="Email">{guest.email || "Not provided"}</SummaryItem><SummaryItem label="Nationality">{guest.nationality || "Not provided"}</SummaryItem><SummaryItem label="ID type">{guest.passportNumber ? "Passport" : guest.nationalId ? "National ID" : "Not provided"}</SummaryItem><SummaryItem label="ID number">{guest.passportNumber || guest.nationalId || "Not provided"}</SummaryItem><SummaryItem label="Adults">{reservation.adults}</SummaryItem><SummaryItem label="Children">{reservation.children}</SummaryItem></SummaryGrid></div>
      )}
      <div className="flex justify-between gap-2 border-t pt-5"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onContinue} disabled={editing || update.isPending}>Continue</Button></div>
    </section>
  );
}

function GuestField({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  const id = `guest-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></div>;
}
