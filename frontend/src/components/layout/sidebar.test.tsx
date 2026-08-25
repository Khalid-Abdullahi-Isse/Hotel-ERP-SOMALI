import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Building2, Layers3 } from "lucide-react";
import { SidebarGroup } from "@/components/layout/sidebar";
import { canAccessSidebarItem, getActiveSidebarItem, sidebarSections } from "@/components/layout/sidebar-config";
import type { SidebarNavItem } from "@/components/layout/sidebar-config";
import type { AuthUser } from "@/types/auth";

const setupGroup: SidebarNavItem = {
  label: "Property Setup",
  icon: Building2,
  children: [{ label: "Floors", href: "/floors", icon: Layers3 }],
};

afterEach(cleanup);

describe("sidebar navigation", () => {
  it("keeps setup destinations nested in Property Setup", () => {
    const topLevelLabels = sidebarSections.flatMap((section) => section.items.map((item) => item.label));
    const propertySetup = sidebarSections.flatMap((section) => section.items).find((item) => item.label === "Property Setup");

    expect(topLevelLabels).not.toContain("Floors");
    expect(topLevelLabels).not.toContain("Room Types");
    expect(propertySetup?.children?.map((item) => item.label)).toEqual(["Floors", "Room Types", "Amenities"]);
  });

  it("uses the most specific matching route", () => {
    expect(getActiveSidebarItem("/reservations/timeline")).toMatchObject({ label: "Calendar" });
  });

  it("shows Administration only to the exact backend ADMIN role", () => {
    const users = sidebarSections.flatMap((section) => section.items).find((item) => item.href === "/admin/users")!;
    const base: AuthUser = { id: "1", hotelId: "h1", name: "User", email: "user@example.com", username: "user", role: "MANAGER", roles: ["MANAGER"], permissions: ["user.manage", "role.manage"] };
    expect(canAccessSidebarItem(base, users)).toBe(false);
    expect(canAccessSidebarItem({ ...base, role: "ADMIN", roles: ["ADMIN"] }, users)).toBe(true);
  });

  it("toggles the Property Setup disclosure with aria-expanded", () => {
    render(<SidebarGroup item={setupGroup} compact={false} />);
    const toggle = screen.getByRole("button", { name: "Property Setup" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the group open when a child route is active", () => {
    render(<SidebarGroup item={setupGroup} activeItem={setupGroup.children?.[0]} compact={false} />);
    expect(screen.getByRole("button", { name: "Property Setup" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Floors" })).toHaveAttribute("aria-current", "page");
  });
});
