import "server-only";
import { ApiError } from "@/lib/api-error";
import { serverApi } from "@/lib/server-api";
import type { ApiGuest, ApiPage, ApiReservation, ApiReservationStatus } from "@/types/api-contracts";
import type { PaginatedResponse } from "@/types/api";
import type { GuestProfile, GuestSummary } from "@/types/guest";
import { listQuery } from "@/lib/pagination";
import { getHotelContext } from "@/services/system.server";
import type { ReservationStatus } from "@/types/reservation";

const reservationStatuses: Record<ApiReservationStatus, ReservationStatus> = {
  PENDING: "pending", CONFIRMED: "confirmed", CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out", CANCELLED: "cancelled", NO_SHOW: "no_show",
};

function summary(guest: ApiGuest): GuestSummary {
  return { id: guest.id, guestCode: `GST-${guest.id.slice(0, 8).toUpperCase()}`, name: guest.fullName, phone: guest.phone ?? "Not provided", email: guest.email ?? undefined, nationality: guest.nationality ?? "Not provided" };
}
export async function getGuests(params: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedResponse<GuestSummary>> {
  const response = await serverApi<ApiPage<ApiGuest>>(`/guests?${listQuery(params)}`);
  return { data: response.data.map(summary), pagination: response.pagination };
}
export async function getGuest(id: string): Promise<GuestProfile | null> {
  let guest: ApiGuest;
  try { guest = await serverApi<ApiGuest>(`/guests/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  const [reservations, hotel] = await Promise.all([
    serverApi<ApiPage<ApiReservation>>(`/reservations?${listQuery({ guestId: id, page: 1, limit: 100 })}`),
    getHotelContext(),
  ]);
  const identity = guest.passportNumber ?? guest.nationalId;
  const ordered = [...reservations.data].sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  const stays = ordered.map((reservation) => ({ id: reservation.id, bookingId: reservation.bookingNumber, roomNumber: reservation.rooms.map((entry) => entry.room.roomNumber).join(", "), checkIn: reservation.checkInDate, checkOut: reservation.checkOutDate, status: reservationStatuses[reservation.status], total: Number(reservation.estimatedTotal), currency: hotel.currencyCode }));
  const current = ordered.find((reservation) => reservation.status === "CHECKED_IN");
  return { ...summary(guest), totalStays: reservations.pagination.total, lastStay: ordered[0]?.checkOutDate, currentRoom: current?.rooms.map((entry) => entry.room.roomNumber).join(", "), status: current ? "in_house" : reservations.pagination.total > 0 ? "returning" : "new", address: guest.address ?? undefined, idType: guest.passportNumber ? "Passport" : guest.nationalId ? "National ID" : undefined, idNumberMasked: identity ? `••••${identity.slice(-4)}` : undefined, notes: guest.notes ? [guest.notes] : [], stays };
}
