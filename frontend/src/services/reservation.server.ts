import "server-only";
import { serverApi } from "@/lib/server-api";
import type {
  ApiPage,
  ApiReservation,
  ApiReservationStatus,
  ApiReservationTimelineResult,
} from "@/types/api-contracts";
import type { PaginatedResponse } from "@/types/api";
import type {
  ReservationStatus,
  ReservationSummary,
} from "@/types/reservation";
import type { TimelineRoom } from "@/types/timeline";

const statuses: Record<ApiReservationStatus, ReservationStatus> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
};
function adapt(reservation: ApiReservation): ReservationSummary {
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
    currency: "USD",
  };
}
export async function getReservations(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: ReservationStatus;
    arrivalFrom?: string;
    arrivalTo?: string;
  } = {},
): Promise<PaginatedResponse<ReservationSummary>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      query.set(
        key,
        key === "status" ? String(value).toUpperCase() : String(value),
      );
  });
  const response = await serverApi<ApiPage<ApiReservation>>(
    `/reservations?${query}`,
  );
  return {
    data: response.data.map(adapt),
    meta: {
      page: response.pagination.page,
      limit: response.pagination.pageSize,
      total: response.pagination.total,
      totalPages: response.pagination.pageCount,
    },
  };
}

export async function getReservationTimeline(
  startDate: string,
): Promise<TimelineRoom[]> {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const { rooms, reservations } = await serverApi<ApiReservationTimelineResult>(
    `/reservations/timeline?startDate=${encodeURIComponent(startDate)}`,
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
  return [...byRoom.values()];
}
