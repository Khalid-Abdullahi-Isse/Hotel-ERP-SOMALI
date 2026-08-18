import { describe, expect, it } from "vitest";
import { reservationSchema } from "@/schemas/reservation.schema";
import { roomSchema } from "@/schemas/room.schema";

const reservation = { checkIn: "2026-09-01", checkOut: "2026-09-02", adults: 1, children: 0, roomType: "type-1", roomNumber: "room-1", guestName: "Amina Ali", phone: "+252610000000", email: "", nationality: "Somali", identification: "", paymentMethod: "cash" as const, deposit: 0, notes: "" };

describe("roomSchema", () => {
  it("accepts backend-compatible room values", () => expect(roomSchema.safeParse({ roomNumber: "A-101", floorId: "", roomTypeId: "11111111-1111-4111-8111-111111111111", notes: "Near lift" }).success).toBe(true));
  it("rejects unsafe room-number characters", () => expect(roomSchema.safeParse({ roomNumber: "101 / admin", roomTypeId: "11111111-1111-4111-8111-111111111111" }).success).toBe(false));
});

describe("reservationSchema", () => {
  it("accepts a valid booking", () => expect(reservationSchema.safeParse(reservation).success).toBe(true));
  it("rejects checkout on or before check-in", () => {
    const result = reservationSchema.safeParse({ ...reservation, checkOut: reservation.checkIn });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["checkOut"]);
  });
});
