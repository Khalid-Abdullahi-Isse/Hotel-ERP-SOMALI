import "server-only";

import { serverApi } from "@/lib/server-api";
import type {
  ApiPage,
  ApiReservation,
  ApiReservationStatus,
  ApiRoom,
} from "@/types/api-contracts";
import type { FrontDeskMetric, FrontDeskRoom } from "@/types/front-desk";

const activeReservationStatuses: ApiReservationStatus[] = [
  "CHECKED_IN",
  "CONFIRMED",
  "PENDING",
];

async function getAllPages<T>(path: string, params: Record<string, string>) {
  const firstQuery = new URLSearchParams({ ...params, page: "1", pageSize: "100" });
  const first = await serverApi<ApiPage<T>>(`${path}?${firstQuery}`);
  if (first.pagination.pageCount <= 1) return first.data;

  const remaining = await Promise.all(
    Array.from({ length: first.pagination.pageCount - 1 }, (_, index) => {
      const query = new URLSearchParams({
        ...params,
        page: String(index + 2),
        pageSize: "100",
      });
      return serverApi<ApiPage<T>>(`${path}?${query}`);
    }),
  );
  return first.data.concat(remaining.flatMap((page) => page.data));
}

function cleaningLabel(status: ApiRoom["status"]): FrontDeskRoom["cleaningLabel"] {
  if (status === "DIRTY") return "Needs cleaning";
  if (status === "CLEANING") return "In progress";
  if (status === "MAINTENANCE") return "Not applicable";
  return "Clean";
}

export async function getFrontDeskData(): Promise<{
  rooms: FrontDeskRoom[];
  metrics: FrontDeskMetric[];
}> {
  const [rooms, ...reservationGroups] = await Promise.all([
    getAllPages<ApiRoom>("/rooms", { isActive: "true" }),
    ...activeReservationStatuses.map((status) =>
      getAllPages<ApiReservation>("/reservations", { status }),
    ),
  ]);
  const reservations = reservationGroups.flat();
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
      stayDetail: reservation
        ? `${reservation.bookingNumber} · ${reservation.checkInDate.slice(0, 10)}–${reservation.checkOutDate.slice(0, 10)}`
        : undefined,
      cleaningLabel: cleaningLabel(room.status),
    };
  });

  const count = (status: FrontDeskRoom["status"]) =>
    adaptedRooms.filter((room) => room.status === status).length;
  return {
    rooms: adaptedRooms,
    metrics: [
      { label: "Reserved", value: reservations.filter((item) => item.status === "CONFIRMED" || item.status === "PENDING").length, detail: "booked stays" },
      { label: "In house", value: reservations.filter((item) => item.status === "CHECKED_IN").length, detail: "active stays" },
      { label: "Available", value: count("available"), detail: "ready rooms" },
      { label: "Needs attention", value: count("dirty") + count("cleaning") + count("maintenance"), detail: "room tasks" },
    ],
  };
}
