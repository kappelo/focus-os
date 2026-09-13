import { describe, expect, it } from "vitest";
import { decryptWorkspaceBackup, encryptWorkspaceBackup, isEncryptedBackup } from "@/lib/backup-crypto";

describe("encrypted backups", () => {
  it("round-trips workspace data", async () => {
    const encrypted = await encryptWorkspaceBackup({ tasks: [{ id: "a" }] }, "bardzo-dobre-haslo");
    expect(isEncryptedBackup(encrypted)).toBe(true);
    await expect(decryptWorkspaceBackup(encrypted, "bardzo-dobre-haslo")).resolves.toEqual({ tasks: [{ id: "a" }] });
    await expect(decryptWorkspaceBackup(encrypted, "zle-haslo")).rejects.toThrow();
  });
});
