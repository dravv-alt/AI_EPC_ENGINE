import assert from "node:assert/strict";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { durableJobs, riskSignals } from "../src/lib/db/schema";

// Slice 2: the predictive-risk engine must poll active projects automatically
// on the recurring loop — no manual API call. The orchestration enqueues each
// project's poll under a `risk-poll-auto:` idempotency key that the manual
// /schedule/risks route never uses, so its presence proves an automatic poll
// ran. We then confirm it produced signal observations.
async function main() {
  let autoJob: { id: string; status: string; result: unknown } | undefined;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const [row] = await db
      .select({ id: durableJobs.id, status: durableJobs.status, result: durableJobs.result })
      .from(durableJobs)
      .where(and(eq(durableJobs.name, "risk.poll"), like(durableJobs.idempotencyKey, "risk-poll-auto:%")))
      .orderBy(desc(durableJobs.updatedAt))
      .limit(1);
    if (row && row.status === "completed") { autoJob = row; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.ok(autoJob, "An automatic (non-manual) risk poll must run for an active project without an API trigger.");
  const result = autoJob!.result as { pollCycleId?: string; taskCount?: number } | null;
  assert.ok(result?.pollCycleId, "The automatic poll must record a poll cycle id.");
  assert.ok((result?.taskCount ?? 0) >= 1, "The automatic poll must cover at least one accepted task.");

  const cycleRows = await db
    .select({ id: riskSignals.id })
    .from(riskSignals)
    .where(eq(riskSignals.pollCycleId, result!.pollCycleId!));
  assert.ok(cycleRows.length >= 1, "The automatic poll cycle must persist signal observations.");

  console.log(`Automatic risk polling ran: cycle ${result!.pollCycleId} covered ${result!.taskCount} task(s), wrote ${cycleRows.length} signal(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
