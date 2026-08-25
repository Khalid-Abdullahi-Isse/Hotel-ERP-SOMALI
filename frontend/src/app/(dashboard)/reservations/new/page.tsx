import type { Metadata } from "next";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { PageHeader } from "@/components/shared/page-header";
import { getRoomTypes } from "@/services/room.server";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";
import { getHotelContext } from "@/services/system.server";
import { formatCurrency } from "@/lib/format";
import { notFound } from "next/navigation";
import { getGuest } from "@/services/guest.server";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ mode?: string; guestId?: string }> }) { const query = await searchParams; const walkIn = query.mode === "walk-in"; const user = await getCurrentUser(); if (!user || !can(user, PERMISSIONS.reservationsCreate)) notFound(); const [types, hotel, existingGuest] = await Promise.all([getRoomTypes(), getHotelContext(), query.guestId ? getGuest(query.guestId) : null]); if (query.guestId && !existingGuest) notFound(); const roomTypes = types.map((type) => ({ value: type.id, label: type.name, rateLabel: `${formatCurrency(Number(type.basePrice), hotel.currencyCode)} / night` })); return <div className="space-y-6"><PageHeader title={walkIn ? "Walk-in guest" : "New reservation"} description={existingGuest ? `Create a booking for ${existingGuest.name}.` : walkIn ? "Create and confirm the guest reservation before continuing to normal check-in." : "Create a booking through a clear reception workflow."} /><ReservationForm roomTypes={roomTypes} currency={hotel.currencyCode} existingGuest={existingGuest ? { id: existingGuest.id, name: existingGuest.name, phone: existingGuest.phone === "Not provided" ? "" : existingGuest.phone, email: existingGuest.email, nationality: existingGuest.nationality === "Not provided" ? "" : existingGuest.nationality } : undefined} walkIn={walkIn} canConfirm={can(user, PERMISSIONS.reservationsConfirm)} canCheckIn={can(user, PERMISSIONS.checkInCreate)} /></div>; }
