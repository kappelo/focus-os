import { ZodError } from "zod";
import { RequestSecurityError } from "@/lib/request-security";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: "Nieprawidłowe dane", issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("API error:", message);
  if (error instanceof RequestSecurityError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (
    message.includes("SQLITE_PATH") ||
    message.includes("database") ||
    message.includes("connect")
  ) {
    return Response.json({ error: "Serwer synchronizacji jest chwilowo niedostępny" }, { status: 503 });
  }
  return Response.json({ error: "Wewnętrzny błąd serwera" }, { status: 500 });
}
