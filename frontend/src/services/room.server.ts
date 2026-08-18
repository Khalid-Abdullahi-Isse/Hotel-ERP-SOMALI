import "server-only";

import { serverApi } from "@/lib/server-api";
import { adaptPage, adaptRoom, adaptRoomType } from "@/lib/api-adapters";
import type { PaginatedResponse } from "@/types/api";
import type { ApiFloor, ApiPage, ApiRoom, ApiRoomType } from "@/types/api-contracts";
import type { FloorSummary, Room, RoomListParams, RoomTypeSummary } from "@/types/room";

function queryString(params: RoomListParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, key === "status" ? String(value).toUpperCase() : String(value));
  });
  return query.toString();
}

export async function getRooms(params: RoomListParams): Promise<PaginatedResponse<Room>> {
  return adaptPage(await serverApi<ApiPage<ApiRoom>>(`/rooms?${queryString(params)}`), adaptRoom);
}

export async function getRoom(id: string): Promise<Room> {
  return adaptRoom(await serverApi<ApiRoom>(`/rooms/${encodeURIComponent(id)}`));
}

export async function getRoomTypes(): Promise<RoomTypeSummary[]> {
  return (await serverApi<ApiRoomType[]>("/room-types")).filter((type) => type.isActive).map(adaptRoomType);
}

export async function getFloors(): Promise<FloorSummary[]> { return serverApi<ApiFloor[]>("/floors"); }
