import "server-only";

import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

type SqlValue = string | number | null | Uint8Array;
type QueryResult<T> = { rows: T[]; rowCount: number };

const databasePath = process.env.SQLITE_PATH
  ? resolve(/* turbopackIgnore: true */ process.env.SQLITE_PATH)
  : resolve(process.cwd(), "data", "focus-os.sqlite");
const globalForDb = globalThis as unknown as {
  focusOsSqlite?: Database.Database;
};

function initialize(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      session_version INTEGER NOT NULL DEFAULT 1,
      must_change_pin INTEGER NOT NULL DEFAULT 0,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      pin_changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS security_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      event TEXT NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('mobile', 'tablet', 'laptop', 'desktop')),
      platform TEXT NOT NULL,
      app_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_devices_owner
      ON user_devices (user_id, last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS user_workspaces (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      client_updated_at TEXT NOT NULL,
      server_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by_device TEXT REFERENCES user_devices(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_revisions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      payload TEXT NOT NULL,
      device_id TEXT REFERENCES user_devices(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, revision)
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_revisions_recent
      ON workspace_revisions (user_id, revision DESC);
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT REFERENCES user_devices(id) ON DELETE SET NULL,
      base_revision INTEGER NOT NULL,
      server_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_owner
      ON sync_conflicts (user_id, created_at DESC);
  `);
  try {
    db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1");
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
      throw error;
    }
  }
  addColumn(db, "ALTER TABLE users ADD COLUMN two_factor_secret TEXT");
  addColumn(db, "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "ALTER TABLE users ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0");
}

function addColumn(db: Database.Database, sql: string) {
  try {
    db.exec(sql);
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
  }
}

export function getDatabase() {
  if (globalForDb.focusOsSqlite) return globalForDb.focusOsSqlite;
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  initialize(db);
  globalForDb.focusOsSqlite = db;
  return db;
}

export function query<T>(sql: string, values: SqlValue[] = []): QueryResult<T> {
  const statement = getDatabase().prepare(sql);
  if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
    const rows = statement.all(...values) as T[];
    return { rows, rowCount: rows.length };
  }
  const result = statement.run(...values);
  return { rows: [], rowCount: result.changes };
}

export function transaction<T>(fn: (db: Database.Database) => T) {
  const db = getDatabase();
  return db.transaction(() => fn(db))();
}

export function nowIso() {
  return new Date().toISOString();
}

export function resetAllData() {
  const db = getDatabase();
  db.exec(`
    DELETE FROM workspace_revisions;
    DELETE FROM user_workspaces;
    DELETE FROM user_devices;
    DELETE FROM security_audit;
    DELETE FROM users;
  `);
}

export async function createSqliteBackup(kind: "automatic" | "manual" = "automatic") {
  const database = getDatabase();
  const backupDirectory = resolve(dirname(databasePath), "..", "backups");
  mkdirSync(backupDirectory, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const suffix = kind === "manual" ? new Date().toISOString().replace(/[:.]/g, "-") : day;
  const destination = resolve(backupDirectory, `focus-os-${kind}-${suffix}.sqlite`);
  if (kind === "automatic" && existsSync(destination)) {
    return { created: false, name: destination.split(/[\\/]/).pop() ?? "backup.sqlite" };
  }
  await database.backup(destination);
  const automatic = readdirSync(backupDirectory)
    .filter((name) => /^focus-os-automatic-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
    .map((name) => ({ name, time: statSync(resolve(backupDirectory, name)).mtimeMs }))
    .toSorted((first, second) => second.time - first.time);
  for (const stale of automatic.slice(14)) {
    const target = resolve(backupDirectory, stale.name);
    if (target.startsWith(`${backupDirectory}\\`) || target.startsWith(`${backupDirectory}/`)) unlinkSync(target);
  }
  return { created: true, name: destination.split(/[\\/]/).pop() ?? "backup.sqlite" };
}
