import "server-only";

import { getVercelOidcToken } from "@vercel/oidc";
import { API_URL } from "@/lib/config";

/** Call the configured API while keeping workload credentials on the server. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const target = new URL(`${API_URL}${path}`);
  const headers = new Headers(init.headers);
  if (process.env.VERCEL === "1" && target.protocol === "https:" && target.hostname.endsWith(".vercel.app")) {
    const token = await getVercelOidcToken();
    if (!token) throw new Error("Missing Vercel workload identity token");
    headers.set("x-vercel-trusted-oidc-idp-token", token);
  }
  // A redirect must never forward workload identity to another destination.
  return fetch(target, { ...init, headers, redirect: "error" });
}
