import assert from "node:assert/strict";
import { and, desc, eq, isNotNull, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { durableJobs, shipments } from "../src/lib/db/schema";

// Slice 3: shipments with an MMSI must have their live position refreshed by the
// recurring supply poll — no manual API call. The orchestration runs under a
// `supply-poll-auto:` idempotency key the manual shipment routes never use, so
// its presence proves an automatic poll ran. We then confirm an MMSI shipment
// carries a fresh position stamp from that poll.
async function main() {
  let autoJob: { status: string; result: unknown } | undefined;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const [row] = await db
      .select({ status: durableJobs.status, result: durableJobs.result })
      .from(durableJobs)
      .where(and(eq(durableJobs.name, "supply.poll"), like(durableJobs.idempotencyKey, "supply-poll-auto:%")))
      .orderBy(desc(durableJobs.updatedAt))
      .limit(1);
    if (row && row.status === "completed") { autoJob = row; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.ok(autoJob, "An automatic (non-manual) supply poll must run without an API trigger.");
  const result = autoJob!.result as { polled?: number } | null;
  assert.ok((result?.polled ?? 0) >= 1, "The automatic supply poll must refresh at least one MMSI shipment.");

  const [tracked] = await db
    .select({ id: shipments.id, currentLat: shipments.currentLat, currentLng: shipments.currentLng, lastPolledAt: shipments.lastPolledAt })
    .from(shipments)
    .where(isNotNull(shipments.mmsi))
    .orderBy(desc(shipments.lastPolledAt))
    .limit(1);
  assert.ok(tracked, "There must be at least one MMSI shipment to track.");
  assert.ok(tracked.lastPolledAt, "A polled shipment must carry a last-polled timestamp.");
  assert.ok(tracked.currentLat !== null && tracked.currentLng !== null, "A polled shipment must carry current coordinates.");

  console.log(`Automatic AIS polling ran: refreshed ${result!.polled} shipment(s); latest position ${tracked.currentLat},${tracked.currentLng} at ${tracked.lastPolledAt!.toISOString()}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
