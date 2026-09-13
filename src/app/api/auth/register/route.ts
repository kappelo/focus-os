import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { nowIso, transaction } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

const inputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,32}$/),
  name: z.string().trim().min(2).max(80),
  pin: z.string().regex(/^\d{4,10}$/),
});

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: "user" | "admin";
  session_version: number;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "register", { limit: 4, windowMs: 60 * 60_000 });
    const input = inputSchema.parse(await request.json());
    const pinHash = await bcrypt.hash(input.pin, 12);
    const user = transaction((db) => {
      const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
      const role = existing.count === 0 ? "admin" : "user";
      const result = db
        .prepare(
          `INSERT INTO users(id, username, display_name, pin_hash, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           RETURNING id, username, display_name, role, session_version`,
        )
        .get(
          crypto.randomUUID(),
          input.username,
          input.name,
          pinHash,
          role,
          nowIso(),
          nowIso(),
        ) as UserRow | undefined;
      return result;
    });

    if (!user) throw new Error("User was not created");
    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.display_name,
      role: user.role,
      sessionVersion: user.session_version,
    };
    await createSession(sessionUser);
    return Response.json({ user: sessionUser }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed/i.test(error.message)
    ) {
      return Response.json(
        { error: "Ta nazwa użytkownika jest już zajęta" },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
