import { getQueue } from "./queue";

/**
 * Schedule a repeatable BullMQ job that triggers risk.poll every `intervalMs`.
 * Uses BullMQ's built-in repeatable job support — the queue deduplicates by jobId,
 * so calling this multiple times for the same project is safe (idempotent).
 */
export async function scheduleRecurringRiskPoll(input: {
  projectId: string;
  actorId: string;
  intervalMs?: number;
}) {
  const { projectId, actorId, intervalMs = 300_000 } = input; // default: 5 minutes
  const jobId = `recurring-risk-${projectId}`;

  const queue = getQueue("core");

  // Remove any existing repeatable with this key before adding (to update interval)
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.id === jobId) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(
    "risk.poll",
    { projectId, actorId, durableJobId: jobId },
    {
      repeat: { every: intervalMs },
      jobId,
      removeOnComplete: 50,
      removeOnFail: 100,
    }
  );

  return { jobId, intervalMs, projectId };
}

/**
 * Stop the recurring risk poll for a project.
 */
export async function cancelRecurringRiskPoll(projectId: string) {
  const jobId = `recurring-risk-${projectId}`;
  const queue = getQueue("core");
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    if (job.id === jobId) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
  return { cancelled: true, projectId };
}
