import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies";
import { clearAuthCookies, refreshSession, setAuthCookies } from "@/lib/auth-session";
import { API_URL } from "@/lib/config";
import { hasTrustedOrigin, untrustedOriginResponse } from "@/lib/request-origin";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (request.method !== "GET" && request.method !== "HEAD" && !hasTrustedOrigin(request)) {
    return untrustedOriginResponse();
  }
  const { path } = await context.params;
  const cookieStore = await cookies();
  let access = cookieStore.get(ACCESS_COOKIE)?.value;
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  let refreshed: Awaited<ReturnType<typeof refreshSession>> = null;
  if (!access && refresh) {
    refreshed = await refreshSession(refresh);
    access = refreshed?.auth.accessToken;
  }
  if (!access) {
    const response = NextResponse.json({ code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }
  const sourceUrl = new URL(request.url);
  const target = `${API_URL}/${path.map(encodeURIComponent).join("/")}${sourceUrl.search}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const call = (token: string) => fetch(target, { method: request.method, body, headers: { Accept: request.headers.get("accept") ?? "application/json", "Content-Type": request.headers.get("content-type") ?? "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
  let backend = await call(access);
  if (backend.status === 401 && refresh && !refreshed) {
    refreshed = await refreshSession(refresh);
    if (refreshed) backend = await call(refreshed.auth.accessToken);
  }
  const response = new NextResponse(await backend.arrayBuffer(), { status: backend.status, headers: { "Content-Type": backend.headers.get("content-type") ?? "application/json" } });
  if (refreshed) setAuthCookies(response, refreshed.auth, refreshed.backendResponse);
  else if (backend.status === 401) clearAuthCookies(response);
  return response;
}

export const GET = proxy; export const POST = proxy; export const PUT = proxy; export const PATCH = proxy; export const DELETE = proxy;
