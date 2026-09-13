import { afterEach, describe, expect, it } from "vitest";
import {
  parseWorkspace,
  protectWorkspacePayload,
  revealWorkspacePayload,
  serializeWorkspace,
} from "@/lib/workspace-crypto";

const previousKey = process.env.WORKSPACE_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.WORKSPACE_ENCRYPTION_KEY;
  else process.env.WORKSPACE_ENCRYPTION_KEY = previousKey;
});

describe("workspace encryption", () => {
  it("keeps plaintext payloads readable when encryption is disabled", () => {
    delete process.env.WORKSPACE_ENCRYPTION_KEY;
    expect(protectWorkspacePayload('{"safe":true}')).toBe('{"safe":true}');
  });

  it("encrypts and decrypts a workspace payload", () => {
    process.env.WORKSPACE_ENCRYPTION_KEY = "test-encryption-key-with-at-least-thirty-two-characters";
    const encrypted = serializeWorkspace({ tasks: [{ id: "one" }] });
    expect(encrypted).toMatch(/^focus-os:v1:/);
    expect(parseWorkspace<{ tasks: { id: string }[] }>(encrypted)).toEqual({
      tasks: [{ id: "one" }],
    });
    expect(revealWorkspacePayload(encrypted)).toContain('"one"');
  });
});
