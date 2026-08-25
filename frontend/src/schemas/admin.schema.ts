import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const username = z.string().trim().toLowerCase().min(3, "Username must be at least 3 characters.").max(64).regex(/^[a-z0-9][a-z0-9._-]*$/, "Use lowercase letters, numbers, dots, dashes, or underscores.");
const fullName = z.string().trim().min(2, "Full name must be at least 2 characters.").max(160);
const roleIds = z.array(z.string().uuid()).min(1, "Assign at least one role.").max(10);

export const createAdminUserSchema = z.object({
  fullName,
  email,
  username,
  password: z.string().min(12, "Password must be at least 12 characters.").max(128),
  roleIds,
});

export const updateAdminUserSchema = z.object({ fullName, email, username });

export const resetAdminPasswordSchema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters.").max(128),
});

const roleName = z.string().trim().toUpperCase().min(2).max(64).regex(/^[A-Z][A-Z0-9 _-]*$/, "Use uppercase letters, numbers, spaces, dashes, or underscores.");

export const createAdminRoleSchema = z.object({
  name: roleName,
  description: z.string().trim().max(500).optional(),
  permissionKeys: z.array(z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)).max(100),
});

export const updateAdminRoleSchema = z.object({
  name: roleName,
  description: z.string().trim().max(500).optional(),
});

export type CreateAdminUserValues = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserValues = z.infer<typeof updateAdminUserSchema>;
export type ResetAdminPasswordValues = z.infer<typeof resetAdminPasswordSchema>;
export type CreateAdminRoleValues = z.infer<typeof createAdminRoleSchema>;
export type UpdateAdminRoleValues = z.infer<typeof updateAdminRoleSchema>;
