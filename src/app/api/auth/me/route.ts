import { getSession, refreshSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ user: null }, { status: 401 });
  await refreshSession(user);
  return Response.json(
    { user },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
