"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiError } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import { reservationService } from "@/services/reservation.service";
import type { ApiFolio, ApiReservationPayments } from "@/types/api-contracts";

function money(value: string, currency?: "USD" | "SOS") {
  return currency ? formatCurrency(Number(value), currency) : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value));
}

export function PaymentStep({ reservationId, folio, payments, currency, canPay, onPaymentRecorded, onBack, onContinue }: { reservationId: string; folio: ApiFolio; payments: ApiReservationPayments; currency?: "USD" | "SOS"; canPay: boolean; onPaymentRecorded: () => Promise<void>; onBack: () => void; onContinue: () => void }) {
  const [showPayment, setShowPayment] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const methods = useQuery({ queryKey: ["payment-methods"], queryFn: reservationService.paymentMethods, enabled: showPayment && canPay });
  const payment = useMutation({ mutationFn: () => reservationService.createPayment({ reservationId, paymentMethodId: methodId, requestKey, amount, reference: reference || undefined }), onSuccess: async () => { await onPaymentRecorded(); setShowPayment(false); setAmount(""); setReference(""); setRequestKey(crypto.randomUUID()); } });
  const services = folio.charges.filter((charge) => charge.type !== "ROOM" && !charge.voidedAt).reduce((sum, charge) => sum + Number(charge.totalAmount), 0);
  const rooms = folio.roomLines.reduce((sum, room) => sum + Number(room.amount), 0);
  return (
    <section aria-labelledby="payment-step-title" className="space-y-6">
      <div><h1 id="payment-step-title" className="text-xl font-semibold">Stay &amp; Payment</h1><p className="mt-1 text-sm text-muted-foreground">Review the backend-calculated folio and current payment balance.</p></div>
      <div className="rounded-lg border bg-muted/20 p-5"><h2 className="text-sm font-semibold">Stay summary</h2><dl className="mt-4 space-y-3 text-sm"><MoneyRow label="Room subtotal" value={money(String(rooms), currency)} />{folio.roomLines.map((room) => <MoneyRow key={room.reservationRoomId} label={`Room ${room.roomNumber} · ${room.nights} night${room.nights === 1 ? "" : "s"} × ${money(room.nightlyRate, currency)}`} value={money(room.amount, currency)} muted />)}<MoneyRow label="Services" value={money(String(services), currency)} /><MoneyRow label="Discount" value={`−${money(folio.discountAmount, currency)}`} /><div className="border-t pt-3"><MoneyRow label="Estimated total" value={money(payments.summary.totalAmount, currency)} strong /></div><MoneyRow label="Paid" value={money(payments.summary.netPaidAmount, currency)} /><MoneyRow label="Balance" value={money(payments.summary.outstandingAmount, currency)} strong /></dl></div>
      <div className="rounded-lg border p-4"><p className="text-sm font-medium">Payment timing</p><p className="mt-1 text-sm text-muted-foreground">Payment is not required by the check-in endpoint. The guest may pay in full, leave a partial deposit, or pay later according to hotel policy.</p>{canPay ? <Button variant="outline" className="mt-3" onClick={() => setShowPayment((value) => !value)}>{showPayment ? "Cancel payment" : "Pay now / Record deposit"}</Button> : null}{showPayment ? <form className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); payment.mutate(); }}><div className="space-y-2"><Label htmlFor="payment-method">Payment method</Label><Select value={methodId} onValueChange={setMethodId}><SelectTrigger id="payment-method"><SelectValue placeholder={methods.isLoading ? "Loading..." : "Select method"} /></SelectTrigger><SelectContent>{methods.data?.map((method) => <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="payment-amount">Amount</Label><Input id="payment-amount" inputMode="decimal" pattern="\d{1,12}(\.\d{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="payment-reference">Reference</Label><Input id="payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} /></div>{payment.error ? <Alert variant="destructive" className="sm:col-span-3"><AlertTitle>Unable to record payment</AlertTitle><AlertDescription>{getApiError(payment.error).message}</AlertDescription></Alert> : null}<div className="sm:col-span-3 sm:text-right"><Button type="submit" disabled={!methodId || !amount || payment.isPending}>{payment.isPending ? "Recording..." : "Record payment"}</Button></div></form> : null}</div>
      <div className="flex justify-between gap-2 border-t pt-5"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onContinue}>Continue</Button></div>
    </section>
  );
}

function MoneyRow({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return <div className={muted ? "flex justify-between gap-4 pl-3 text-xs text-muted-foreground" : strong ? "flex justify-between gap-4 font-semibold" : "flex justify-between gap-4"}><dt>{label}</dt><dd className="shrink-0">{value}</dd></div>;
}
