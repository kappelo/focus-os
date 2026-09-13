import { z } from "zod";
import { apiError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { nowIso, query } from "@/lib/db";
import { assertSameOrigin, enforceRateLimit } from "@/lib/request-security";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { protectWorkspacePayload, revealWorkspacePayload } from "@/lib/workspace-crypto";

type TwoFactorRow = { two_factor_secret: string | null; two_factor_enabled: number };

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const row = query<TwoFactorRow>("SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?", [user.id]).rows[0];
    return Response.json({ enabled: Boolean(row?.two_factor_enabled) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "two-factor-setup", { limit: 10, windowMs: 60_000 });
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const secret = generateTotpSecret();
    return Response.json({ secret, uri: totpUri(secret, user.username) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "two-factor-confirm", { limit: 10, windowMs: 60_000 });
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = z.object({ secret: z.string().regex(/^[A-Z2-7]{16,64}$/), code: z.string().regex(/^\d{6}$/) }).parse(await request.json());
    if (!verifyTotp(input.secret, input.code)) return Response.json({ error: "Kod nie pasuje. Sprawdź godzinę urządzenia." }, { status: 400 });
    query("UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1, updated_at = ? WHERE id = ?", [protectWorkspacePayload(input.secret), nowIso(), user.id]);
    query("INSERT INTO security_audit(user_id, event) VALUES (?, ?)", [user.id, "two_factor_enabled"]);
    return Response.json({ enabled: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request, "two-factor-disable", { limit: 10, windowMs: 60_000 });
    const user = await getSession();
    if (!user) return Response.json({ error: "Wymagane logowanie" }, { status: 401 });
    const input = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await request.json());
    const row = query<TwoFactorRow>("SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?", [user.id]).rows[0];
    const secret = row?.two_factor_secret ? revealWorkspacePayload(row.two_factor_secret) : "";
    if (!row?.two_factor_enabled || !verifyTotp(secret, input.code)) return Response.json({ error: "Nieprawidłowy kod." }, { status: 400 });
    query("UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0, updated_at = ? WHERE id = ?", [nowIso(), user.id]);
    query("INSERT INTO security_audit(user_id, event) VALUES (?, ?)", [user.id, "two_factor_disabled"]);
    return Response.json({ enabled: false });
  } catch (error) {
    return apiError(error);
  }
}
