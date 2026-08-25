import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  availabilityService,
  reservationService,
} from "@/services/reservation.service";
import type { ApiCharge, ApiService } from "@/types/api-contracts";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

describe("reservationService financial workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the ready-only rule to same-day walk-in availability", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    const params = {
      checkInDate: "2026-08-24",
      checkOutDate: "2026-08-25",
      roomTypeId: "room-type-1",
      readyOnly: true,
      adults: 1,
      children: 0,
    };

    await availabilityService.search(params);

    expect(api.get).toHaveBeenCalledWith("/availability/rooms", { params });
  });

  it("loads the service catalog and posts the selected quantity to the stay", async () => {
    const service: ApiService = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Minibar Package",
      description: "Snacks and drinks",
      defaultPrice: "22.00",
      isActive: true,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    const charge: ApiCharge = {
      id: "22222222-2222-4222-8222-222222222222",
      type: "SERVICE",
      description: service.name,
      quantity: "2.00",
      unitPrice: service.defaultPrice,
      totalAmount: "44.00",
      chargeDate: "2026-08-24T12:00:00.000Z",
      voidedAt: null,
      service: { id: service.id, name: service.name },
    };
    vi.mocked(api.get).mockResolvedValue({ data: [service] });
    vi.mocked(api.post).mockResolvedValue({ data: charge });

    await expect(reservationService.services()).resolves.toEqual([service]);
    await expect(
      reservationService.addServiceCharge("reservation-1", {
        serviceId: service.id,
        quantity: "2.00",
      }),
    ).resolves.toEqual(charge);

    expect(api.get).toHaveBeenCalledWith("/services");
    expect(api.post).toHaveBeenCalledWith(
      "/reservations/reservation-1/charges",
      { serviceId: service.id, quantity: "2.00" },
    );
  });
});
