import { describe, expect, it } from "vitest";
import { generateTotpSecret, totpCode, verifyTotp } from "@/lib/totp";

describe("TOTP", () => {
  it("verifies a current code and rejects another one", () => {
    const secret = generateTotpSecret();
    const time = 1_800_000_000_000;
    const code = totpCode(secret, time);
    expect(verifyTotp(secret, code, time)).toBe(true);
    expect(verifyTotp(secret, code === "000000" ? "000001" : "000000", time)).toBe(false);
  });
});
