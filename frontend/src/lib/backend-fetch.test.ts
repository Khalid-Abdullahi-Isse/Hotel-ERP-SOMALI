import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ API_URL: "https://staging-api.vercel.app/api/v1" }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: vi.fn() }));

import { getVercelOidcToken } from "@vercel/oidc";
import { backendFetch } from "@/lib/backend-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("backend workload authentication", () => {
  it("preserves application authorization without workload credentials locally", async () => {
    vi.stubEnv("VERCEL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    await backendFetch("/rooms", { headers: { Authorization: "Bearer app-token" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.href).toBe("https://staging-api.vercel.app/api/v1/rooms");
    expect(init.headers.get("Authorization")).toBe("Bearer app-token");
    expect(init.headers.has("x-vercel-trusted-oidc-idp-token")).toBe(false);
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("forwards request-scoped identity separately from JWT and rejects redirects", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.mocked(getVercelOidcToken).mockResolvedValue("workload-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    await backendFetch("/rooms", { headers: { Authorization: "Bearer app-token" }, redirect: "follow" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBe("Bearer app-token");
    expect(init.headers.get("x-vercel-trusted-oidc-idp-token")).toBe("workload-token");
    expect(init.redirect).toBe("error");
  });

  it("does not send an unauthenticated request when workload identity is missing", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.mocked(getVercelOidcToken).mockResolvedValue("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(backendFetch("/auth/login")).rejects.toThrow("Missing Vercel workload identity token");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
