import { randomBytes } from "@/lib/ids";
import type { LocalProfile } from "@/lib/types";

function storageKey(profileId: string) {
  return `focus-os-biometric:${profileId}`;
}

export async function biometricAvailable() {
  return Boolean(
    window.isSecureContext &&
      "PublicKeyCredential" in window &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
  );
}

export async function registerBiometricLock(profile: LocalProfile) {
  if (!(await biometricAvailable()))
    throw new Error("Biometria wymaga HTTPS lub localhost oraz zgodnego urządzenia.");
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Focus OS" },
      user: {
        id: randomBytes(24),
        name: profile.username,
        displayName: profile.name,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Nie utworzono klucza biometrycznego.");
  localStorage.setItem(storageKey(profile.id), encode(new Uint8Array(credential.rawId)));
}

export async function unlockWithBiometric(profileId: string) {
  const encoded = localStorage.getItem(storageKey(profileId));
  if (!encoded) throw new Error("Najpierw skonfiguruj biometrię w ustawieniach.");
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: decode(encoded) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return Boolean(credential);
}

export function removeBiometricLock(profileId: string) {
  localStorage.removeItem(storageKey(profileId));
}

export function hasBiometricLock(profileId: string) {
  return Boolean(localStorage.getItem(storageKey(profileId)));
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
