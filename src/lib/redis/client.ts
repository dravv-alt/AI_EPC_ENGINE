import Redis from "ioredis";
import { env } from "@/lib/env";

const globalRedis = globalThis as typeof globalThis & { pramanaRedis?: Redis };

export function getRedis() {
  if (!globalRedis.pramanaRedis) {
    globalRedis.pramanaRedis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
      connectionName: "pramana-core"
    });
    globalRedis.pramanaRedis.on("error", () => undefined);
  }
  return globalRedis.pramanaRedis;
}

export async function redisHealth() {
  const redis = getRedis();
  try {
    if (redis.status === "wait") await redis.connect();
    const startedAt = Date.now();
    await redis.ping();
    return { status: "ok" as const, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return { status: "unavailable" as const, reason: error instanceof Error ? error.message : "Redis unavailable" };
  }
}
