"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiError } from "@/lib/api-error";
import { formatCurrency, titleCase } from "@/lib/format";
import { reservationService } from "@/services/reservation.service";
import type { ApiReservationPayments } from "@/types/api-contracts";

type Currency = "USD" | "SOS";

interface CheckoutPaymentSectionProps {
  reservationId: string;
  payments: ApiReservationPayments;
  currency?: Currency;
  canPay: boolean;
  disabled?: boolean;
  onPaymentRecorded: () => Promise<string>;
}

function money(value: string, currency?: Currency) {
  return currency
    ? formatCurrency(Number(value), currency)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        Number(value),
      );
}

function paymentIcon(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes("cash")) return WalletCards;
  if (normalized.includes("bank") || normalized.includes("transfer"))
    return Landmark;
  return CreditCard;
}

export function CheckoutPaymentSection({
  reservationId,
  payments,
  currency,
  canPay,
  disabled = false,
  onPaymentRecorded,
}: CheckoutPaymentSectionProps) {
  const outstanding = Number(payments.summary.outstandingAmount);
  const settled = outstanding <= 0;
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState(
    settled ? "" : payments.summary.outstandingAmount,
  );
  const [reference, setReference] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [announcement, setAnnouncement] = useState("");

  const methods = useQuery({
    queryKey: ["payment-methods"],
    queryFn: reservationService.paymentMethods,
    enabled: canPay && !disabled && !settled,
  });

  const amountError = useMemo(() => {
    if (!amount) return "Enter the amount received.";
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
      return "Enter a valid amount with up to two decimal places.";
    if (Number(amount) > outstanding)
      return "The amount cannot exceed the remaining balance.";
    return null;
  }, [amount, outstanding]);

  const payment = useMutation({
    mutationFn: () =>
      reservationService.createPayment({
        reservationId,
        paymentMethodId: methodId,
        requestKey,
        amount,
        reference: reference.trim() || undefined,
      }),
    onSuccess: async () => {
      const remainingBalance = await onPaymentRecorded();
      setAmount(Number(remainingBalance) > 0 ? remainingBalance : "");
      setReference("");
      setRequestKey(crypto.randomUUID());
      setAnnouncement("Payment recorded. The checkout balance has been updated.");
    },
  });

  return (
    <Card className="gap-0 py-0" aria-labelledby="checkout-payment-title">
      <CardHeader className="border-b bg-surface-container-low py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <CreditCard className="size-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle id="checkout-payment-title">Checkout payment</CardTitle>
            <CardDescription>
              Review and settle the guest&apos;s balance.
            </CardDescription>
          </div>
        </div>
        <CardAction>
          {settled ? (
            <Badge className="border-success/20 bg-success/10 text-success">
              <CheckCircle2 data-icon="inline-start" />
              Paid in full
            </Badge>
          ) : (
            <Badge className="border-warning/20 bg-warning/10 text-warning">
              Balance due
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        <div className="px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {settled ? "Balance settled" : "Amount due"}
          </p>
          <p
            className={`mt-1 font-heading text-3xl font-semibold tabular-nums ${settled ? "text-success" : "text-foreground"}`}
          >
            {money(payments.summary.outstandingAmount, currency)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Folio total</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {money(payments.summary.totalAmount, currency)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-muted-foreground">Paid to date</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {money(payments.summary.netPaidAmount, currency)}
              </dd>
            </div>
          </dl>
        </div>

        {!settled && !disabled ? (
          <div className="border-t bg-surface-container-low px-5 py-5">
            {canPay ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAnnouncement("");
                  if (!amountError && methodId) payment.mutate();
                }}
              >
                <div>
                  <h3 className="font-medium">Record payment</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The full remaining balance is entered by default.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="checkout-payment-method">Payment method</Label>
                    <Select value={methodId} onValueChange={setMethodId}>
                      <SelectTrigger
                        id="checkout-payment-method"
                        className="w-full"
                        aria-invalid={payment.isError && !methodId}
                      >
                        <SelectValue
                          placeholder={methods.isLoading ? "Loading methods…" : "Select method"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {methods.data?.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {methods.isError ? (
                      <p className="text-xs text-destructive">
                        Payment methods could not be loaded.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="checkout-payment-amount">
                        Amount{currency ? ` (${currency})` : ""}
                      </Label>
                      {amount !== payments.summary.outstandingAmount ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => setAmount(payments.summary.outstandingAmount)}
                        >
                          Use full balance
                        </button>
                      ) : null}
                    </div>
                    <Input
                      id="checkout-payment-amount"
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      aria-invalid={Boolean(amount && amountError)}
                      aria-describedby="checkout-payment-amount-help"
                      required
                    />
                    <p
                      id="checkout-payment-amount-help"
                      className={amount && amountError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                    >
                      {amount && amountError
                        ? amountError
                        : `Maximum ${money(payments.summary.outstandingAmount, currency)}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-payment-reference">
                    Reference <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="checkout-payment-reference"
                    value={reference}
                    maxLength={120}
                    placeholder="Receipt, transfer, or transaction number"
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>

                {payment.error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to record payment</AlertTitle>
                    <AlertDescription>
                      {getApiError(payment.error).message}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!methodId || Boolean(amountError) || methods.isError || payment.isPending}
                  aria-busy={payment.isPending}
                >
                  <ReceiptText />
                  {payment.isPending
                    ? "Recording payment…"
                    : `Record ${amount && !amountError ? money(amount, currency) : "payment"}`}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                You do not have permission to record payments. Ask an authorized
                staff member to settle this balance.
              </p>
            )}
          </div>
        ) : null}

        {settled ? (
          <div className="flex gap-3 border-t bg-success/5 px-5 py-4 text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Ready for checkout</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The folio is fully paid and the stay can now be completed.
              </p>
            </div>
          </div>
        ) : null}

        <div className="border-t px-5 py-4">
          <h3 className="text-sm font-medium">Payment activity</h3>
          {payments.data.length ? (
            <ol className="mt-3 space-y-3">
              {payments.data.map((item) => {
                const Icon = paymentIcon(item.paymentMethod.name);
                return (
                  <li key={item.id} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.paymentMethod.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(item.paidAt))}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {item.kind === "REFUND" ? "−" : ""}
                          {money(item.amount, currency ?? item.hotel.currencyCode)}
                        </p>
                      </div>
                      {item.reference ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {titleCase(item.kind)} · Ref {item.reference}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No payments have been recorded for this stay.
            </p>
          )}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </CardContent>
    </Card>
  );
}
