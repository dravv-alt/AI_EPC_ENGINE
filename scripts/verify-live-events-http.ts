import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { projects, riskSignals, scheduleTasks, shipments } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

// Slice 11: the Live Events feed must surface the most recent *polled* signals —
// AIS positions and weather adjustments from the supply poll, plus risk-signal
// observations — as one timestamped stream, so the demo shows automatic activity.
// The pre-existing risk `{ items: [{ signal, taskName }] }` contract (asserted by
// verify-risk-http) must keep working; AIS/weather items are additive and carry a
// `kind` discriminator. Expected values are drawn from what we seed here, not from
// the route under test.
async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

type Item =
  | { kind: "risk"; signal: { pollCycleId: string; signalType: string; status: string; dataAvailable: boolean; unavailableReason: string | null; observedAt: string }; taskName: string; at: string }
  | { kind: "ais"; label: string; detail: string; at: string; positionSource: string; mmsi: string | null }
  | { kind: "weather"; label: string; detail: string; at: string; weatherDelayFactor: string; status: string };

async function main() {
  const base = process.env.LIVE_EVENTS_TEST_URL ?? "http://localhost:4293";
  const tag = randomUUID().slice(0, 8);
  const pollCycleId = randomUUID();
  let seededShipmentId: string | undefined;
  let savedShipment: typeof shipments.$inferSelect | undefined;
  const riskIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(project, "A seeded project is required.");

    // AIS + weather: mutate an existing seeded shipment so it looks freshly polled.
    const [shipment] = await db.select().from(shipments).where(eq(shipments.projectId, project.id)).limit(1);
    assert.ok(shipment, "A seeded shipment is required for AIS/weather live events.");
    seededShipmentId = shipment.id;
    savedShipment = shipment;
    const polledAt = new Date();
    await db.update(shipments).set({
      currentLat: "1.234567", currentLng: "103.765432", positionSource: "aisstream", mmsi: `56${tag.slice(0, 6)}`,
      weatherDelayFactor: "0.42000", status: "amber", weatherAdjustedEta: new Date(polledAt.getTime() + 6 * 3_600_000), lastPolledAt: polledAt
    }).where(eq(shipments.id, shipment.id));

    // Risk: an observation against an existing seeded task in this project.
    const [task] = await db.select({ id: scheduleTasks.id, name: scheduleTasks.name }).from(scheduleTasks).where(eq(scheduleTasks.projectId, project.id)).limit(1);
    assert.ok(task, "A seeded schedule task is required for a risk live event.");
    const observedAt = new Date();
    const [risk] = await db.insert(riskSignals).values({
      projectId: project.id, taskId: task.id, pollCycleId, signalType: "weather_forecast", status: "recorded",
      dataAvailable: true, source: `live-events-verify-${tag}`, value: { note: tag }, unavailableReason: null, observedAt
    }).returning({ id: riskSignals.id });
    riskIds.push(risk.id);

    const live: { items: Item[] } = await request(base, `/api/projects/${project.id}/schedule/live-events`);
    assert.ok(Array.isArray(live.items), "Live events must return an items array.");

    // AIS item drawn from the polled shipment.
    const ais = live.items.find((item): item is Extract<Item, { kind: "ais" }> => item.kind === "ais" && item.label === shipment.name);
    assert.ok(ais, "The feed must include an AIS item for the freshly polled shipment.");
    assert.equal(ais.positionSource, "aisstream", "The AIS item must report the polled position source.");
    assert.ok(ais.at, "The AIS item must carry the poll timestamp.");

    // Weather item drawn from the same shipment's weather fields.
    const weather = live.items.find((item): item is Extract<Item, { kind: "weather" }> => item.kind === "weather" && item.label === shipment.name);
    assert.ok(weather, "The feed must include a weather item for the polled shipment.");
    assert.equal(weather.status, "amber", "The weather item must report the recomputed shipment status.");
    assert.ok(Number(weather.weatherDelayFactor) > 0, "The weather item must carry the recorded delay factor.");

    // Risk item preserves the existing signal shape used by verify-risk-http.
    const riskItem = live.items.find((item): item is Extract<Item, { kind: "risk" }> => item.kind === "risk" && item.signal?.pollCycleId === pollCycleId);
    assert.ok(riskItem, "The feed must include the risk observation.");
    assert.equal(riskItem.signal.signalType, "weather_forecast");
    assert.equal(riskItem.signal.status, "recorded");
    assert.equal(riskItem.signal.dataAvailable, true);
    assert.equal(riskItem.taskName, task.name, "The risk item must keep its joined task name.");

    // Sorted newest-first by observation timestamp.
    const times = live.items.map((item) => new Date(item.at).getTime());
    for (let i = 1; i < times.length; i += 1) assert.ok(times[i - 1] >= times[i], "Live events must be ordered newest-first.");

    // The risk contract with an explicit taskId filter must still return only risk items.
    const filtered: { items: Item[] } = await request(base, `/api/projects/${project.id}/schedule/live-events?taskId=${task.id}`);
    assert.ok(filtered.items.every((item) => item.kind === "risk"), "A taskId-filtered query must return only risk items (verify-risk-http contract).");
    assert.ok(filtered.items.some((item) => item.kind === "risk" && (item as Extract<Item, { kind: "risk" }>).signal.pollCycleId === pollCycleId), "The task filter must still find the seeded risk signal.");

    console.log(`Live events HTTP verification passed: AIS (${ais.positionSource}), weather (${weather.status}, factor ${weather.weatherDelayFactor}), and risk (${riskItem.signal.signalType}) observations streamed newest-first with preserved risk contract.`);
  } finally {
    if (riskIds.length) await db.delete(riskSignals).where(inArray(riskSignals.id, riskIds));
    if (seededShipmentId && savedShipment) await db.update(shipments).set({
      currentLat: savedShipment.currentLat, currentLng: savedShipment.currentLng, positionSource: savedShipment.positionSource, mmsi: savedShipment.mmsi,
      weatherDelayFactor: savedShipment.weatherDelayFactor, status: savedShipment.status, weatherAdjustedEta: savedShipment.weatherAdjustedEta, lastPolledAt: savedShipment.lastPolledAt
    }).where(eq(shipments.id, seededShipmentId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
