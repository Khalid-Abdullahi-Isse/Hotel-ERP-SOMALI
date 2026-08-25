import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoomBoard } from "./room-board";
import type { FrontDeskRoom } from "@/types/front-desk";

const baseRoom: FrontDeskRoom = {
  id: "room-1",
  number: "101",
  roomType: "Standard Queen",
  floor: "Floor 1",
  status: "available",
  cleaningLabel: "Clean",
  action: "assign",
};

const allPermissions = { canCheckIn: true, canCreateReservation: true, canUpdateReservation: true, canViewHousekeeping: true, canViewMaintenance: true };

afterEach(cleanup);

describe("RoomBoard actions", () => {
  it("does not offer assignment when the user lacks reservation permission", () => {
    render(<RoomBoard rooms={[baseRoom]} permissions={{ ...allPermissions, canCreateReservation: false }} />);
    expect(screen.queryByRole("link", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View room" })).toHaveAttribute("href", "/rooms/room-1");
  });

  it("opens today's confirmed arrival in the check-in wizard", () => {
    render(<RoomBoard rooms={[{ ...baseRoom, guestName: "Mustafa Warsame", reservationId: "reservation-1", reservationCode: "RSV-1", reservationStatus: "CONFIRMED", arrivalDate: new Date().toISOString().slice(0, 10), nights: 3, action: "check_in" }]} permissions={allPermissions} />);
    expect(screen.getByRole("link", { name: "Check in" })).toHaveAttribute("href", "/front-desk/check-in/reservation-1");
    expect(screen.queryByRole("link", { name: "Assign" })).not.toBeInTheDocument();
  });

  it("hides check-in when permission is missing", () => {
    render(<RoomBoard rooms={[{ ...baseRoom, reservationId: "reservation-1", reservationStatus: "CONFIRMED", action: "check_in" }]} permissions={{ ...allPermissions, canCheckIn: false }} />);
    expect(screen.queryByRole("link", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View reservation" })).toBeInTheDocument();
  });

  it("routes checked-in reservations to the stay view", () => {
    render(<RoomBoard rooms={[{ ...baseRoom, status: "occupied", reservationId: "reservation-1", reservationStatus: "CHECKED_IN", action: "view_stay" }]} permissions={allPermissions} />);
    expect(screen.getByRole("link", { name: "View stay" })).toHaveAttribute("href", "/front-desk/stays/reservation-1");
  });
});
