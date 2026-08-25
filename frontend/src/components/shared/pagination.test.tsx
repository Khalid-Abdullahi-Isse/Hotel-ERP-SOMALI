import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

afterEach(cleanup);

describe("Pagination", () => {
  it("shows the range, current page, and filter-preserving links", () => {
    render(<Pagination page={2} limit={30} total={1240} totalPages={42} itemLabel="reservations" searchParams={{ search: "Ahmed", status: "confirmed", arrivalFrom: "2026-08-23" }} />);
    expect(screen.getByText("Showing 31–60 of 1,240 reservations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "?search=Ahmed&status=confirmed&arrivalFrom=2026-08-23&page=1");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "?search=Ahmed&status=confirmed&arrivalFrom=2026-08-23&page=3");
  });

  it("disables previous on the first page and next on the last page", () => {
    const { rerender } = render(<Pagination page={1} limit={30} total={60} totalPages={2} searchParams={{}} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    rerender(<Pagination page={2} limit={30} total={60} totalPages={2} searchParams={{}} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("handles an empty result without invalid page links", () => {
    render(<Pagination page={1} limit={30} total={0} totalPages={0} searchParams={{}} />);
    expect(screen.getByText("Showing 0 of 0 records")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
