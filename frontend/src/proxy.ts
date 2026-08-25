import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-cookies";
import {
  clearAuthCookies,
  getRefreshCookie,
  isAccessTokenUsable,
  refreshSession,
  setAuthCookies,
  updateCookieHeader,
} from "@/lib/auth-session";

function loginRedirect(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(login);
  clearAuthCookies(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken && isAccessTokenUsable(accessToken)) return NextResponse.next();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return loginRedirect(request);

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed) return loginRedirect(request);

  const rotatedRefresh = getRefreshCookie(refreshed.backendResponse)?.value ?? refreshToken;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    updateCookieHeader(request.headers.get("cookie"), {
      [ACCESS_COOKIE]: refreshed.auth.accessToken,
      [REFRESH_COOKIE]: rotatedRefresh,
    }),
  );
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  setAuthCookies(response, refreshed.auth, refreshed.backendResponse);
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/rooms/:path*",
    "/reservations/:path*",
    "/guests/:path*",
    "/front-desk/:path*",
    "/housekeeping/:path*",
    "/payments/:path*",
    "/expenses/:path*",
    "/accounting/:path*",
    "/employees/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/admin/:path*",
    "/audit-logs/:path*",
    "/invoices/:path*",
    "/maintenance/:path*",
    "/services/:path*",
    "/floors/:path*",
    "/room-types/:path*",
    "/payment-methods/:path*",
    "/property/:path*",
    "/help/:path*",
  ],
};
