import { afterEach, describe, expect, it, vi } from "vitest";
import { createId, randomBytes } from "@/lib/ids";

afterEach(() => vi.unstubAllGlobals());

describe("browser-safe IDs", () => {
  it("creates a UUID v4 when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns the requested number of bytes without Web Crypto", () => {
    vi.stubGlobal("crypto", undefined);
    expect(randomBytes(16)).toHaveLength(16);
  });
});
