"use client";

import { useState } from "react";
import { Search, TicketX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  ReservationStatus,
  ReservationSummary,
} from "@/types/reservation";

type StatusFilter = "all" | ReservationStatus;

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
}: {
  reservations: ReservationSummary[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const normalizedSearch = search.trim().toLowerCase();
  const visible = reservations.filter((reservation) => {
    const matchesSearch =
      !normalizedSearch ||
      [
        reservation.bookingId,
        reservation.guestName,
        reservation.phone,
        reservation.roomNumber,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (status === "all" || reservation.status === status);
  });

  return (
    <div>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search guest, booking ID, phone, or room"
            aria-label="Search reservations"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger
            className="h-9 w-full sm:w-44"
            aria-label="Filter reservation status"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="checked_in">Checked in</SelectItem>
            <SelectItem value="checked_out">Checked out</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={TicketX}
          title="No reservations found"
          description="Try a different search or clear the status filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          }
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
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                      {formatDate(reservation.checkIn)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(reservation.checkOut)}
                    </TableCell>
                    <TableCell>
                      {reservation.adults ?? 1}
                      {reservation.children ? ` + ${reservation.children}` : ""}
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
              </article>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <span>
          {visible.length} of {reservations.length} reservations
        </span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}
