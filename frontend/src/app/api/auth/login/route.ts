import { NextResponse } from "next/server";
import { adaptUser } from "@/lib/api-adapters";
import { setAuthCookies } from "@/lib/auth-session";
import { API_URL } from "@/lib/config";
import type { ApiAuthenticationResult } from "@/types/api-contracts";
import { hasTrustedOrigin, untrustedOriginResponse } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return untrustedOriginResponse();
  const body = await request.text();
  const backend = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body, cache: "no-store" });
  const data = await backend.json();
  if (!backend.ok) return NextResponse.json(data, { status: backend.status });
  const auth = data as ApiAuthenticationResult;
  const response = NextResponse.json(adaptUser(auth.user));
  setAuthCookies(response, auth, backend);
  return response;
}
