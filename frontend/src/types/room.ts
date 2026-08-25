export const ROOM_STATUSES = ["available", "occupied", "reserved", "dirty", "cleaning", "maintenance"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];
export const HOTEL_ROOM_STATUSES = ["available", "occupied", "reserved", "dirty", "cleaning", "maintenance", "out_of_service"] as const;
export type HotelRoomStatus = (typeof HOTEL_ROOM_STATUSES)[number];
export interface FloorSummary { id: string; number: number; name: string | null }
export interface RoomTypeSummary { id: string; code: string; name: string; basePrice: string; isActive: boolean }
export interface Room {
  id: string; number: string; floorId: string | null; floor: string | null; status: RoomStatus;
  effectivePrice: string;
  notes: string | null; isActive: boolean; roomType: RoomTypeSummary;
  createdAt: string; updatedAt: string;
}
export interface RoomInput { roomNumber: string; floorId?: string | null; roomTypeId: string; notes?: string }
export interface RoomListParams {
  page?: number; limit?: number; search?: string; status?: RoomStatus; roomTypeId?: string; floorId?: string; isActive?: boolean;
}
