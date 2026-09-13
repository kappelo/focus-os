import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { nowIso, query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { verifyTotp } from "@/lib/totp";
import { revealWorkspacePayload } from "@/lib/workspace-crypto";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(32),
  pin: z.string().regex(/^\d{4,10}$/),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: "user" | "admin";
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  session_version: number;
  two_factor_secret: string | null;
  two_factor_enabled: number;
  must_change_pin: number;
};

async function audit(userId: string | null, event: string) {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  await query(
    "INSERT INTO security_audit(user_id, event, ip_hash) VALUES (?, ?, ?)",
    [userId, event, ipHash],
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "login", { limit: 12, windowMs: 15 * 60_000 });
    const input = inputSchema.parse(await request.json());
    const result = await query<UserRow>(
      `SELECT id, username, display_name, role, pin_hash, failed_attempts, locked_until, session_version, two_factor_secret, two_factor_enabled, must_change_pin
       FROM users WHERE username = ?`,
      [input.username],
    );
    const user = result.rows[0];
    if (!user) {
      await bcrypt.compare(
        input.pin,
        "$2b$12$4TzWsnTRROfvPiG83dJvX.ka2vJpY3uKXkqM8hKkf6mEfHgiZoXJ6",
      );
      return Response.json(
        { error: "Nieprawidłowy użytkownik lub PIN" },
        { status: 401 },
      );
    }

    if (
      user.locked_until &&
      new Date(user.locked_until).getTime() > Date.now()
    ) {
      return Response.json(
        { error: "Konto chwilowo zablokowane. Spróbuj ponownie później." },
        { status: 429 },
      );
    }

    const valid = await bcrypt.compare(input.pin, user.pin_hash);
    if (!valid) {
      const attempts = user.failed_attempts + 1;
      await query(
        `UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`,
        [
          attempts,
          attempts >= 5
            ? new Date(Date.now() + 15 * 60_000).toISOString()
            : null,
          user.id,
        ],
      );
      await audit(user.id, attempts >= 5 ? "pin_locked" : "pin_failed");
      return Response.json(
        { error: "Nieprawidłowy użytkownik lub PIN" },
        { status: 401 },
      );
    }

    if (user.two_factor_enabled) {
      if (!input.totp) {
        return Response.json(
          { error: "Podaj kod z aplikacji uwierzytelniającej.", requiresTwoFactor: true },
          { status: 428 },
        );
      }
      const secret = user.two_factor_secret
        ? revealWorkspacePayload(user.two_factor_secret)
        : "";
      if (!secret || !verifyTotp(secret, input.totp)) {
        await audit(user.id, "totp_failed");
        return Response.json(
          { error: "Nieprawidłowy kod uwierzytelniający.", requiresTwoFactor: true },
          { status: 401 },
        );
      }
    }

    await query(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
      [nowIso(), user.id],
    );
    await audit(user.id, "login_success");
    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.display_name,
      role: user.role,
      sessionVersion: user.session_version,
    };
    await createSession(sessionUser);
    return Response.json({ user: sessionUser, mustChangePin: Boolean(user.must_change_pin) });
  } catch (error) {
    return apiError(error);
  }
}
