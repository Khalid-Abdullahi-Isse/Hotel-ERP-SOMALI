import { NextResponse } from "next/server";
import { API_URL } from "@/lib/config";
import { ACCESS_COOKIE, REFRESH_COOKIE, authCookieOptions } from "@/lib/auth-cookies";
import type { ApiAuthenticationResult } from "@/types/api-contracts";

interface RefreshCookie {
  value: string;
  expires?: Date;
}

export interface SessionRefreshResult {
  backendResponse: Response;
  auth: ApiAuthenticationResult;
}

const refreshRequests = new Map<string, Promise<SessionRefreshResult | null>>();

function setCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""];
}

export function getRefreshCookie(response: Response): RefreshCookie | null {
  const header = setCookieHeaders(response).find((value) =>
    value.includes(`${REFRESH_COOKIE}=`),
  );
  if (!header) return null;

  const value = header.match(new RegExp(`(?:^|,\\s*)${REFRESH_COOKIE}=([^;]+)`))?.[1];
  if (!value) return null;

  const rawExpiry = header.match(/(?:^|;)\s*Expires=([^;]+)/i)?.[1];
  const expires = rawExpiry ? new Date(rawExpiry) : undefined;
  return {
    value,
    ...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
  };
}

export function setAuthCookies(response: NextResponse, auth: ApiAuthenticationResult, backendResponse: Response) {
  response.cookies.set(ACCESS_COOKIE, auth.accessToken, { ...authCookieOptions, maxAge: auth.expiresIn });
  const refresh = getRefreshCookie(backendResponse);
  if (refresh) {
    response.cookies.set(REFRESH_COOKIE, refresh.value, {
      ...authCookieOptions,
      ...(refresh.expires ? { expires: refresh.expires } : { maxAge: 7 * 24 * 60 * 60 }),
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
}

async function requestSessionRefresh(refreshToken: string): Promise<SessionRefreshResult | null> {
  const response = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { Accept: "application/json", Cookie: `${REFRESH_COOKIE}=${refreshToken}` }, cache: "no-store" });
  if (!response.ok) return null;
  return { backendResponse: response, auth: await response.json() as ApiAuthenticationResult };
}

export function refreshSession(refreshToken: string): Promise<SessionRefreshResult | null> {
  const pending = refreshRequests.get(refreshToken);
  if (pending) return pending;

  const request = requestSessionRefresh(refreshToken).finally(() => {
    const cleanup = setTimeout(() => refreshRequests.delete(refreshToken), 5_000);
    if (typeof cleanup === "object" && "unref" in cleanup) cleanup.unref();
  });
  refreshRequests.set(refreshToken, request);
  return request;
}

export function isAccessTokenUsable(token: string, nowSeconds = Date.now() / 1000): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof decoded.exp === "number" && decoded.exp > nowSeconds + 30;
  } catch {
    return false;
  }
}

export function updateCookieHeader(
  header: string | null,
  updates: Readonly<Record<string, string>>,
): string {
  const values = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  for (const [name, value] of Object.entries(updates)) values.set(name, value);
  return [...values].map(([name, value]) => `${name}=${value}`).join("; ");
}
