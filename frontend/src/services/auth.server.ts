import "server-only";

import { cache } from "react";
import { ApiError } from "@/lib/api-error";
import { serverApi } from "@/lib/server-api";
import type { AuthUser } from "@/types/auth";
import type { ApiCurrentUser } from "@/types/api-contracts";
import { adaptUser } from "@/lib/api-adapters";

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  try {
    return adaptUser(await serverApi<ApiCurrentUser>("/auth/me"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});
