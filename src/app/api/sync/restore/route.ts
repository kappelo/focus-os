import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { nowIso, transaction } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { parseWorkspace, serializeWorkspace } from "@/lib/workspace-crypto";

const deviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["mobile", "tablet", "laptop", "desktop"]),
  platform: z.string().trim().min(1).max(80),
  appVersion: z.string().trim().min(1).max(24),
});

const schema = z.object({ revision: z.number().int().positive(), device: deviceSchema });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "sync-restore", { limit: 8, windowMs: 15 * 60_000 });
    const user = await getSession();
    if (!user)
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = schema.parse(await request.json());
    const result = transaction((db) => {
      const now = nowIso();
      const device = db
        .prepare("SELECT user_id, revoked_at FROM user_devices WHERE id = ?")
        .get(input.device.id) as { user_id: string; revoked_at: string | null } | undefined;
      if (!device || device.user_id !== user.id || device.revoked_at) {
        throw new Error("To urządzenie nie jest uprawnione do przywracania danych");
      }
      const historical = db
        .prepare("SELECT payload FROM workspace_revisions WHERE user_id = ? AND revision = ?")
        .get(user.id, input.revision) as { payload: string } | undefined;
      if (!historical) throw new Error("Nie znaleziono tej rewizji");
      const current = db
        .prepare("SELECT revision FROM user_workspaces WHERE user_id = ?")
        .get(user.id) as { revision: number } | undefined;
      const revision = (current?.revision ?? 0) + 1;
      const workspace = parseWorkspace<Record<string, unknown>>(historical.payload);
      const restored = {
        ...workspace,
        version: Math.max(Number(workspace.version) || 1, revision),
        syncedVersion: Math.max(Number(workspace.version) || 1, revision),
        syncRevision: revision,
        updatedAt: now,
        lastSyncedAt: now,
      };
      const payload = serializeWorkspace(restored);
      db.prepare(
        `INSERT INTO user_workspaces
         (user_id, payload, revision, client_updated_at, server_updated_at, updated_by_device)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           payload = excluded.payload, revision = excluded.revision,
           client_updated_at = excluded.client_updated_at,
           server_updated_at = excluded.server_updated_at,
           updated_by_device = excluded.updated_by_device`,
      ).run(user.id, payload, revision, now, now, input.device.id);
      db.prepare(
        "INSERT INTO workspace_revisions(user_id, revision, payload, device_id, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(user.id, revision, payload, input.device.id, now);
      db.prepare("DELETE FROM workspace_revisions WHERE user_id = ? AND revision < ?")
        .run(user.id, Math.max(revision - 99, 1));
      return { workspace: restored, revision, serverUpdatedAt: now };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się przywrócić danych";
    if (message.includes("Nie znaleziono") || message.includes("nie jest uprawnione")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return apiError(error);
  }
}
