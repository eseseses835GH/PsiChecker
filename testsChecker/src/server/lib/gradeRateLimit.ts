/**
 * Simple in-memory sliding-window limiter for /api/grade (best-effort per server instance).
 * Configure with GRADE_RATE_LIMIT_MAX (default 45) and GRADE_RATE_LIMIT_WINDOW_MS (default 60000).
 */

const buckets = new Map<string, number[]>();

function pruneStale(now: number, windowMs: number) {
  if (buckets.size < 5000) return;
  for (const [key, times] of buckets) {
    const fresh = times.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function rateLimitGradeRequest(clientKey: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const max = Math.max(1, Number(process.env.GRADE_RATE_LIMIT_MAX) || 45);
  const windowMs = Math.max(1000, Number(process.env.GRADE_RATE_LIMIT_WINDOW_MS) || 60_000);
  const now = Date.now();
  pruneStale(now, windowMs);

  const prev = buckets.get(clientKey)?.filter((t) => now - t < windowMs) ?? [];
  if (prev.length >= max) {
    const oldest = Math.min(...prev);
    const retryAfterMs = windowMs - (now - oldest);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  prev.push(now);
  buckets.set(clientKey, prev);
  return { ok: true };
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return raw.length > 0 ? raw : "unknown";
}
