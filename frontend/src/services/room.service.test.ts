import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { roomService } from "@/services/room.service";
import type { ApiRoom } from "@/types/api-contracts";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiRoom: ApiRoom = {
  id: "11111111-1111-4111-8111-111111111111",
  roomNumber: "A-101",
  floorId: null,
  floor: null,
  roomTypeId: "22222222-2222-4222-8222-222222222222",
  roomType: { id: "22222222-2222-4222-8222-222222222222", code: "STD", name: "Standard", capacityAdults: 2, capacityChildren: 1, basePrice: "80.00", isActive: true },
  status: "AVAILABLE",
  effectivePrice: "80.00",
  notes: null,
  isActive: true,
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:00.000Z",
};

describe("roomService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serializes list filters using the backend enum and boolean contract", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [apiRoom], pagination: { page: 1, limit: 30, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } } });
    await roomService.list({ page: 1, status: "maintenance", isActive: false });
    expect(api.get).toHaveBeenCalledWith("/rooms", { params: { page: 1, status: "MAINTENANCE", isActive: false } });
  });

  it("canonicalizes room numbers and sends a nullable floor when creating", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: apiRoom });
    await roomService.create({ roomNumber: " a-101 ", roomTypeId: apiRoom.roomTypeId, floorId: "", notes: "Near lift" });
    expect(api.post).toHaveBeenCalledWith("/rooms", { roomNumber: "A-101", roomTypeId: apiRoom.roomTypeId, floorId: null, notes: "Near lift" });
  });

  it("uses the dedicated backend lifecycle endpoints and payloads", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: apiRoom });
    vi.mocked(api.delete).mockResolvedValue({ data: apiRoom });
    await roomService.updateStatus(apiRoom.id, "maintenance");
    await roomService.deactivate(apiRoom.id);
    await roomService.restore(apiRoom.id);
    expect(api.patch).toHaveBeenNthCalledWith(1, `/rooms/${apiRoom.id}/status`, { status: "MAINTENANCE" });
    expect(api.delete).toHaveBeenCalledWith(`/rooms/${apiRoom.id}`);
    expect(api.patch).toHaveBeenNthCalledWith(2, `/rooms/${apiRoom.id}/restore`);
  });
});
