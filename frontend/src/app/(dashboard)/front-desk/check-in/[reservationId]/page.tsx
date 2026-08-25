import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckInWizard } from "@/components/front-desk/check-in/check-in-wizard";
import { PERMISSIONS } from "@/constants/permissions";
import { ApiError } from "@/lib/api-error";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getCheckInReservation } from "@/services/reservation.server";

export const metadata: Metadata = { title: "Guest Check-In" };

async function loadReservation(id: string) {
  try {
    return await getCheckInReservation(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function CheckInPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const initialData = await loadReservation(reservationId);
  return <CheckInWizard initialData={initialData} currency={initialData.hotel.currencyCode} permissions={{ canCheckIn: can(user, PERMISSIONS.checkInCreate), canUpdateGuest: can(user, PERMISSIONS.guestsUpdate), canReplaceRooms: can(user, PERMISSIONS.reservationsUpdate), canViewAvailability: can(user, PERMISSIONS.availabilityRead), canCreatePayment: can(user, PERMISSIONS.paymentsCreate) }} />;
}
