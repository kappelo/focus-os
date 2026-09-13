import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createSqliteBackup, nowIso, query, transaction } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { parseWorkspace, serializeWorkspace } from "@/lib/workspace-crypto";

const deviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["mobile", "tablet", "laptop", "desktop"]),
  platform: z.string().trim().min(1).max(80),
  appVersion: z.string().trim().min(1).max(24),
});

const workspaceSchema = z
  .object({
    syncId: z.string().uuid(),
    updatedAt: z.string().datetime(),
    version: z.number().int().positive(),
  })
  .catchall(z.unknown());

const inputSchema = z.object({
  device: deviceSchema,
  workspace: workspaceSchema,
  baseRevision: z.number().int().nonnegative(),
  dirty: z.boolean(),
  resolvedConflictId: z.string().uuid().optional(),
});

type WorkspaceRow = {
  payload: string;
  revision: number;
  server_updated_at: string;
};

class RevokedDeviceError extends Error {}

type RevisionRow = {
  revision: number;
  created_at: string;
  device_name: string | null;
};

type ConflictRow = {
  id: string;
  base_revision: number;
  server_revision: number;
  created_at: string;
  resolved_at: string | null;
  device_name: string | null;
};

export async function GET() {
  try {
    const user = await getSession();
    if (!user)
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const revisions = query<RevisionRow>(
      `SELECT r.revision, r.created_at, d.name AS device_name
       FROM workspace_revisions r
       LEFT JOIN user_devices d ON d.id = r.device_id
       WHERE r.user_id = ? ORDER BY r.revision DESC LIMIT 100`,
      [user.id],
    );
    const conflicts = query<ConflictRow>(
      `SELECT c.id, c.base_revision, c.server_revision, c.created_at, c.resolved_at, d.name AS device_name
       FROM sync_conflicts c
       LEFT JOIN user_devices d ON d.id = c.device_id
       WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 30`,
      [user.id],
    );
    return Response.json(
      {
        revisions: revisions.rows.map((entry) => ({
          revision: entry.revision,
          createdAt: entry.created_at,
          deviceName: entry.device_name ?? "Nieznane urządzenie",
        })),
        conflicts: conflicts.rows.map((entry) => ({
          id: entry.id,
          baseRevision: entry.base_revision,
          serverRevision: entry.server_revision,
          createdAt: entry.created_at,
          resolvedAt: entry.resolved_at,
          deviceName: entry.device_name ?? "Nieznane urządzenie",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "sync", { limit: 240, windowMs: 60_000 });
    const user = await getSession();
    if (!user)
      return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = inputSchema.parse(await request.json());
    const serializedWorkspace = serializeWorkspace(input.workspace);
    if (serializedWorkspace.length > 12_000_000) {
      return Response.json(
        { error: "Workspace przekracza limit 12 MB" },
        { status: 413 },
      );
    }

    const result = transaction((db) => {
      const now = nowIso();
      const existingDevice = db
        .prepare("SELECT user_id, revoked_at FROM user_devices WHERE id = ?")
        .get(input.device.id) as
        | { user_id: string; revoked_at: string | null }
        | undefined;
      if (
        existingDevice &&
        (existingDevice.user_id !== user.id || existingDevice.revoked_at)
      ) {
        throw new RevokedDeviceError("Urządzenie zostało odłączone");
      }
      if (existingDevice) {
        db.prepare(
          `UPDATE user_devices
           SET name = ?, kind = ?, platform = ?, app_version = ?, last_seen_at = ?
           WHERE id = ?`,
        ).run(
          input.device.name,
          input.device.kind,
          input.device.platform,
          input.device.appVersion,
          now,
          input.device.id,
        );
      } else {
        db.prepare(
          `INSERT INTO user_devices
           (id, user_id, name, kind, platform, app_version, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          input.device.id,
          user.id,
          input.device.name,
          input.device.kind,
          input.device.platform,
          input.device.appVersion,
          now,
          now,
        );
      }

      const server = db
        .prepare(
          `SELECT payload, revision, server_updated_at
           FROM user_workspaces WHERE user_id = ?`,
        )
        .get(user.id) as WorkspaceRow | undefined;
      if (server && input.baseRevision !== server.revision) {
        const conflictId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO sync_conflicts
           (id, user_id, device_id, base_revision, server_revision, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          conflictId,
          user.id,
          input.device.id,
          input.baseRevision,
          server.revision,
          now,
        );
        return {
          status: "conflict" as const,
          workspace: parseWorkspace<Record<string, unknown>>(server.payload),
          revision: server.revision,
          serverUpdatedAt: server.server_updated_at,
          conflictId,
        };
      }
      if (server && !input.dirty) {
        return {
          status: "synced" as const,
          workspace: parseWorkspace<Record<string, unknown>>(server.payload),
          revision: server.revision,
          serverUpdatedAt: server.server_updated_at,
        };
      }

      const revision = server ? server.revision + 1 : 1;
      db.prepare(
        `INSERT INTO user_workspaces
         (user_id, payload, revision, client_updated_at, server_updated_at, updated_by_device)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           payload = excluded.payload,
           revision = excluded.revision,
           client_updated_at = excluded.client_updated_at,
           server_updated_at = excluded.server_updated_at,
           updated_by_device = excluded.updated_by_device`,
      ).run(
        user.id,
        serializedWorkspace,
        revision,
        input.workspace.updatedAt,
        now,
        input.device.id,
      );
      db.prepare(
        `INSERT OR REPLACE INTO workspace_revisions(user_id, revision, payload, device_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(user.id, revision, serializedWorkspace, input.device.id, now);
      db.prepare(
        `DELETE FROM workspace_revisions
         WHERE user_id = ? AND revision < ?`,
      ).run(user.id, Math.max(revision - 99, 1));
      if (input.resolvedConflictId) {
        db.prepare(
          `UPDATE sync_conflicts SET resolved_at = ?
           WHERE id = ? AND user_id = ? AND resolved_at IS NULL`,
        ).run(now, input.resolvedConflictId, user.id);
      }
      return {
        status: "synced" as const,
        workspace: input.workspace,
        revision,
        serverUpdatedAt: now,
      };
    });

    const workspaceSettings = (input.workspace as Record<string, unknown>).settings as Record<string, unknown> | undefined;
    if (workspaceSettings?.automaticDailyBackup !== false) {
      await createSqliteBackup("automatic").catch(() => undefined);
    }
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RevokedDeviceError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    return apiError(error);
  }
}
