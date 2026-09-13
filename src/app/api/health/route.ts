import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("SELECT 1");
    const integrity = query<{ quick_check: string }>("PRAGMA quick_check");
    if (integrity.rows[0]?.quick_check !== "ok") throw new Error("SQLite integrity check failed");
    return Response.json({ status: "healthy", database: "connected", integrity: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json(
      { status: "degraded", database: "unavailable", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
