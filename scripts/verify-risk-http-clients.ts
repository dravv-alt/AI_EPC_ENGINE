import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { developmentProjectId } from "../src/lib/demo";

// Slice 5: with RISK_POLL_MODE=http, risk signals must come from real configured
// HTTP endpoints, and the weather_forecast signal must be sourced from the
// Open-Meteo marine client (not a plain risk endpoint). We stand up a local stub
// serving both the procurement/lead-time/workforce signal endpoints and an
// Open-Meteo marine payload, point the env at it, then run a real risk poll
// against the seeded project and assert the persisted risk_signals rows carry
// the stub origins — with the weather row sourced from the marine endpoint the
// stub confirms was actually queried.
//
// Env must be set before any module that reads it is imported, so the app
// modules are pulled in dynamically after configuration.

const SEEDED_PROJECT = developmentProjectId;
const SEEDED_ACTOR = "10000000-0000-4000-8000-000000000002";

function signalPayload() {
  return JSON.stringify({ dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { mode: "http-stub" }, unavailableReason: null });
}

function marinePayload() {
  const wave_height = Array.from({ length: 24 }, (_, hour) => 1.5 + (hour % 6) * 0.2);
  return JSON.stringify({ hourly: { wave_height } });
}

async function main() {
  const hits = { marine: 0, signal: 0 };
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/marine") { hits.marine += 1; res.end(marinePayload()); return; }
    hits.signal += 1; res.end(signalPayload());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;

  process.env.RISK_POLL_MODE = "http";
  process.env.RISK_PROCUREMENT_URL = `${origin}/procurement`;
  process.env.RISK_LEAD_TIME_URL = `${origin}/lead-time`;
  process.env.RISK_WORKFORCE_URL = `${origin}/workforce`;
  process.env.OPEN_METEO_BASE_URL = `${origin}/marine`;
  process.env.RISK_SITE_LAT = "18.9492";
  process.env.RISK_SITE_LNG = "72.9347";

  const { db } = await import("../src/lib/db/client");
  const { riskSignals, scheduleRisks } = await import("../src/lib/db/schema");
  const { pollProjectRisks } = await import("../src/lib/predictive-risk/engine");
  const { eq, inArray } = await import("drizzle-orm");

  const before = await db.select().from(scheduleRisks).where(eq(scheduleRisks.projectId, SEEDED_PROJECT));

  let pollCycleId: string | undefined;
  try {
    const summary = await pollProjectRisks({ projectId: SEEDED_PROJECT, actorId: SEEDED_ACTOR });
    pollCycleId = summary.pollCycleId;

    const signals = await db.select().from(riskSignals).where(eq(riskSignals.pollCycleId, summary.pollCycleId));
    const weather = signals.filter((row) => row.signalType === "weather_forecast");
    const procurement = signals.filter((row) => row.signalType === "procurement_status");

    assert.ok(procurement.length >= 1, "The http poll must record procurement signals.");
    assert.ok(procurement.every((row) => row.source.includes(`127.0.0.1:${port}`)), "Procurement signals must be sourced from the configured http endpoint, not a synthetic baseline.");
    assert.ok(weather.length >= 1, "The http poll must record weather signals.");
    assert.ok(hits.marine >= 1, "The weather signal must query the Open-Meteo marine endpoint.");
    assert.ok(weather.every((row) => row.source.includes(`127.0.0.1:${port}`)), "Weather signals must be sourced from the Open-Meteo marine endpoint.");

    console.log(`HTTP risk clients verified: ${signals.length} signal(s) sourced from ${origin}; marine endpoint queried ${hits.marine}x for weather.`);
  } finally {
    // Restore/remove scheduleRisks mutations BEFORE deleting riskSignals: a
    // pre-existing (e.g. seeded) schedule_risk can have its sourceSignalId
    // updated to point at a row created in THIS poll's cycle — including on
    // the resolve path, which sets sourceSignalId even when clearing a risk
    // that predates this test. Deleting riskSignals first would violate that
    // foreign key; restoring the original sourceSignalId first releases it.
    const after = await db.select().from(scheduleRisks).where(eq(scheduleRisks.projectId, SEEDED_PROJECT));
    const beforeById = new Map(before.map((row) => [row.id, row]));
    const created = after.filter((row) => !beforeById.has(row.id)).map((row) => row.id);
    if (created.length) await db.delete(scheduleRisks).where(inArray(scheduleRisks.id, created));
    for (const original of before) {
      await db.update(scheduleRisks).set({ status: original.status, sourceSignalId: original.sourceSignalId, probability: original.probability, estimatedDelayHours: original.estimatedDelayHours, clearedAt: original.clearedAt, version: original.version, observedAt: original.observedAt, updatedAt: original.updatedAt }).where(eq(scheduleRisks.id, original.id));
    }
    if (pollCycleId) await db.delete(riskSignals).where(eq(riskSignals.pollCycleId, pollCycleId));
    server.close();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
