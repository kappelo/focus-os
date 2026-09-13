import { clearSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { assertSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
