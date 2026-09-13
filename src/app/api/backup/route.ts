import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createSqliteBackup } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "manual-backup", { limit: 5, windowMs: 60_000 });
    if (!(await getSession())) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const result = await createSqliteBackup("manual");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
