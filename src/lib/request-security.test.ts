import { afterEach, describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  enforceRateLimit,
  RequestSecurityError,
  resetRateLimitsForTests,
} from "@/lib/request-security";

afterEach(() => resetRateLimitsForTests());

describe("request security", () => {
  it("accepts a same-origin browser mutation", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:2026/api/sync", {
          method: "POST",
          headers: { origin: "http://localhost:2026", host: "localhost:2026" },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a cross-origin browser mutation", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:2026/api/sync", {
          method: "POST",
          headers: { origin: "https://attacker.example", host: "localhost:2026" },
        }),
      ),
    ).toThrow(RequestSecurityError);
  });

  it("accepts a same-origin mutation behind a reverse proxy", () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/sync", {
          method: "POST",
          headers: {
            origin: "https://focus.example.test",
            host: "127.0.0.1:3000",
            "x-forwarded-host": "focus.example.test",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).not.toThrow();
  });

  it("blocks repeated requests within the configured window", () => {
    const request = new Request("http://localhost:2026/api/auth/login", {
      method: "POST",
      headers: { "x-real-ip": "127.0.0.1" },
    });
    enforceRateLimit(request, "test", { limit: 1, windowMs: 60_000 });
    expect(() =>
      enforceRateLimit(request, "test", { limit: 1, windowMs: 60_000 }),
    ).toThrow(RequestSecurityError);
  });
});
