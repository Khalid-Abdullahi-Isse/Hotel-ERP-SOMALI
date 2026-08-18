import { NextResponse } from "next/server";
import { revokeBackendSession } from "@/lib/auth-logout";
import { clearAuthCookies } from "@/lib/auth-session";
import { hasTrustedOrigin, untrustedOriginResponse } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return untrustedOriginResponse();
  await revokeBackendSession(true).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
