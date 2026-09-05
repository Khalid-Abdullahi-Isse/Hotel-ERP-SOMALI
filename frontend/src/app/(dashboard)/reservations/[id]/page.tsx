import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Edit,
  History,
  Users,
} from "lucide-react";
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
import { ReservationStatusBadge } from "@/components/shared/reservation-status-badge";
import { getReservation } from "@/services/reservation.server";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";
import { formatCurrency, formatShortDate, titleCase } from "@/lib/format";
import { getHotelContext } from "@/services/system.server";
import { ReservationActions } from "@/components/reservations/reservation-actions";

export const metadata: Metadata = { title: "Reservation" };

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [reservation, user, hotel] = await Promise.all([
    getReservation(id),
    getCurrentUser(),
    getHotelContext(),
  ]);
  if (!reservation) notFound();

  const canEdit =
    user &&
    can(user, PERMISSIONS.reservationsUpdate) &&
    (reservation.status === "PENDING" || reservation.status === "CONFIRMED");
  const canCheckIn = Boolean(user && can(user, PERMISSIONS.checkInCreate));
  const canConfirm = Boolean(user && can(user, PERMISSIONS.reservationsConfirm));
  const canCancel = Boolean(user && can(user, PERMISSIONS.reservationsCancel));

  const today = new Date().toISOString().split("T")[0];
  const currency = hotel.currencyCode;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/reservations">
          <ArrowLeft />
          Back to reservations
        </Link>
      </Button>

      <PageHeader
        title={reservation.bookingNumber}
        description={`Reservation ${titleCase(reservation.status.toLowerCase().replace("_", " "))}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/reservations/${reservation.id}/edit`}>
                  <Edit />
                  Edit
                </Link>
              </Button>
            ) : null}
            <ReservationActions
              reservation={{
                id: reservation.id,
                bookingId: reservation.bookingNumber,
                guestName: reservation.guest.fullName,
                roomNumber: reservation.rooms
                  .map((r) => r.room.roomNumber)
                  .join(", "),
                checkIn: reservation.checkInDate.slice(0, 10),
                checkOut: reservation.checkOutDate.slice(0, 10),
                status: reservation.status
                  .toLowerCase()
                  .replace("-", "_") as never,
                total: reservation.estimatedTotal,
                currency,
              }}
              permissions={{ canCheckIn, canConfirm, canCancel }}
              businessDate={today}
            />
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Guest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Name</p>
                <Link
                  href={`/guests/${reservation.guestId}`}
                  className="mt-0.5 text-sm font-medium text-primary hover:underline"
                >
                  {reservation.guest.fullName}
                </Link>
              </div>
              {reservation.guest.phone ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Phone</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {reservation.guest.phone}
                  </p>
                </div>
              ) : null}
              {reservation.guest.email ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">Email</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {reservation.guest.email}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] text-muted-foreground">Guests</p>
                <p className="mt-0.5 text-sm font-medium">
                  {reservation.adults} adult
                  {reservation.adults === 1 ? "" : "s"}
                  {reservation.children
                    ? `, ${reservation.children} child${reservation.children === 1 ? "" : "ren"}`
                    : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                Stay details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Check-in</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {formatShortDate(reservation.checkInDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Check-out
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {formatShortDate(reservation.checkOutDate)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Nights</p>
                <p className="mt-0.5 text-sm font-medium">
                  {reservation.nights}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Status</p>
                <div className="mt-1">
                  <ReservationStatusBadge
                    status={
                      reservation.status
                        .toLowerCase()
                        .replace("-", "_") as never
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Rooms</CardTitle>
            </CardHeader>
            {reservation.rooms.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rate / night</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservation.rooms.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.room.roomNumber}
                        </TableCell>
                        <TableCell>{entry.room.roomType.name}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatCurrency(
                            Number(entry.nightlyRate),
                            currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(
                            Number(entry.roomTotal),
                            currency,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No rooms assigned.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Financial summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(Number(reservation.subtotal), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(
                      Number(reservation.discountAmount),
                      currency,
                    )}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>Estimated total</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      Number(reservation.estimatedTotal),
                      currency,
                    )}
                  </span>
                </div>
              </div>
              {reservation.notes ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-[11px] text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm">{reservation.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {reservation.history && reservation.history.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Reservation history
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reservation.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/40" />
                      <div>
                        <p>
                          {entry.fromStatus
                            ? `${titleCase(entry.fromStatus.replace("_", " "))} → `
                            : ""}
                          {titleCase(entry.toStatus.replace("_", " "))}
                        </p>
                        {entry.note ? (
                          <p className="text-xs text-muted-foreground">
                            {entry.note}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          {formatShortDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
