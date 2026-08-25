import "server-only";

import { serverApi } from "@/lib/server-api";
import { adaptPage, adaptRoom, adaptRoomType } from "@/lib/api-adapters";
import type { PaginatedResponse } from "@/types/api";
import type { ApiFloor, ApiPage, ApiRoom, ApiRoomType } from "@/types/api-contracts";
import type { FloorSummary, Room, RoomListParams, RoomTypeSummary } from "@/types/room";
import { listQuery } from "@/lib/pagination";

export async function getRooms(params: RoomListParams): Promise<PaginatedResponse<Room>> {
  return adaptPage(await serverApi<ApiPage<ApiRoom>>(`/rooms?${listQuery({ ...params, status: params.status?.toUpperCase() })}`), adaptRoom);
}

export async function getRoom(id: string): Promise<Room> {
  return adaptRoom(await serverApi<ApiRoom>(`/rooms/${encodeURIComponent(id)}`));
}

export async function getRoomTypes(): Promise<RoomTypeSummary[]> {
  return (await serverApi<ApiRoomType[]>("/room-types")).filter((type) => type.isActive).map(adaptRoomType);
}

export async function getFloors(): Promise<FloorSummary[]> { return serverApi<ApiFloor[]>("/floors"); }
