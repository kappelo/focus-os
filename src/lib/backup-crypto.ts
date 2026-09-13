const BACKUP_FORMAT = "focus-os-encrypted-v1";

type EncryptedBackup = {
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export async function encryptWorkspaceBackup(workspace: unknown, password: string) {
  if (password.length < 8) throw new Error("Hasło backupu musi mieć co najmniej 8 znaków.");
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("Ta przeglądarka nie udostępnia bezpiecznego szyfrowania.");
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const iterations = 250_000;
  const key = await deriveKey(password, salt, iterations, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(workspace));
  const ciphertext = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const backup: EncryptedBackup = {
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(backup, null, 2);
}

export async function decryptWorkspaceBackup(payload: string, password: string) {
  const parsed = JSON.parse(payload) as Partial<EncryptedBackup>;
  if (parsed.format !== BACKUP_FORMAT || !parsed.salt || !parsed.iv || !parsed.ciphertext || !parsed.iterations)
    throw new Error("To nie jest zaszyfrowany backup Focus OS.");
  const key = await deriveKey(password, fromBase64(parsed.salt), parsed.iterations, ["decrypt"]);
  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(parsed.iv) },
      key,
      fromBase64(parsed.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    throw new Error("Nieprawidłowe hasło albo uszkodzony backup.");
  }
}

export function isEncryptedBackup(payload: string) {
  try {
    return (JSON.parse(payload) as { format?: string }).format === BACKUP_FORMAT;
  } catch {
    return false;
  }
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number, usages: KeyUsage[]) {
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
