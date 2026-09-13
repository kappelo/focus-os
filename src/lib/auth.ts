import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { query } from "@/lib/db";

const COOKIE_NAME = "focus_os_session";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: "user" | "admin";
  sessionVersion: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters. Run npm run setup.");
  }
  return new TextEncoder().encode(value);
}

function sessionTtlDays() {
  const requested = Number(process.env.SESSION_TTL_DAYS ?? 90);
  return Number.isFinite(requested)
    ? Math.min(365, Math.max(1, Math.floor(requested)))
    : 90;
}

async function shouldUseSecureCookie() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const protocol = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  return protocol === "https";
}

export async function createSession(user: SessionUser) {
  const ttlDays = sessionTtlDays();
  const secureCookie = await shouldUseSecureCookie();
  const token = await new SignJWT({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    sv: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: ttlDays * 86_400,
    priority: "high",
  });
}

export async function refreshSession(user: SessionUser) {
  await createSession(user);
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "user" && payload.role !== "admin") ||
      typeof payload.sv !== "number"
    )
      return null;
    const result = query<{
      username: string;
      display_name: string;
      role: "user" | "admin";
      session_version: number;
    }>(
      "SELECT username, display_name, role, session_version FROM users WHERE id = ?",
      [payload.id],
    );
    const current = result.rows[0];
    if (!current || current.session_version !== payload.sv) return null;
    return {
      id: payload.id,
      username: current.username,
      name: current.display_name,
      role: current.role,
      sessionVersion: current.session_version,
    };
  } catch {
    return null;
  }
}
