"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ReservationStatusBadge } from "@/components/shared/reservation-status-badge";
import { getApiError } from "@/lib/api-error";
import { formatCurrency, formatShortDate, titleCase } from "@/lib/format";
import { reservationService } from "@/services/reservation.service";
import type { CheckInInitialData } from "@/types/check-in";
import { CheckoutPaymentSection } from "./checkout-payment-section";
import { StayChargeForm } from "./stay-charge-form";
import { SummaryGrid, SummaryItem } from "./check-in/check-in-summary";

const statusMap = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

type Currency = "USD" | "SOS";

function money(value: string, currency?: Currency) {
  return currency
    ? formatCurrency(Number(value), currency)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value));
}

interface StayDetailProps {
  data: CheckInInitialData;
  currency?: Currency;
  canCheckOut: boolean;
  canCreatePayment: boolean;
  canCreateCharge: boolean;
  canVoidCharge?: boolean;
  canCreateInvoice?: boolean;
}

export function StayDetail({ data, currency, canCheckOut, canCreatePayment, canCreateCharge, canVoidCharge = false, canCreateInvoice = false }: StayDetailProps) {
  const router = useRouter();
  const reservationId = data.reservation.id;
  const [checkedOut, setCheckedOut] = useState(data.reservation.status === "CHECKED_OUT");
  const queryClient = useQueryClient();
  const folioQuery = useQuery({
    queryKey: ["folio", reservationId],
    queryFn: () => reservationService.folio(reservationId),
    initialData: data.folio,
  });
  const paymentsQuery = useQuery({
    queryKey: ["reservation-payments", reservationId],
    queryFn: () => reservationService.payments(reservationId),
    initialData: data.payments,
  });
  const folio = folioQuery.data;
  const payments = paymentsQuery.data;
  const hasOutstandingBalance = Number(payments.summary.outstandingAmount) > 0;

  const checkout = useMutation({
    mutationFn: () => reservationService.checkOut(reservationId),
    onSuccess: async (result) => {
      setCheckedOut(true);
      queryClient.setQueryData(["folio", reservationId], result.folio);
      await Promise.all([
        paymentsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["front-desk"] }),
      ]);
    },
  });

  const issueInvoice = useMutation({
    mutationFn: () => reservationService.createInvoice(reservationId),
    onSuccess: () => {
      router.refresh();
    },
  });

  const status = checkedOut ? "CHECKED_OUT" : data.reservation.status;
  const refreshFinancials = async () => {
    const [, refreshedPayments] = await Promise.all([
      folioQuery.refetch(),
      paymentsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
    ]);
    return refreshedPayments.data?.summary.outstandingAmount ?? payments.summary.outstandingAmount;
  };

  return (
    <div className="space-y-5">
      {checkedOut ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Check-out completed</AlertTitle>
          <AlertDescription>
            The reservation is checked out, assigned rooms are dirty, and housekeeping tasks were created by the hotel server.
          </AlertDescription>
        </Alert>
      ) : null}

      {checkout.error ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Unable to check out</AlertTitle>
          <AlertDescription>{getApiError(checkout.error).message}</AlertDescription>
        </Alert>
      ) : null}

      {!checkedOut && hasOutstandingBalance ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>Payment required before checkout</AlertTitle>
          <AlertDescription>
            Record the outstanding balance of {money(payments.summary.outstandingAmount, currency)} in the checkout payment section before completing this stay.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Stay {data.reservation.bookingNumber}</h1>
            <ReservationStatusBadge status={statusMap[status]} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Reception view for {data.guest.fullName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/front-desk">Back to Front Desk</Link></Button>
          {canCheckOut && status === "CHECKED_IN" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={checkout.isPending || hasOutstandingBalance}
                  title={hasOutstandingBalance ? "Settle the outstanding balance first" : undefined}
                  aria-busy={checkout.isPending}
                >
                  <LogOut />
                  {checkout.isPending ? "Checking out…" : "Check out"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Check out this stay?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The hotel server will verify that the balance is settled, post room charges, mark every assigned room dirty, and create housekeeping tasks.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => checkout.mutate()}>Confirm check-out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Stay details</CardTitle></CardHeader>
            <CardContent>
              <SummaryGrid>
                <SummaryItem label="Guest">{data.guest.fullName}</SummaryItem>
                <SummaryItem label="Rooms">
                  {data.reservation.rooms.map((entry) => `${entry.room.roomNumber} — ${entry.room.roomType.name}`).join(", ")}
                </SummaryItem>
                <SummaryItem label="Arrival">{formatShortDate(data.reservation.checkInDate)}</SummaryItem>
                <SummaryItem label="Departure">{formatShortDate(data.reservation.checkOutDate)}</SummaryItem>
                <SummaryItem label="Nights">{data.reservation.nights}</SummaryItem>
                <SummaryItem label="Checked in">
                  {data.reservation.checkedInAt
                    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.reservation.checkedInAt))
                    : "Not recorded"}
                </SummaryItem>
              </SummaryGrid>
              {data.reservation.notes ? (
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm">{data.reservation.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <StayChargeForm
            reservationId={reservationId}
            currency={currency}
            canCreate={canCreateCharge}
            disabled={checkedOut}
            onChargePosted={async () => {
              await refreshFinancials();
            }}
          />

          <Card>
            <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {folio.roomLines.map((line) => (
                <Line key={line.reservationRoomId} label={`Room ${line.roomNumber} · ${line.nights} nights`} value={money(line.amount, currency)} />
              ))}
              {folio.charges
                .filter((charge) => !charge.voidedAt && charge.type !== "ROOM")
                .map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between gap-2">
                    <Line label={charge.description} value={money(charge.totalAmount, currency)} />
                    {canVoidCharge && charge.type === "SERVICE" ? (
                      <VoidChargeButton chargeId={charge.id} onVoided={() => refreshFinancials()} />
                    ) : null}
                  </div>
                ))}
              {folio.charges.filter((charge) => !charge.voidedAt && charge.type !== "ROOM").length === 0 ? (
                <p className="text-sm text-muted-foreground">No service charges posted.</p>
              ) : null}
            </CardContent>
          </Card>

          {checkedOut && canCreateInvoice ? (
            <Card>
              <CardContent className="pt-6">
                {issueInvoice.error ? (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{getApiError(issueInvoice.error).message}</AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  onClick={() => issueInvoice.mutate()}
                  disabled={issueInvoice.isPending}
                  className="w-full"
                >
                  <FileText />
                  {issueInvoice.isPending ? "Issuing invoice..." : "Issue invoice"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <CheckoutPaymentSection
            key={payments.summary.outstandingAmount}
            reservationId={reservationId}
            payments={payments}
            currency={currency}
            canPay={canCreatePayment}
            disabled={checkedOut}
            onPaymentRecorded={refreshFinancials}
          />

          <Card>
            <CardHeader><CardTitle>Folio</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Line label="Subtotal" value={money(folio.subtotal, currency)} />
              <Line label="Discount" value={`−${money(folio.discountAmount, currency)}`} />
              <div className="border-t pt-3">
                <Line label="Total" value={money(payments.summary.totalAmount, currency)} strong />
              </div>
              <Line label="Paid" value={money(payments.summary.netPaidAmount, currency)} />
              <Line label="Balance" value={money(payments.summary.outstandingAmount, currency)} strong />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Reservation history</CardTitle></CardHeader>
            <CardContent>
              {data.reservation.history?.length ? (
                <ol className="space-y-3">
                  {data.reservation.history.map((item) => (
                    <li key={item.id} className="border-l-2 pl-3">
                      <p className="text-sm font-medium">{titleCase(item.toStatus)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.note || "Status updated"} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No history entries available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 font-semibold" : "flex justify-between gap-3 text-sm"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function VoidChargeButton({ chargeId, onVoided }: { chargeId: string; onVoided: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => reservationService.voidCharge(chargeId, reason),
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      await onVoided();
    },
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground hover:text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this charge?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The charge will be marked as voided and excluded from the folio total.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for voiding (required)"
          maxLength={500}
        />
        {mutation.error ? (
          <Alert variant="destructive">
            <AlertDescription>{getApiError(mutation.error).message}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending || reason.trim().length < 3}
            onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
          >
            {mutation.isPending ? "Voiding..." : "Void charge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
