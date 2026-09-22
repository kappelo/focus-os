import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import webpush from "web-push";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, ".env.local");
if (existsSync(path)) {
  console.log("Konfiguracja już istnieje. Zachowano klucze i bazę danych.");
} else {
  writeFileSync(path, [
    "APP_PORT=2026",
    "SQLITE_PATH=./data/focus-os.sqlite",
    `SESSION_SECRET=${randomBytes(48).toString("hex")}`,
    `WORKSPACE_ENCRYPTION_KEY=${randomBytes(48).toString("hex")}`,
    "SESSION_TTL_DAYS=90", "COOKIE_SECURE=false", "",
  ].join("\n"), { flag: "wx", mode: 0o600 });
  console.log("Utworzono .env.local z losowymi kluczami.");
}
const configured = readFileSync(path, "utf8");
const hasPublic = /^VAPID_PUBLIC_KEY=.+$/m.test(configured);
const hasPrivate = /^VAPID_PRIVATE_KEY=.+$/m.test(configured);
if (hasPublic !== hasPrivate) throw new Error("Niekompletna para kluczy VAPID w .env.local. Uzupełnij ją przed uruchomieniem.");
if (!hasPublic) {
  const keys = webpush.generateVAPIDKeys();
  appendFileSync(path, `\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://github.com/kappelo/focus-os\n`);
  console.log("Dodano lokalną parę kluczy VAPID. Klucz prywatny pozostaje w .env.local.");
}
process.loadEnvFile(path);
const databasePath = resolve(root, process.env.SQLITE_PATH ?? "data/focus-os.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', session_version INTEGER NOT NULL DEFAULT 1,
  must_change_pin INTEGER NOT NULL DEFAULT 0, failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT, pin_changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("ALTER TABLE users ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0"); }
catch (error) { if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error; }
const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
if (count === 0) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users
    (id, username, display_name, pin_hash, role, must_change_pin, created_at, updated_at)
    VALUES (?, 'admin', 'Administrator', ?, 'admin', 1, ?, ?)`)
    .run(randomUUID(), await bcrypt.hash("1234", 12), now, now);
  console.log("Utworzono konto startowe: admin / 1234. Zmień PIN po pierwszym logowaniu.");
} else {
  console.log("Baza zawiera już konta — nie dodano ani nie zmieniono użytkowników.");
}
db.close();
