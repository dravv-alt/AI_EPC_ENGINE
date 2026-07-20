import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis/client";

const fallback = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(key: string, limit = 120, windowSeconds = 60) {
  const namespaced = `${env.REDIS_PREFIX}:ratelimit:${key}`;
  try {
    const redis = getRedis();
    if (redis.status === "wait") await redis.connect();
    const count = await redis.incr(namespaced);
    if (count === 1) await redis.expire(namespaced, windowSeconds);
    const ttl = Math.max(await redis.ttl(namespaced), 1);
    return { allowed: count <= limit, remaining: Math.max(limit - count, 0), retryAfter: ttl, backend: "redis" as const };
  } catch (error) {
    if (!env.INFRA_ALLOW_DEGRADED) throw error;
    const now = Date.now();
    const current = fallback.get(namespaced);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : current;
    bucket.count += 1;
    fallback.set(namespaced, bucket);
    return { allowed: bucket.count <= limit, remaining: Math.max(limit - bucket.count, 0), retryAfter: Math.ceil((bucket.resetAt - now) / 1000), backend: "memory-degraded" as const };
  }
}

/**
 * Generalized, scope-aware rate limit enforcement (Rules.md line 87: auth,
 * upload, search, AI, export, schedule, compliance, risk, and knowledge
 * endpoints all require rate limiting). Returns a 429 NextResponse with a
 * retry-after hint when the caller has exhausted its budget for the window, or
 * null when the request may proceed. The response body is category-generic and
 * never references the caller's identity or the resource requested, so it
 * cannot be used to distinguish a real account/project from a fake one.
 */
export async function enforceRateLimit(scope: string, limit: number, windowSeconds: number) {
  const outcome = await checkRateLimit(scope, limit, windowSeconds);
  if (outcome.allowed) return null;
  const { NextResponse } = await import("next/server");
  return NextResponse.json(
    { error: "Rate limit exceeded. Retry after the cooldown window.", retryAfter: outcome.retryAfter },
    { status: 429, headers: { "retry-after": String(outcome.retryAfter) } }
  );
}

/**
 * Enforces the shared AI-route rate limit (configurable via AI_RATE_LIMIT /
 * AI_RATE_LIMIT_WINDOW_SECONDS). Covers the AI, compliance, and knowledge
 * categories named by Rules.md line 87.
 * Scope the key per project + route so tenants and endpoints don't share a budget.
 */
export async function enforceAiRateLimit(scope: string) {
  return enforceRateLimit(`ai:${scope}`, env.AI_RATE_LIMIT, env.AI_RATE_LIMIT_WINDOW_SECONDS);
}

/** Auth category (login/register/TOTP). Scope by client IP so an existence
 * probe against a real vs. fake account never affects, or is affected by, a
 * different budget — the 429 body and status are identical either way. */
export async function enforceAuthRateLimit(scope: string) {
  return enforceRateLimit(`auth:${scope}`, env.AUTH_RATE_LIMIT, env.AUTH_RATE_LIMIT_WINDOW_SECONDS);
}

/** Upload category (source ingestion). */
export async function enforceUploadRateLimit(scope: string) {
  return enforceRateLimit(`upload:${scope}`, env.UPLOAD_RATE_LIMIT, env.UPLOAD_RATE_LIMIT_WINDOW_SECONDS);
}

/** Schedule category (baseline/events/versions/tasks/resources/risks). */
export async function enforceScheduleRateLimit(scope: string) {
  return enforceRateLimit(`schedule:${scope}`, env.SCHEDULE_RATE_LIMIT, env.SCHEDULE_RATE_LIMIT_WINDOW_SECONDS);
}

/** Export category (turnover pack generation). */
export async function enforceExportRateLimit(scope: string) {
  return enforceRateLimit(`export:${scope}`, env.EXPORT_RATE_LIMIT, env.EXPORT_RATE_LIMIT_WINDOW_SECONDS);
}

/** Best-effort client IP for unauthenticated rate-limit scoping, matching the
 * extraction already used for session audit metadata. */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) || "unknown";
}
