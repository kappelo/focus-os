import { expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/request-security", () => ({ assertSameOrigin: vi.fn(), enforceRateLimit: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(":memory:");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, display_name TEXT, pin_hash TEXT, role TEXT, session_version INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT)");
  return { nowIso: () => new Date().toISOString(), transaction: (callback: (db: InstanceType<typeof Database>) => unknown) => db.transaction(() => callback(db))() };
});

it("grants admin only to the first registration, not subsequent accounts", async () => {
  const { POST } = await import("./route");
  const request = (username: string) => new Request("http://localhost/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, name: "Test learner", pin: "987654321" }),
  });
  const first = await POST(request("first_learner"));
  const second = await POST(request("second_learner"));
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect((await first.json()).user.role).toBe("admin");
  expect((await second.json()).user.role).toBe("user");
  expect((await POST(request("first_learner"))).status).toBe(409);
});
