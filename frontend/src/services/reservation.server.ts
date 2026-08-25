import "server-only";
import { serverApi } from "@/lib/server-api";
import type {
  ApiPage,
  ApiReservation,
  ApiReservationStatus,
  ApiReservationTimelineResult,
  ApiFolio,
  ApiGuest,
  ApiReservationPayments,
} from "@/types/api-contracts";
import type { PaginatedResponse } from "@/types/api";
import type {
  ReservationStatus,
  ReservationSummary,
} from "@/types/reservation";
import type { TimelineRoom } from "@/types/timeline";
import { listQuery } from "@/lib/pagination";
import { getHotelContext } from "@/services/system.server";
import type { CurrencyCode } from "@/types/finance";

const statuses: Record<ApiReservationStatus, ReservationStatus> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
};
function adapt(reservation: ApiReservation, currency: CurrencyCode): ReservationSummary {
  return {
    id: reservation.id,
    bookingId: reservation.bookingNumber,
    guestName: reservation.guest.fullName,
    phone: reservation.guest.phone ?? undefined,
    roomNumber: reservation.rooms
      .map((entry) => entry.room.roomNumber)
      .join(", "),
    checkIn: reservation.checkInDate.slice(0, 10),
    checkOut: reservation.checkOutDate.slice(0, 10),
    adults: reservation.adults,
    children: reservation.children,
    status: statuses[reservation.status],
    total: reservation.estimatedTotal,
    currency,
  };
}
export async function getReservations(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ReservationStatus;
    arrivalFrom?: string;
    arrivalTo?: string;
  } = {},
): Promise<PaginatedResponse<ReservationSummary>> {
  const normalized = { ...params, status: params.status?.toUpperCase() };
  const [response, hotel] = await Promise.all([
    serverApi<ApiPage<ApiReservation>>(`/reservations?${listQuery(normalized)}`),
    getHotelContext(),
  ]);
  return {
    data: response.data.map((reservation) => adapt(reservation, hotel.currencyCode)),
    pagination: response.pagination,
  };
}

export async function getReservation(id: string) {
  return serverApi<ApiReservation>(`/reservations/${encodeURIComponent(id)}`);
}

export async function getCheckInReservation(id: string) {
  const reservation = await getReservation(id);
  const [guest, folio, payments, hotel] = await Promise.all([
    serverApi<ApiGuest>(`/guests/${encodeURIComponent(reservation.guestId)}`),
    serverApi<ApiFolio>(`/reservations/${encodeURIComponent(id)}/folio`),
    serverApi<ApiReservationPayments>(`/reservations/${encodeURIComponent(id)}/payments`),
    getHotelContext(),
  ]);
  return { reservation, guest, folio, payments, hotel };
}

export async function getReservationTimeline(
  startDate: string,
  page = 1,
): Promise<PaginatedResponse<TimelineRoom>> {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const { rooms, reservations, pagination } = await serverApi<ApiReservationTimelineResult>(
    `/reservations/timeline?${listQuery({ startDate, page })}`,
  );
  const byRoom = new Map(
    rooms.map((room) => [
      room.id,
      {
        roomNumber: room.roomNumber,
        roomType: room.roomType.name,
        floor:
          room.floor?.name ||
          (room.floor ? `Floor ${room.floor.number}` : "Unassigned"),
        bookings: [] as TimelineRoom["bookings"],
      },
    ]),
  );
  for (const reservation of reservations) {
    const checkIn = new Date(
      `${reservation.checkInDate.slice(0, 10)}T00:00:00.000Z`,
    );
    const checkOut = new Date(
      `${reservation.checkOutDate.slice(0, 10)}T00:00:00.000Z`,
    );
    if (checkOut <= start || checkIn >= end) continue;
    const visibleStart = checkIn < start ? start : checkIn;
    const visibleEnd = checkOut > end ? end : checkOut;
    const startDay =
      Math.floor((visibleStart.getTime() - start.getTime()) / 86_400_000) + 1;
    const span = Math.max(
      1,
      Math.ceil((visibleEnd.getTime() - visibleStart.getTime()) / 86_400_000),
    );
    for (const entry of reservation.rooms) {
      byRoom.get(entry.roomId)?.bookings.push({
        id: `${reservation.id}-${entry.roomId}`,
        guestName: reservation.guest.fullName,
        startDay,
        span,
        status: statuses[reservation.status],
        source: reservation.bookingNumber,
      });
    }
  }
  return { data: [...byRoom.values()], pagination };
}
