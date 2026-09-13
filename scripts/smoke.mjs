import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import Database from "better-sqlite3";

// Never use the user's database, cookies or configuration for this test.
const directory = mkdtempSync(join(tmpdir(), "focus-os-smoke-"));
const probe = createServer();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [resolve(import.meta.dirname, "../.next/standalone/server.js")], {
  env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1",
    APP_ORIGIN: origin, SQLITE_PATH: join(directory, "test.sqlite"), COOKIE_SECURE: "false",
    SESSION_SECRET: randomBytes(48).toString("hex"), WORKSPACE_ENCRYPTION_KEY: randomBytes(32).toString("hex") },
  stdio: ["ignore", "ignore", "pipe"], windowsHide: true,
});
let serverError = "";
child.stderr.on("data", (chunk) => { serverError = (serverError + chunk).slice(-2000); });
const closed = new Promise((done) => child.on("close", done));
async function request(path, body, cookie) {
  const response = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { code: response.status, cookie: response.headers.get("set-cookie"), data: await response.json() };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await fetch(origin + "/api/health"); ready = true; break; } catch { await delay(100); }
  }
  assert.ok(ready, `Server did not start: ${serverError}`);
  const credentials = { username: "smoke_admin", name: "Smoke test", pin: "93647281" };
  const admin = await request("/api/auth/register", credentials);
  assert.equal(admin.code, 201);
  assert.equal(admin.data.user.role, "admin");
  assert.match(admin.cookie, /HttpOnly/i);
  assert.match(admin.cookie, /Max-Age=7776000/i);
  const cookieA = admin.cookie.split(";")[0];
  assert.equal((await request("/api/auth/me", undefined, cookieA)).code, 200);
  const testDb = new Database(join(directory, "test.sqlite"));
  testDb.prepare("UPDATE users SET must_change_pin = 1 WHERE username = ?").run(credentials.username);
  testDb.close();
  const login = await request("/api/auth/login", credentials);
  assert.equal(login.code, 200);
  assert.equal(login.data.mustChangePin, true);
  const cookieB = login.cookie.split(";")[0];
  const changed = await request("/api/auth/change-pin", { currentPin: credentials.pin, newPin: "86429731" }, cookieB);
  assert.equal(changed.code, 200);
  const relogin = await request("/api/auth/login", { ...credentials, pin: "86429731" });
  assert.equal(relogin.data.mustChangePin, false);
  const activeCookie = relogin.cookie.split(";")[0];
  const regular = await request("/api/auth/register", { ...credentials, username: "smoke_user" });
  assert.equal(regular.data.user.role, "user");
  assert.equal((await request("/api/admin/users", undefined, regular.cookie.split(";")[0])).code, 403);
  const device = { id: randomUUID(), name: "Test desktop", kind: "desktop", platform: "test", appVersion: "1.0.0" };
  const workspace = { syncId: randomUUID(), updatedAt: new Date().toISOString(), version: 1,
    settings: { automaticDailyBackup: false }, tasks: [{ id: "test-task", title: "Sync verification" }] };
  const first = await request("/api/sync", { device, workspace, baseRevision: 0, dirty: true }, activeCookie);
  assert.equal(first.data.revision, 1);
  const secondDevice = { ...device, id: randomUUID(), name: "Test phone", kind: "mobile" };
  const second = await request("/api/sync", { device: secondDevice, workspace, baseRevision: 1, dirty: false }, activeCookie);
  assert.deepEqual(second.data.workspace.tasks, workspace.tasks);
  const conflict = await request("/api/sync", { device: secondDevice, workspace, baseRevision: 0, dirty: true }, activeCookie);
  assert.equal(conflict.data.status, "conflict");
  assert.equal(conflict.data.revision, 1);
  const logout = await request("/api/auth/logout", {}, activeCookie);
  assert.equal(logout.code, 200);
  assert.match(logout.cookie, /Max-Age=0/i);
  console.log("PASS: registration roles, forced initial PIN change, persistent cookie, access control, two-device sync, conflict protection, logout.");
} finally {
  child.kill();
  await closed;
  // Delete only known files in this newly created test directory, never recurse.
  for (const name of readdirSync(directory)) {
    if (/^test\.sqlite(?:-wal|-shm)?$/.test(name)) unlinkSync(join(directory, name));
  }
  if (readdirSync(directory).length === 0) rmdirSync(directory);
}
