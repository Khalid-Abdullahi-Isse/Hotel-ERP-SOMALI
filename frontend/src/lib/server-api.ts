import "server-only";

import { cookies } from "next/headers";
import { toApiError } from "@/lib/api-error";
import { API_URL } from "@/lib/config";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
