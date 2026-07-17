import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { durableJobs } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis/client";

const queues = new Map<string, Queue>();

export function getQueue(name: string) {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedis(), prefix: env.REDIS_PREFIX, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1_000 }, removeOnComplete: 500, removeOnFail: 1_000 } });
    queues.set(name, queue);
  }
  return queue;
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

export async function enqueueDurableJob(input: { queue: string; name: string; idempotencyKey: string; payload: Record<string, unknown>; tenantId?: string; projectId?: string }) {
  const existing = await db.query.durableJobs.findFirst({ where: eq(durableJobs.idempotencyKey, input.idempotencyKey) });
  if (existing) return { job: existing, duplicate: true, queuedInRedis: existing.status !== "failed" };
  const [job] = await db.insert(durableJobs).values({ ...input, tenantId: input.tenantId ?? null, projectId: input.projectId ?? null }).returning();
  try {
    await getQueue(input.queue).add(input.name, { durableJobId: job.id, ...input.payload }, { jobId: job.id });
    return { job, duplicate: false, queuedInRedis: true };
  } catch (error) {
    await db.update(durableJobs).set({ error: `Redis enqueue unavailable: ${error instanceof Error ? error.message : "unknown error"}`, updatedAt: new Date() }).where(eq(durableJobs.id, job.id));
    if (!env.INFRA_ALLOW_DEGRADED) throw error;
    return { job: { ...job, error: "Redis enqueue unavailable" }, duplicate: false, queuedInRedis: false };
  }
}
