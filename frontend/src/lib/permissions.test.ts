import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";

const staff: AuthUser = { id: "1", hotelId: "h1", name: "Staff", email: "staff@example.com", username: "staff", role: "RECEPTION", roles: ["RECEPTION"], permissions: ["room.view"] };

describe("can", () => {
  it("allows explicitly granted backend permissions", () => expect(can(staff, "room.view")).toBe(true));
  it("rejects missing permissions", () => expect(can(staff, "room.update")).toBe(false));
  it("allows ADMIN to operate without duplicated permission lists", () => expect(can({ ...staff, role: "ADMIN", roles: ["ADMIN"], permissions: [] }, "hotel.update")).toBe(true));
});
