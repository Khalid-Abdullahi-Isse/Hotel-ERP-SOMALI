import { describe, expect, it } from "vitest";
import { hasTrustedOrigin } from "@/lib/request-origin";

describe("request origin validation", () => {
  it("accepts same-origin browser requests", () => {
    const request = new Request("https://hotel.example/api/auth/login", {
      headers: { Origin: "https://hotel.example" },
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("rejects cross-origin browser requests", () => {
    const request = new Request("https://hotel.example/api/auth/login", {
      headers: { Origin: "https://attacker.example" },
    });
    expect(hasTrustedOrigin(request)).toBe(false);
  });

  it("allows server-to-server requests without an Origin header", () => {
    expect(hasTrustedOrigin(new Request("https://hotel.example/api/auth/login"))).toBe(true);
  });
});
