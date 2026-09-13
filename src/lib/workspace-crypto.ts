import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "focus-os:v1";

function encryptionKey() {
  const secret = process.env.WORKSPACE_ENCRYPTION_KEY;
  if (!secret) return null;
  if (secret.length < 32) {
    throw new Error("WORKSPACE_ENCRYPTION_KEY musi mieć przynajmniej 32 znaki");
  }
  return createHash("sha256").update(secret).digest();
}

export function workspaceEncryptionEnabled() {
  return Boolean(encryptionKey());
}

export function protectWorkspacePayload(payload: string) {
  const key = encryptionKey();
  if (!key) return payload;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function revealWorkspacePayload(payload: string) {
  if (!payload.startsWith(`${PREFIX}:`)) return payload;
  const key = encryptionKey();
  if (!key) {
    throw new Error("Baza zawiera zaszyfrowany workspace. Ustaw WORKSPACE_ENCRYPTION_KEY.");
  }
  const [, , ivPart, tagPart, encryptedPart] = payload.split(":");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Uszkodzony zaszyfrowany workspace");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function serializeWorkspace(workspace: unknown) {
  return protectWorkspacePayload(JSON.stringify(workspace));
}

export function parseWorkspace<T>(payload: string) {
  return JSON.parse(revealWorkspacePayload(payload)) as T;
}
