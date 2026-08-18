import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-session";
import { revokeBackendSession } from "@/lib/auth-logout";
import { hasTrustedOrigin, untrustedOriginResponse } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return untrustedOriginResponse();
  await revokeBackendSession().catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
