import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionStatusBadge } from "@/components/finance/finance-status";
import { getPayment } from "@/services/finance.server";
import { formatCurrency, formatShortDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Payment detail" };

function MethodLabelIcon({ method }: { method: string }) {
  const value = method.toLowerCase();
  const icon =
    value.includes("cash") ? (
      <Banknote className="size-4 text-muted-foreground" />
    ) : value.includes("mobile") ||
      value.includes("evc") ||
      value.includes("zaad") ? (
      <Smartphone className="size-4 text-muted-foreground" />
    ) : value.includes("bank") || value.includes("transfer") ? (
      <Landmark className="size-4 text-muted-foreground" />
    ) : (
      <CreditCard className="size-4 text-muted-foreground" />
    );
  return icon;
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = await getPayment(id);
  if (!payment) notFound();

  const currency = payment.hotel.currencyCode;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/payments">
          <ArrowLeft />
          Back to payments
        </Link>
      </Button>

      <PageHeader
        title={titleCase(payment.kind.toLowerCase())}
        description={`Payment ${payment.reference || payment.id.slice(0, 8).toUpperCase()}`}
      />

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Payment details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Amount</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {payment.kind === "REFUND" ? "-" : ""}
                  {formatCurrency(Number(payment.amount), currency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Status</p>
                <div className="mt-1">
                  <TransactionStatusBadge
                    status={
                      payment.status === "VOIDED"
                        ? "failed"
                        : payment.kind === "REFUND"
                          ? "refunded"
                          : "completed"
                    }
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Payment method
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                  <MethodLabelIcon method={payment.paymentMethod.name} />
                  {payment.paymentMethod.name}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Transaction date
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatShortDate(payment.paidAt)}
                </p>
              </div>
              {payment.reference ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Reference
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium">
                    {payment.reference}
                  </p>
                </div>
              ) : null}
              {payment.note ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Note</p>
                  <p className="mt-1 text-sm">{payment.note}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Related records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payment.guest ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Guest</p>
                  <Link
                    href={`/guests/${payment.guest.id}`}
                    className="mt-1 text-sm font-medium text-primary hover:underline"
                  >
                    {payment.guest.fullName}
                  </Link>
                </div>
              ) : null}
              {payment.reservation ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Reservation
                  </p>
                  <Link
                    href={`/reservations/${payment.reservation.id}`}
                    className="mt-1 font-mono text-sm font-medium text-primary hover:underline"
                  >
                    {payment.reservation.bookingNumber}
                  </Link>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Recorded by
                </p>
                <p className="mt-1 text-sm font-medium">
                  {payment.createdBy.fullName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Created at
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatShortDate(payment.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
