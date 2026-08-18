import { api } from "@/lib/api";
import { adaptPage, adaptRoom } from "@/lib/api-adapters";
import type { ApiPage, ApiRoom } from "@/types/api-contracts";
import type { RoomInput, RoomListParams, RoomStatus } from "@/types/room";

function roomPayload(input: RoomInput) {
  return {
    ...input,
    roomNumber: input.roomNumber.trim().toUpperCase(),
    floorId: input.floorId || null,
  };
}

export const roomService = {
  async list(params: RoomListParams) {
    const apiParams = { ...params, status: params.status?.toUpperCase() };
    const { data } = await api.get<ApiPage<ApiRoom>>("/rooms", { params: apiParams });
    return adaptPage(data, adaptRoom);
  },
  async create(input: RoomInput) {
    const { data } = await api.post<ApiRoom>("/rooms", roomPayload(input));
    return adaptRoom(data);
  },
  async update(id: string, input: RoomInput) {
    const { data } = await api.patch<ApiRoom>(`/rooms/${id}`, roomPayload(input));
    return adaptRoom(data);
  },
  async updateStatus(id: string, status: Extract<RoomStatus, "available" | "maintenance">) {
    const { data } = await api.patch<ApiRoom>(`/rooms/${id}/status`, { status: status.toUpperCase() });
    return adaptRoom(data);
  },
  async deactivate(id: string) {
    const { data } = await api.delete<ApiRoom>(`/rooms/${id}`);
    return adaptRoom(data);
  },
  async restore(id: string) {
    const { data } = await api.patch<ApiRoom>(`/rooms/${id}/restore`);
    return adaptRoom(data);
  },
};
