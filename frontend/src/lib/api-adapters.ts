import type { ApiAuthUser, ApiPage, ApiRoom, ApiRoomStatus, ApiRoomType } from "@/types/api-contracts";
import type { PaginatedResponse } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import type { Room, RoomStatus, RoomTypeSummary } from "@/types/room";

const roomStatusFromApi: Record<ApiRoomStatus, RoomStatus> = {
  AVAILABLE: "available", RESERVED: "reserved", OCCUPIED: "occupied", DIRTY: "dirty",
  CLEANING: "cleaning", MAINTENANCE: "maintenance",
};

export function adaptUser(user: ApiAuthUser): AuthUser {
  return { id: user.id, hotelId: user.hotelId, name: user.fullName, email: user.email, username: user.username, roles: user.roles, role: user.roles[0] ?? "STAFF", permissions: user.permissions };
}

export function adaptRoomType(type: ApiRoomType): RoomTypeSummary {
  return { id: type.id, code: type.code, name: type.name, basePrice: type.basePrice, isActive: type.isActive };
}

export function adaptRoom(room: ApiRoom): Room {
  const floor = room.floor ? room.floor.name || `Floor ${room.floor.number}` : null;
  return { id: room.id, number: room.roomNumber, floorId: room.floorId, floor, status: roomStatusFromApi[room.status], effectivePrice: room.effectivePrice, notes: room.notes, isActive: room.isActive, roomType: adaptRoomType(room.roomType), createdAt: room.createdAt, updatedAt: room.updatedAt };
}

export function adaptPage<TApi, TView>(page: ApiPage<TApi>, adapt: (item: TApi) => TView): PaginatedResponse<TView> {
  return { data: page.data.map(adapt), pagination: page.pagination };
}
