import { describe, expect, it } from "vitest";
import { createAdminRoleSchema, createAdminUserSchema, updateAdminUserSchema } from "@/schemas/admin.schema";

const roleId = "1c9ec65f-81ca-47ac-9d45-7a90ddc56ad1";

describe("admin user schemas", () => {
  it("normalizes create fields to the backend DTO contract", () => {
    const result = createAdminUserSchema.parse({ fullName: "  Amina Hassan  ", email: "  AMINA@EXAMPLE.COM ", username: " AMINA.01 ", password: "a secure passphrase", roleIds: [roleId] });
    expect(result).toMatchObject({ fullName: "Amina Hassan", email: "amina@example.com", username: "amina.01", roleIds: [roleId] });
  });

  it("rejects short passwords and missing roles", () => {
    expect(createAdminUserSchema.safeParse({ fullName: "Amina Hassan", email: "amina@example.com", username: "amina", password: "short", roleIds: [] }).success).toBe(false);
  });

  it("limits edits to the backend's mutable profile fields", () => {
    const result = updateAdminUserSchema.parse({ fullName: "Amina Hassan", email: "amina@example.com", username: "amina", hotelId: "attacker-controlled" });
    expect(result).toEqual({ fullName: "Amina Hassan", email: "amina@example.com", username: "amina" });
  });
});

describe("admin role schemas", () => {
  it("normalizes valid custom role names and permission keys", () => {
    expect(createAdminRoleSchema.parse({ name: " night supervisor ", description: "Overnight operations", permissionKeys: ["reservation.view"] }).name).toBe("NIGHT SUPERVISOR");
  });

  it("rejects permission names outside the backend key format", () => {
    expect(createAdminRoleSchema.safeParse({ name: "NIGHT", permissionKeys: ["admin"] }).success).toBe(false);
  });
});
