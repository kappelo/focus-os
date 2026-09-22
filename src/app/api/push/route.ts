import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { disablePushSubscription, pushConfiguration, savePushSubscription } from "@/lib/push-server";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(10).max(256) }),
});

export async function GET() {
  try {
    if (!(await getSession())) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const { available, publicKey } = pushConfiguration();
    return Response.json({ available, publicKey }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "push-subscribe", { limit: 20, windowMs: 60_000 });
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    if (!pushConfiguration().available) return Response.json({ error: "Brak konfiguracji Web Push" }, { status: 503 });
    const input = subscriptionSchema.parse(await request.json());
    savePushSubscription(user.id, input);
    return Response.json({ subscribed: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = subscriptionSchema.pick({ endpoint: true }).parse(await request.json());
    disablePushSubscription(user.id, input.endpoint);
    return Response.json({ subscribed: false });
  } catch (error) { return apiError(error); }
}
