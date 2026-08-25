import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionStatusBadge } from "@/components/finance/finance-status";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { PaymentRecord } from "@/types/finance";

function methodIcon(method: string) {
  const value = method.toLowerCase();
  if (value.includes("cash")) return Banknote;
  if (value.includes("mobile") || value.includes("evc") || value.includes("zaad")) return Smartphone;
  if (value.includes("bank") || value.includes("transfer")) return Landmark;
  return CreditCard;
}
export function PaymentsTable({ payments }: { payments: PaymentRecord[] }) {
  const visible = payments;
  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((payment) => {
              const Icon = methodIcon(payment.method);
              return (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs text-primary">
                    {payment.reference}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatShortDate(payment.date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.guestName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.bookingId}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      {payment.method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y md:hidden">
        {visible.map((payment) => {
          const Icon = methodIcon(payment.method);
          return (
            <article key={payment.id} className="space-y-3 p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{payment.guestName}</p>
                  <p className="mt-1 font-mono text-[11px] text-primary">
                    {payment.reference}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  {formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="size-4" />
                  {payment.method}
                </span>
                <TransactionStatusBadge status={payment.status} />
              </div>
            </article>
          );
        })}
      </div>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {visible.length} of {payments.length} transactions
      </div>
    </div>
  );
}
