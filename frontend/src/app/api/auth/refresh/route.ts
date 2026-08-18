import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import { clearAuthCookies, refreshSession, setAuthCookies } from "@/lib/auth-session";
import { hasTrustedOrigin, untrustedOriginResponse } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return untrustedOriginResponse();
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) return NextResponse.json({ message: "Refresh session is missing." }, { status: 401 });
  const result = await refreshSession(refresh);
  if (!result) { const response = NextResponse.json({ message: "Session expired." }, { status: 401 }); clearAuthCookies(response); return response; }
  const response = NextResponse.json({ ok: true, expiresIn: result.auth.expiresIn });
  setAuthCookies(response, result.auth, result.backendResponse);
  return response;
}
