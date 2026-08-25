import { describe, expect, it } from "vitest";
import { adaptPage, adaptRoom, adaptUser } from "@/lib/api-adapters";
import type { ApiRoom } from "@/types/api-contracts";

const apiRoom: ApiRoom = {
  id: "room-1",
  roomNumber: "101",
  floorId: "floor-1",
  floor: { id: "floor-1", number: 1, name: null },
  roomTypeId: "type-1",
  roomType: { id: "type-1", code: "STD", name: "Standard", capacityAdults: 2, capacityChildren: 1, basePrice: "80.00", isActive: true },
  status: "AVAILABLE",
  effectivePrice: "85.00",
  notes: null,
  isActive: true,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

describe("API adapters", () => {
  it("maps backend room names, enums, relations, and money without losing precision", () => {
    expect(adaptRoom(apiRoom)).toMatchObject({ number: "101", floor: "Floor 1", status: "available", effectivePrice: "85.00" });
  });

  it("maps backend pagination to the frontend meta contract", () => {
    const pagination = { page: 2, limit: 10, total: 21, totalPages: 3, hasNextPage: true, hasPreviousPage: true };
    const result = adaptPage({ data: [apiRoom], pagination }, adaptRoom);
    expect(result.pagination).toEqual(pagination);
  });

  it("preserves roles and permission keys on authenticated users", () => {
    const user = adaptUser({ id: "user-1", hotelId: "hotel-1", email: "admin@example.com", username: "admin", fullName: "Hotel Admin", roles: ["ADMIN"], permissions: ["room.view"] });
    expect(user).toMatchObject({ role: "ADMIN", roles: ["ADMIN"], permissions: ["room.view"] });
  });
});
