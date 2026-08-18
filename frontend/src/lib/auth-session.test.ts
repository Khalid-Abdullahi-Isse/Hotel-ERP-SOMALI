import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRefreshCookie,
  isAccessTokenUsable,
  refreshSession,
  updateCookieHeader,
} from "@/lib/auth-session";

function accessToken(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authentication session helpers", () => {
  it("reads the rotated backend refresh cookie and preserves its expiry", () => {
    const response = new Response(null, {
      headers: {
        "Set-Cookie": "hotel_erp_refresh=rotated-token; Path=/api/v1/auth; HttpOnly; Expires=Mon, 24 Aug 2026 12:00:00 GMT; SameSite=Lax",
      },
    });

    expect(getRefreshCookie(response)).toEqual({
      value: "rotated-token",
      expires: new Date("2026-08-24T12:00:00.000Z"),
    });
  });

  it("only treats access tokens outside the refresh safety window as usable", () => {
    expect(isAccessTokenUsable(accessToken(1_100), 1_000)).toBe(true);
    expect(isAccessTokenUsable(accessToken(1_020), 1_000)).toBe(false);
    expect(isAccessTokenUsable("not-a-jwt", 1_000)).toBe(false);
  });

  it("updates auth cookies without dropping unrelated request cookies", () => {
    expect(
      updateCookieHeader("theme=dark; preference=a=b", {
        hotel_erp_access: "access",
        hotel_erp_refresh: "refresh",
      }),
    ).toBe("theme=dark; preference=a=b; hotel_erp_access=access; hotel_erp_refresh=refresh");
  });

  it("coalesces concurrent rotation attempts for the same refresh token", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          accessToken: "access",
          expiresIn: 900,
          user: {
            id: "user-1",
            hotelId: "hotel-1",
            email: "admin@example.com",
            username: "admin",
            fullName: "Admin",
            roles: ["ADMIN"],
            permissions: ["room.view"],
          },
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "hotel_erp_refresh=next-refresh; Path=/api/v1/auth; HttpOnly",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      refreshSession("same-refresh-token"),
      refreshSession("same-refresh-token"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first?.auth.accessToken).toBe("access");
    expect(second).toBe(first);

    const straggler = await refreshSession("same-refresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(straggler).toBe(first);
  });
});
