"use client";

import { createContext, useContext, useMemo } from "react";
import { can } from "@/lib/permissions";
import type { Permission } from "@/constants/permissions";
import type { AuthUser } from "@/types/auth";

const CurrentUserContext = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser(): AuthUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used within AuthProvider.");
  return user;
}

export function usePermissions() {
  const user = useCurrentUser();
  return useMemo(
    () => ({
      permissions: user.permissions,
      has: (permission: Permission) => can(user, permission),
      hasAll: (permissions: readonly Permission[]) => permissions.every((permission) => can(user, permission)),
    }),
    [user],
  );
}
