import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
import { PageHeader } from "@/components/shared/page-header";
import { ReservationEditForm } from "@/components/reservations/reservation-edit-form";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getReservation } from "@/services/reservation.server";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Edit reservation" };

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.reservationsUpdate))
    return (
      <ErrorMessage
        title="Access restricted"
        message="You do not have permission to edit reservations."
      />
    );

  const reservation = await getReservation(id);
  if (!reservation) notFound();

  if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED")
    return (
      <ErrorMessage
        title="Cannot edit reservation"
        message="Only pending or confirmed reservations can be edited."
      />
    );

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/reservations/${reservation.id}`}>
          <ChevronLeft />
          Back to reservation
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${reservation.bookingNumber}`}
        description="Update reservation dates, guest count, and notes."
      />
      <ReservationEditForm reservation={reservation} />
    </div>
  );
}
