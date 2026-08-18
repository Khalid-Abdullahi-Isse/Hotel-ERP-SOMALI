import type { Metadata } from "next";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { PageHeader } from "@/components/shared/page-header";
import { getRoomTypes } from "@/services/room.server";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage() { const roomTypes = (await getRoomTypes()).map((type) => ({ value: type.id, label: type.name, rateLabel: `$${type.basePrice} / night` })); return <div className="space-y-6"><PageHeader title="New reservation" description="Create a booking through a clear, four-step reception workflow." /><ReservationForm roomTypes={roomTypes} /></div>; }
