import "server-only";

import { serverApi } from "@/lib/server-api";
import type {
  ApiPage,
  ApiReservation,
  ApiReservationStatus,
  ApiRoom,
} from "@/types/api-contracts";
import type { FrontDeskMetric, FrontDeskRoom } from "@/types/front-desk";
import type { ApiPagination } from "@/types/api-contracts";
import { getDashboardSummary } from "@/services/dashboard.server";
import { listQuery } from "@/lib/pagination";

const activeReservationStatuses: ApiReservationStatus[] = [
  "CHECKED_IN",
  "CONFIRMED",
  "PENDING",
];

function cleaningLabel(status: ApiRoom["status"]): FrontDeskRoom["cleaningLabel"] {
  if (status === "DIRTY") return "Needs cleaning";
  if (status === "CLEANING") return "In progress";
  if (status === "MAINTENANCE") return "Not applicable";
  return "Clean";
}

export async function getFrontDeskData(params: { page?: number; search?: string; status?: string } = {}): Promise<{
  rooms: FrontDeskRoom[];
  metrics: FrontDeskMetric[];
  pagination: ApiPagination;
  businessDate: string;
}> {
  const roomPage = await serverApi<ApiPage<ApiRoom>>(`/rooms?${listQuery({ ...params, limit: 30, isActive: true, status: params.status?.toUpperCase() })}`);
  const roomIds = roomPage.data.map((room) => room.id).join(",");
  const [summary, ...reservationGroups] = await Promise.all([
    getDashboardSummary(),
    ...activeReservationStatuses.map((status) => serverApi<ApiPage<ApiReservation>>(`/reservations?${listQuery({ page: 1, limit: 30, status, roomIds })}`)),
  ]);
  const rooms = roomPage.data;
  const reservations = reservationGroups.flatMap((group) => group.data);
  const reservationByRoom = new Map<string, ApiReservation>();
  for (const reservation of reservations) {
    for (const entry of reservation.rooms) {
      const current = reservationByRoom.get(entry.roomId);
      if (!current || reservation.status === "CHECKED_IN") {
        reservationByRoom.set(entry.roomId, reservation);
      }
    }
  }

  const adaptedRooms: FrontDeskRoom[] = rooms.map((room) => {
    const reservation = reservationByRoom.get(room.id);
    const floor = room.floor
      ? room.floor.name || `Floor ${room.floor.number}`
      : "Unassigned";
    return {
      id: room.id,
      number: room.roomNumber,
      roomType: room.roomType.name,
      floor,
      status: room.status.toLowerCase() as FrontDeskRoom["status"],
      guestName: reservation?.guest.fullName,
      reservationId: reservation?.id,
      reservationCode: reservation?.bookingNumber,
      reservationStatus: reservation?.status,
      arrivalDate: reservation?.checkInDate.slice(0, 10),
      departureDate: reservation?.checkOutDate.slice(0, 10),
      nights: reservation?.nights,
      action: reservation?.status === "CHECKED_IN"
        ? "view_stay"
        : room.status === "DIRTY" || room.status === "CLEANING"
          ? "housekeeping"
          : room.status === "MAINTENANCE"
            ? "view_issue"
            : reservation?.status === "PENDING"
              ? "review"
              : reservation?.status === "CONFIRMED"
                ? reservation.checkInDate.slice(0, 10) === summary.businessDate
                  ? "check_in"
                  : "view_reservation"
                : room.status === "OCCUPIED"
                  ? "view_stay"
                  : "assign",
      stayDetail: reservation
        ? `${reservation.bookingNumber} · ${reservation.checkInDate.slice(0, 10)}–${reservation.checkOutDate.slice(0, 10)}`
        : undefined,
      cleaningLabel: cleaningLabel(room.status),
    };
  });

  return {
    rooms: adaptedRooms,
    pagination: roomPage.pagination,
    businessDate: summary.businessDate,
    metrics: [
      { label: "Reserved", value: summary.rooms.reserved ?? 0, detail: "booked rooms" },
      { label: "In house", value: summary.guests.current, detail: "active stays" },
      { label: "Available", value: summary.rooms.available ?? 0, detail: "operationally ready" },
      { label: "Needs attention", value: (summary.rooms.dirty ?? 0) + (summary.rooms.cleaning ?? 0) + (summary.rooms.maintenance ?? 0), detail: "room tasks" },
    ],
  };
}
