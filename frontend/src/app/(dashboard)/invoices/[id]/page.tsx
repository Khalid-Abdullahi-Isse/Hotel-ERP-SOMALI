import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoice } from "@/services/finance.server";
import { formatCurrency, formatShortDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice detail" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const currency = invoice.hotel.currencyCode;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/invoices">
          <ArrowLeft />
          Back to invoices
        </Link>
      </Button>

      <PageHeader
        title={invoice.invoiceNumber}
        description={`Invoice for reservation ${invoice.reservation.bookingNumber}`}
        actions={
          <Badge
            variant={
              invoice.status === "VOIDED"
                ? "destructive"
                : invoice.status === "ISSUED"
                  ? "default"
                  : "secondary"
            }
          >
            {titleCase(invoice.status)}
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Invoice summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Guest</p>
                <Link
                  href={`/guests/${invoice.reservation.guest.id}`}
                  className="mt-1 text-sm font-medium text-primary hover:underline"
                >
                  {invoice.reservation.guest.fullName}
                </Link>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Reservation
                </p>
                <Link
                  href={`/reservations/${invoice.reservation.id}`}
                  className="mt-1 font-mono text-sm font-medium text-primary hover:underline"
                >
                  {invoice.reservation.bookingNumber}
                </Link>
              </div>
              {invoice.issuedAt ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Issued</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatShortDate(invoice.issuedAt)}
                  </p>
                </div>
              ) : null}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(Number(invoice.subtotal), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(
                      Number(invoice.discountAmount),
                      currency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(invoice.totalAmount), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium tabular-nums text-green-600">
                    {formatCurrency(Number(invoice.netPaidAmount), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Outstanding</span>
                  <span className="tabular-nums text-destructive">
                    {formatCurrency(
                      Number(invoice.outstandingAmount),
                      currency,
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.voidedAt ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Void information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Voided at
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatShortDate(invoice.voidedAt)}
                  </p>
                </div>
                {invoice.voidReason ? (
                  <div>
                    <p className="text-[11px] text-muted-foreground">Reason</p>
                    <p className="mt-1 text-sm">{invoice.voidReason}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Invoice items</CardTitle>
            </CardHeader>
            {invoice.items && invoice.items.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(item.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Number(item.unitPrice), currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(Number(item.amount), currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No line items on this invoice.
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
