import { getQueue } from "@/lib/jobs/queue";
import { env } from "@/lib/env";

export const HEARTBEAT_JOB_NAME = "poll.heartbeat";
export const HEARTBEAT_IDEMPOTENCY_KEY = "poll:heartbeat";
export const RISK_POLL_ALL_JOB_NAME = "risk.poll.all";
export const SUPPLY_POLL_ALL_JOB_NAME = "supply.poll.all";

// Registers the recurring poll loop as BullMQ repeatable jobs. Idempotent:
// re-registering with the same repeat key replaces the existing schedule, so
// calling this on every worker start is safe. Each job also fires once
// immediately (bootstrap) so the loop is observable without waiting a full
// interval.
export async function registerPollSchedules(queueName = "core") {
  if (!env.POLL_ENABLED) return { registered: false, reason: "POLL_ENABLED is false." };
  const queue = getQueue(queueName);
  const jobs = [
    { name: HEARTBEAT_JOB_NAME, bootstrapId: "poll-heartbeat-bootstrap" },
    { name: RISK_POLL_ALL_JOB_NAME, bootstrapId: "risk-poll-all-bootstrap" },
    { name: SUPPLY_POLL_ALL_JOB_NAME, bootstrapId: "supply-poll-all-bootstrap" }
  ];
  for (const job of jobs) {
    await queue.add(job.name, {}, { jobId: job.bootstrapId });
    await queue.add(job.name, {}, { repeat: { every: env.POLL_INTERVAL_MS }, jobId: job.name });
  }
  return { registered: true, intervalMs: env.POLL_INTERVAL_MS, jobs: jobs.map((job) => job.name) };
}
