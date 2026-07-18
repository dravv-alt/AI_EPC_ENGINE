import assert from "node:assert/strict";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { scheduleEvents, shipments } from "../src/lib/db/schema";

// Slice 4: the recurring supply poll must recompute shipment status from live
// weather and, when a shipment crosses a green/amber/red boundary, emit a
// SHIPMENT_DELAYED (or SHIPMENT_RECOVERED) event — with no manual API call. The
// automatic poll stamps its transitionId with a `poll:` prefix, which the manual
// shipment routes never use; that prefix is encoded into the event dedupKey, so
// its presence proves the transition originated from the poll loop.
async function main() {
  let transition: { eventType: string; dedupKey: string; payload: unknown } | undefined;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const [row] = await db
      .select({ eventType: scheduleEvents.eventType, dedupKey: scheduleEvents.dedupKey, payload: scheduleEvents.payload })
      .from(scheduleEvents)
      .where(and(inArray(scheduleEvents.eventType, ["SHIPMENT_DELAYED", "SHIPMENT_RECOVERED"]), like(scheduleEvents.dedupKey, "%:poll:%")))
      .orderBy(desc(scheduleEvents.createdAt))
      .limit(1);
    if (row) { transition = row; break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.ok(transition, "The automatic supply poll must emit a poll-tagged shipment status transition.");
  const payload = transition!.payload as { shipmentId?: string; status?: string };
  assert.ok(payload.shipmentId, "A poll-emitted transition must name its shipment.");

  const [shipment] = await db
    .select({ status: shipments.status, weatherDelayFactor: shipments.weatherDelayFactor, weatherAdjustedEta: shipments.weatherAdjustedEta })
    .from(shipments)
    .where(eq(shipments.id, payload.shipmentId!))
    .limit(1);
  assert.ok(shipment, "The transitioned shipment must exist.");
  assert.ok(shipment.weatherAdjustedEta, "A weather-polled shipment must carry a recomputed adjusted ETA.");
  assert.ok(Number(shipment.weatherDelayFactor) > 0, "Live weather polling must record a non-zero delay factor.");

  console.log(`Automatic weather poll drove a ${transition!.eventType} transition: shipment ${payload.shipmentId} now ${shipment.status} (delay factor ${shipment.weatherDelayFactor}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
