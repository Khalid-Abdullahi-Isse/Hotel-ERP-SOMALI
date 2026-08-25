import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentStatusText, ReservationStatusBadge } from "@/components/shared/reservation-status-badge";
import type { ReservationSummary } from "@/types/reservation";

function formatCurrency(amount: string | number, currency: ReservationSummary["currency"]) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

export function RecentReservations({ reservations, title = "Reservations", description = "Bookings by arrival date", viewAllHref = "/reservations" }: { reservations: ReservationSummary[]; title?: string; description?: string; viewAllHref?: string }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="grid grid-cols-[1fr_auto] border-b"><div><CardTitle>{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Button asChild variant="ghost" size="sm"><Link href={viewAllHref}>View all</Link></Button></CardHeader>
      <CardContent className="px-0">
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Guest</TableHead><TableHead>Room</TableHead><TableHead>Stay</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{reservations.map((reservation) => <TableRow key={reservation.id}><TableCell className="font-mono text-xs font-medium text-primary">{reservation.bookingId}</TableCell><TableCell className="font-medium">{reservation.guestName}</TableCell><TableCell>{reservation.roomNumber}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{reservation.checkIn}–{reservation.checkOut}</TableCell><TableCell><ReservationStatusBadge status={reservation.status} /></TableCell><TableCell><PaymentStatusText status={reservation.paymentStatus} /></TableCell><TableCell className="text-right font-medium tabular-nums">{formatCurrency(reservation.total, reservation.currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="divide-y sm:hidden">
          {reservations.map((reservation) => <article key={reservation.id} className="space-y-3 px-4 py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{reservation.guestName}</p><p className="mt-0.5 font-mono text-[11px] text-primary">{reservation.bookingId}</p></div><ReservationStatusBadge status={reservation.status} /></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Room & stay</p><p className="mt-1 font-medium">{reservation.roomNumber} · {reservation.checkIn}–{reservation.checkOut}</p></div><div className="text-right"><p className="text-muted-foreground">Total</p><p className="mt-1 font-medium">{formatCurrency(reservation.total, reservation.currency)}</p></div></div><PaymentStatusText status={reservation.paymentStatus} /></article>)}
        </div>
      </CardContent>
    </Card>
  );
}
