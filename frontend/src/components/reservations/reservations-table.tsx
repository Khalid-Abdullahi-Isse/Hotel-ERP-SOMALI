import { TicketX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  PaymentStatusText,
  ReservationStatusBadge,
} from "@/components/shared/reservation-status-badge";
import type { ReservationSummary } from "@/types/reservation";
import { ReservationActions } from "@/components/reservations/reservation-actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
function formatCurrency(
  amount: string | number,
  currency: ReservationSummary["currency"],
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
function sourceLabel(value?: string) {
  return value
    ? value
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ")
    : "—";
}

export function ReservationsTable({
  reservations,
  permissions,
  businessDate,
}: {
  reservations: ReservationSummary[];
  permissions: { canCheckIn: boolean; canConfirm: boolean; canCancel: boolean };
  businessDate: string;
}) {
  const visible = reservations;

  return (
    <div>
      {visible.length === 0 ? (
        <EmptyState
          icon={TicketX}
          title="No reservations found"
          description="Try a different search or clear the status filter."
          action={null}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Stay dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {reservation.bookingId}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{reservation.guestName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {reservation.phone}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium">
                      {reservation.roomNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p>{formatDate(reservation.checkIn)}–{formatDate(reservation.checkOut)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{reservation.adults ?? 1} adult{(reservation.adults ?? 1) === 1 ? "" : "s"}{reservation.children ? ` · ${reservation.children} child${reservation.children === 1 ? "" : "ren"}` : ""}</p>
                    </TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={reservation.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusText status={reservation.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {sourceLabel(reservation.source)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(reservation.total, reservation.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReservationActions reservation={reservation} permissions={permissions} businessDate={businessDate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {visible.map((reservation) => (
              <article key={reservation.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{reservation.guestName}</p>
                    <p className="mt-1 font-mono text-[11px] font-medium text-primary">
                      {reservation.bookingId}
                    </p>
                  </div>
                  <ReservationStatusBadge status={reservation.status} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Room</p>
                    <p className="mt-1 font-medium">{reservation.roomNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stay</p>
                    <p className="mt-1 font-medium">
                      {formatDate(reservation.checkIn)}–
                      {formatDate(reservation.checkOut)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source</p>
                    <p className="mt-1 font-medium">
                      {sourceLabel(reservation.source)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="mt-1 font-medium">
                      {formatCurrency(reservation.total, reservation.currency)}
                    </p>
                  </div>
                </div>
                <PaymentStatusText status={reservation.paymentStatus} />
                <ReservationActions reservation={reservation} permissions={permissions} businessDate={businessDate} fullWidth />
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
