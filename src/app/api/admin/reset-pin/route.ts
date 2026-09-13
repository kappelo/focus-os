import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { nowIso, query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

const schema = z.object({
  userId: z.string().uuid(),
  newPin: z.string().regex(/^\d{4,10}$/),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "admin-reset-pin", { limit: 12, windowMs: 15 * 60_000 });
    const admin = await getSession();
    if (!admin || admin.role !== "admin")
      return Response.json({ error: "Brak uprawnień" }, { status: 403 });
    const input = schema.parse(await request.json());
    const hash = await bcrypt.hash(input.newPin, 12);
    await query(
      `UPDATE users SET pin_hash = ?, pin_changed_at = ?, updated_at = ?, session_version = session_version + 1, failed_attempts = 0, locked_until = NULL
       WHERE id = ?`,
      [hash, nowIso(), nowIso(), input.userId],
    );
    await query(
      "INSERT INTO security_audit(user_id, event) VALUES (?, 'pin_admin_reset')",
      [input.userId],
    );
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
