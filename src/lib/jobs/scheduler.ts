import { getQueue } from "@/lib/jobs/queue";
import { env } from "@/lib/env";

export const HEARTBEAT_JOB_NAME = "poll.heartbeat";
export const HEARTBEAT_IDEMPOTENCY_KEY = "poll:heartbeat";

// Registers the recurring poll loop as a BullMQ repeatable job. Idempotent:
// re-registering with the same repeat key replaces the existing schedule, so
// calling this on every worker start is safe.
export async function registerPollSchedules(queueName = "core") {
  if (!env.POLL_ENABLED) return { registered: false, reason: "POLL_ENABLED is false." };
  const queue = getQueue(queueName);
  // Fire once immediately so the loop is observable without waiting a full
  // interval, then register the recurring schedule.
  await queue.add(HEARTBEAT_JOB_NAME, {}, { jobId: "poll-heartbeat-bootstrap" });
  await queue.add(HEARTBEAT_JOB_NAME, {}, { repeat: { every: env.POLL_INTERVAL_MS }, jobId: HEARTBEAT_JOB_NAME });
  return { registered: true, intervalMs: env.POLL_INTERVAL_MS };
}
