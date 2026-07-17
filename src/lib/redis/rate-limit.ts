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
