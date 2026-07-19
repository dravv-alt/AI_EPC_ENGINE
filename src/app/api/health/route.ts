import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { durableJobs } from "@/lib/db/schema";
import { redisHealth } from "@/lib/redis/client";
import { objectStorage } from "@/lib/storage/service";

async function pollHealth() {
  if (!env.POLL_ENABLED) return { status: "disabled" as const, intervalMs: env.POLL_INTERVAL_MS };
  try {
    const row = await db.query.durableJobs.findFirst({ where: eq(durableJobs.idempotencyKey, "poll:heartbeat") });
    const heartbeatAt = (row?.result as { heartbeatAt?: string } | null)?.heartbeatAt ?? row?.completedAt?.toISOString() ?? null;
    if (!heartbeatAt) return { status: "pending" as const, intervalMs: env.POLL_INTERVAL_MS, reason: "No heartbeat has been recorded yet." };
    const staleAfterMs = env.POLL_INTERVAL_MS * 3;
    const stale = Date.now() - Date.parse(heartbeatAt) > staleAfterMs;
    return { status: stale ? ("stale" as const) : ("ok" as const), intervalMs: env.POLL_INTERVAL_MS, lastHeartbeatAt: heartbeatAt };
  } catch (error) {
    return { status: "unavailable" as const, intervalMs: env.POLL_INTERVAL_MS, reason: error instanceof Error ? error.message : "Poll health unavailable" };
  }
}

export async function GET() {
  const serviceHealth = async (url: string, service: string) => { try { const response = await fetch(url, { signal: AbortSignal.timeout(2_000), cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return { status: "ok" as const, service }; } catch (error) { return { status: "unavailable" as const, service, reason: error instanceof Error ? error.message : "Service unavailable" }; } };
  const [database, redis, objectStore, ingestion, solver, retrieval, poll] = await Promise.all([
    db.execute(sql`select 1`).then(() => ({ status: "ok" as const })).catch((error) => ({ status: "unavailable" as const, reason: error instanceof Error ? error.message : "Database unavailable" })),
    redisHealth(),
    objectStorage.health(),
    serviceHealth(`${env.INGESTION_SERVICE_URL}/health`, "ingestion"),
    serviceHealth(`${env.SOLVER_SERVICE_URL}/health`, "solver"),
    serviceHealth(`${env.RETRIEVAL_SERVICE_URL}/health`, "retrieval"),
    pollHealth()
  ]);
  // The retrieval service is only load-bearing when EMBEDDING_PROVIDER=service;
  // in mock mode (the offline default) it is probed for visibility but never
  // forces the overall status to degraded, matching how ingestion/solver would
  // behave if a feature that depends on them were similarly disabled.
  const coreDependencies = [database, redis, objectStore, ingestion, solver];
  const degraded = coreDependencies.some((dependency) => dependency.status !== "ok")
    || (env.EMBEDDING_PROVIDER === "service" && retrieval.status !== "ok");
  return NextResponse.json({
    status: degraded ? "degraded" : "ok",
    service: "pramana-cx",
    authMode: env.AUTH_MODE,
    dependencies: { database, redis, objectStore, ingestion, solver, retrieval, poll },
    degradedModeAllowed: env.INFRA_ALLOW_DEGRADED,
    timestamp: new Date().toISOString()
  }, { status: degraded && !env.INFRA_ALLOW_DEGRADED ? 503 : 200 });
}
