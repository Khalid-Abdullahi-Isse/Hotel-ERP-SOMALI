import "server-only";

import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies";
import { refreshSession } from "@/lib/auth-session";
import { API_URL } from "@/lib/config";

export async function revokeBackendSession(allSessions = false): Promise<void> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && refreshToken) {
    accessToken = (await refreshSession(refreshToken))?.auth.accessToken;
  }
  if (!accessToken) return;

  const endpoint = allSessions ? "/auth/logout-all" : "/auth/logout";
  const request = (token: string) =>
    fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

  let response = await request(accessToken);
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) response = await request(refreshed.auth.accessToken);
  }

  // Local credentials are cleared by the route even if the backend is unavailable.
  void response;
}
