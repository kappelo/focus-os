import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createSession, getSession } from "@/lib/auth";
import { nowIso, query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

const schema = z.object({
  currentPin: z.string().regex(/^\d{4,10}$/),
  newPin: z.string().regex(/^\d{4,10}$/),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "change-pin", { limit: 6, windowMs: 15 * 60_000 });
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = schema.parse(await request.json());
    if (input.currentPin === input.newPin) {
      return Response.json({ error: "Nowy PIN musi różnić się od obecnego" }, { status: 400 });
    }
    const result = query<{ pin_hash: string; session_version: number }>(
      "SELECT pin_hash, session_version FROM users WHERE id = ?",
      [user.id],
    );
    const current = result.rows[0];
    if (!current || !(await bcrypt.compare(input.currentPin, current.pin_hash))) {
      return Response.json({ error: "Obecny PIN jest nieprawidłowy" }, { status: 401 });
    }
    const nextVersion = current.session_version + 1;
    await query(
      `UPDATE users SET pin_hash = ?, pin_changed_at = ?, updated_at = ?, session_version = ?, failed_attempts = 0, locked_until = NULL, must_change_pin = 0
       WHERE id = ?`,
      [await bcrypt.hash(input.newPin, 12), nowIso(), nowIso(), nextVersion, user.id],
    );
    const next = { ...user, sessionVersion: nextVersion };
    await createSession(next);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
