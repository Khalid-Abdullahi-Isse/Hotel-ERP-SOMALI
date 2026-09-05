import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StayDetail } from "@/components/front-desk/stay-detail";
import { PERMISSIONS } from "@/constants/permissions";
import { ApiError } from "@/lib/api-error";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getCheckInReservation } from "@/services/reservation.server";

export const metadata: Metadata = { title: "Guest Stay" };

async function loadStay(id: string) {
  try {
    return await getCheckInReservation(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function StayPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const data = await loadStay(reservationId);
  return (
    <StayDetail
      data={data}
      currency={data.hotel.currencyCode}
      canCheckOut={can(user, PERMISSIONS.checkOutCreate)}
      canCreatePayment={can(user, PERMISSIONS.paymentsCreate)}
      canCreateCharge={
        can(user, PERMISSIONS.chargesCreate) &&
        can(user, PERMISSIONS.servicesRead)
      }
      canVoidCharge={can(user, PERMISSIONS.chargesVoid)}
      canCreateInvoice={can(user, PERMISSIONS.invoicesCreate)}
    />
  );
}
