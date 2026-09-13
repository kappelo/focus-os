import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { nowIso, query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

type DeviceRow = {
  id: string;
  name: string;
  kind: "mobile" | "tablet" | "laptop" | "desktop";
  platform: string;
  last_seen_at: string;
  created_at: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSession();
    if (!user)
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const result = query<DeviceRow>(
      `SELECT id, name, kind, platform, last_seen_at, created_at
       FROM user_devices
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY last_seen_at DESC`,
      [user.id],
    );
    return Response.json(
      {
        devices: result.rows.map((device) => ({
          id: device.id,
          name: device.name,
          kind: device.kind,
          platform: device.platform,
          lastSeenAt: device.last_seen_at,
          createdAt: device.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

const revokeSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "devices", { limit: 30, windowMs: 15 * 60_000 });
    const user = await getSession();
    if (!user)
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = revokeSchema.parse(await request.json());
    const result = query(
      `UPDATE user_devices SET revoked_at = ?
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
      [nowIso(), input.id, user.id],
    );
    if (!result.rowCount)
      return Response.json(
        { error: "Nie znaleziono urządzenia" },
        { status: 404 },
      );
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
