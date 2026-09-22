import { timingSafeEqual } from "node:crypto";
import { dispatchDuePush } from "@/lib/push-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = Buffer.from(process.env.SESSION_SECRET ?? "");
  const received = Buffer.from(request.headers.get("x-focus-worker-token") ?? "");
  if (!expected.length || received.length !== expected.length || !timingSafeEqual(received, expected))
    return Response.json({ error: "Brak uprawnień" }, { status: 403 });
  try {
    const result = await dispatchDuePush();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Nie udało się sprawdzić przypomnień" }, { status: 500 });
  }
}
