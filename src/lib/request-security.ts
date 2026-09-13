import "server-only";

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 429,
  ) {
    super(message);
  }
}

type RateLimit = { count: number; resetAt: number };
const limits = new Map<string, RateLimit>();

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function toOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Reject browser requests forged from another origin. Non-browser clients do not send Origin. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const originValue = toOrigin(origin);
  if (!originValue) {
    throw new RequestSecurityError("Nieprawidłowy nagłówek Origin", 403);
  }

  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost || request.headers.get("host") || "";
  const forwardedProtocol = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );
  const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  const configured = (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(toOrigin)
    .filter((value): value is string => Boolean(value));
  const trustedOrigins = new Set<string>([
    new URL(request.url).origin,
    ...(host ? [toOrigin(`${protocol}://${host}`)].filter((value): value is string => Boolean(value)) : []),
    ...configured,
  ]);
  if (!trustedOrigins.has(originValue)) {
    throw new RequestSecurityError("Żądanie z niedozwolonego źródła", 403);
  }
}

/** Small in-memory guard for a single self-hosted instance. A reverse proxy can add a stronger limit. */
export function enforceRateLimit(
  request: Request,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number },
) {
  const now = Date.now();
  const key = `${scope}:${clientAddress(request)}`;
  const entry = limits.get(key);
  if (!entry || entry.resetAt <= now) {
    limits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) {
    throw new RequestSecurityError(
      "Za dużo prób. Spróbuj ponownie za kilka minut.",
      429,
    );
  }
}

export function resetRateLimitsForTests() {
  limits.clear();
}
