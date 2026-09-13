import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

type UserListRow = {
  id: string;
  username: string;
  display_name: string;
  role: "user" | "admin";
  locked_until: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const admin = await getSession();
    if (!admin || admin.role !== "admin")
      return Response.json({ error: "Brak uprawnień" }, { status: 403 });
    const result = await query<UserListRow>(
      "SELECT id, username, display_name, role, locked_until, created_at FROM users ORDER BY created_at ASC",
    );
    return Response.json({
      users: result.rows.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.display_name,
        role: user.role,
        lockedUntil: user.locked_until,
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

const mutationSchema = (input: unknown) => {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { userId?: unknown }).userId !== "string"
  ) {
    throw new Error("Nieprawidłowy użytkownik");
  }
  return input as { userId: string; role?: "user" | "admin" };
};

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "admin-users", { limit: 30, windowMs: 15 * 60_000 });
    const admin = await getSession();
    if (!admin || admin.role !== "admin")
      return Response.json({ error: "Brak uprawnień" }, { status: 403 });
    const input = mutationSchema(await request.json());
    if (input.role !== "user" && input.role !== "admin") {
      return Response.json({ error: "Wybierz poprawną rolę" }, { status: 400 });
    }
    if (input.userId === admin.id && input.role !== "admin") {
      return Response.json({ error: "Nie możesz odebrać sobie roli administratora" }, { status: 400 });
    }
    if (input.role === "user") {
      const admins = query<{ count: number }>("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      const target = query<{ role: "user" | "admin" }>("SELECT role FROM users WHERE id = ?", [input.userId]);
      if (target.rows[0]?.role === "admin" && admins.rows[0]?.count <= 1) {
        return Response.json({ error: "Musi pozostać przynajmniej jeden administrator" }, { status: 400 });
      }
    }
    const result = query("UPDATE users SET role = ?, updated_at = ? WHERE id = ?", [input.role, new Date().toISOString(), input.userId]);
    if (!result.rowCount) return Response.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "admin-users", { limit: 12, windowMs: 15 * 60_000 });
    const admin = await getSession();
    if (!admin || admin.role !== "admin")
      return Response.json({ error: "Brak uprawnień" }, { status: 403 });
    const input = mutationSchema(await request.json());
    if (input.userId === admin.id) {
      return Response.json({ error: "Nie możesz usunąć aktualnie zalogowanego administratora" }, { status: 400 });
    }
    const target = query<{ role: "user" | "admin" }>("SELECT role FROM users WHERE id = ?", [input.userId]);
    if (!target.rows[0]) return Response.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });
    if (target.rows[0].role === "admin") {
      const admins = query<{ count: number }>("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (admins.rows[0]?.count <= 1) {
        return Response.json({ error: "Musi pozostać przynajmniej jeden administrator" }, { status: 400 });
      }
    }
    query("DELETE FROM users WHERE id = ?", [input.userId]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
