import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RecentReservations } from "./recent-reservations";

afterEach(cleanup);

describe("RecentReservations", () => {
  it("links the full list to the supplied reservation dataset", () => {
    render(
      <RecentReservations
        reservations={[]}
        viewAllHref="/reservations?arrivalFrom=2026-08-23"
      />,
    );

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/reservations?arrivalFrom=2026-08-23",
    );
  });
});
