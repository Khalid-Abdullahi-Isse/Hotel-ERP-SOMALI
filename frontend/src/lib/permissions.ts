import type { AuthUser } from "@/types/auth";
import type { Permission } from "@/constants/permissions";

export function can(user: AuthUser, permission?: Permission) {
  if (!permission || user.roles.includes("ADMIN")) return true;
  return user.permissions.includes(permission);
}

export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes("ADMIN");
}
