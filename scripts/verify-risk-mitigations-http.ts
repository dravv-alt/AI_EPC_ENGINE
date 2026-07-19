import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { alerts, riskSignals, scheduleAssignments, scheduleEvents, scheduleRisks, scheduleTasks, scheduleVersions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { env } from "../src/lib/env";
import { getRiskSignalClients, type RiskSignalType, type RiskTaskContext } from "../src/lib/predictive-risk/clients";
import { pollProjectRisks, type RiskScenarioOverride } from "../src/lib/predictive-risk/engine";
import { generateMitigations, staticMitigations } from "../src/lib/predictive-risk/mitigations";

// Slice 8: the SyntheticSignalClient must be lively (deterministic-per-cycle,
// varying-across-cycles) instead of the flat constant it replaces, and
// material-risk mitigation proposals must come from the configured generation
// provider with a guaranteed static fallback on any failure. This script
// exercises both without a running HTTP server: pollProjectRisks and
// generateMitigations are called directly, matching the pattern already used
// by verify-risk-http-clients.ts.

const SEEDED_ACTOR = "10000000-0000-4000-8000-000000000002";

function scenario(taskId: string, workforceProbability: number, workforceDelayHours: number, weatherDataAvailable: boolean): RiskScenarioOverride[] {
  return [
    { taskId, signalType: "procurement_status", dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { state: "on_track" } },
    { taskId, signalType: "equipment_lead_time", dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { state: "available" } },
    { taskId, signalType: "workforce_availability", dataAvailable: true, probability: workforceProbability, estimatedDelayHours: workforceDelayHours, value: { availableCrew: 0 } },
    weatherDataAvailable
      ? { taskId, signalType: "weather_forecast", dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { state: "clear" } }
      : { taskId, signalType: "weather_forecast", dataAvailable: false, unavailableReason: "Verification: weather intentionally unavailable." }
  ];
}

// Part A: the lively synthetic formula itself. RISK_POLL_MODE defaults to
// "synthetic", so getRiskSignalClients() already returns the real
// SyntheticSignalClient instances -- no scenario override, no DB. Sampling
// across many distinct taskIds at a fixed (current) cycle bucket exercises
// the identical hash-seeded formula that a real wall-clock cycle rollover
// would exercise, without a real-time wait.
async function testLivelySyntheticFormula() {
  assert.equal(env.RISK_POLL_MODE, "synthetic", "This suite assumes the default synthetic poll mode.");
  const clients = getRiskSignalClients();
  const procurementClient = clients.find((client) => client.type === "procurement_status");
  assert.ok(procurementClient, "A procurement_status synthetic client must exist.");

  const samples: Array<{ probability: number | null; delay: number | null; available: boolean }> = [];
  for (let i = 0; i < 200; i += 1) {
    const task: RiskTaskContext = { taskId: `verify-lively-${i}`, taskName: `Synthetic formula sample ${i}`, startAt: new Date(), endAt: new Date(Date.now() + 3_600_000), deadline: null, isCritical: false };
    const observation = await procurementClient!.poll(task);
    samples.push({ probability: observation.probability, delay: observation.estimatedDelayHours, available: observation.dataAvailable });
  }

  const available = samples.filter((sample) => sample.available);
  const unavailable = samples.filter((sample) => !sample.available);
  assert.ok(unavailable.length > 0, "Some samples must report dataAvailable:false (~1 in 8 cycles).");
  assert.ok(available.length > 0, "Some samples must report available data.");
  assert.ok(unavailable.every((sample) => sample.probability === null && sample.delay === null), "An unavailable sample must never carry a probability or delay.");
  assert.ok(available.some((sample) => sample.probability! >= env.RISK_PROBABILITY_THRESHOLD), "At least one sample must cross the probability materiality threshold.");
  assert.ok(available.some((sample) => sample.probability! < env.RISK_PROBABILITY_THRESHOLD), "At least one sample must stay below the probability materiality threshold.");
  assert.ok(available.some((sample) => sample.delay! >= env.RISK_DELAY_HOURS_THRESHOLD), "At least one sample must cross the delay materiality threshold.");
  assert.ok(available.some((sample) => sample.delay! < env.RISK_DELAY_HOURS_THRESHOLD), "At least one sample must stay below the delay materiality threshold.");

  // Determinism within a single cycle bucket: polling the identical task twice
  // must return the identical reading -- a poll firing twice in the same
  // window must never contradict itself.
  const fixedTask: RiskTaskContext = { taskId: "verify-lively-determinism", taskName: "Determinism check", startAt: new Date(), endAt: new Date(Date.now() + 3_600_000), deadline: null, isCritical: false };
  const first = await procurementClient!.poll(fixedTask);
  const second = await procurementClient!.poll(fixedTask);
  assert.deepEqual(first, second, "Two polls of the same task in the same cycle bucket must be identical.");

  // Criticality boosts probability by up to 1.15x (capped at 1), same seed.
  let boostCheckPerformed = false;
  for (let i = 0; i < 50 && !boostCheckPerformed; i += 1) {
    const seedTaskId = `verify-lively-boost-${i}`;
    const nonCritical: RiskTaskContext = { taskId: seedTaskId, taskName: "boost check", startAt: new Date(), endAt: new Date(Date.now() + 3_600_000), deadline: null, isCritical: false };
    const critical: RiskTaskContext = { ...nonCritical, isCritical: true };
    const nonCriticalObs = await procurementClient!.poll(nonCritical);
    const criticalObs = await procurementClient!.poll(critical);
    if (!nonCriticalObs.dataAvailable || nonCriticalObs.probability === null) continue;
    const expected = Math.min(1, nonCriticalObs.probability * 1.15);
    assert.ok(Math.abs(criticalObs.probability! - expected) < 1e-9, "A critical task's probability must be the non-critical probability scaled by 1.15x, capped at 1.");
    boostCheckPerformed = true;
  }
  assert.ok(boostCheckPerformed, "At least one sample must have exercised the criticality boost check.");

  console.log(`Lively synthetic formula verified: ${available.length}/${samples.length} samples available (${unavailable.length} unavailable), spanning both sides of the materiality thresholds, deterministic within a cycle, and boosting critical-task probability by 1.15x.`);
}

// Part B: material risk creation, self-resolution, data-unavailable exclusion,
// and mock-mode mitigation parity, all driven through pollProjectRisks with
// scenario overrides (bypassing SyntheticSignalClient entirely) against an
// isolated task appended to the project's current schedule version.
async function testScenarioDrivenLifecycle() {
  const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, developmentProjectId), orderBy: (table, { desc }) => [desc(table.versionNumber)] });
  assert.ok(latest, "The seeded project must already have a current schedule version.");

  const taskName = `Mitigation verification task ${Date.now()}`;
  const [task] = await db.insert(scheduleTasks).values({ projectId: developmentProjectId, name: taskName, durationHours: 12, vendor: "Verify Vendor Co", reviewState: "accepted" }).returning();
  const [assignment] = await db.insert(scheduleAssignments).values({ versionId: latest!.id, taskId: task.id, startAt: new Date(), endAt: new Date(Date.now() + 12 * 3_600_000), isCritical: true }).returning();

  const riskIds: string[] = [];
  try {
    // 1. data_unavailable never produces a scheduleRisks row.
    const unavailablePoll = await pollProjectRisks({ projectId: developmentProjectId, actorId: SEEDED_ACTOR, scenario: scenario(task.id, 0.1, 0, false) });
    assert.ok(unavailablePoll.pollCycleId);
    let riskRow = await db.query.scheduleRisks.findFirst({ where: and(eq(scheduleRisks.projectId, developmentProjectId), eq(scheduleRisks.taskId, task.id), eq(scheduleRisks.riskType, "weather_forecast")) });
    assert.equal(riskRow, undefined, "A data_unavailable signal must never create a scheduleRisks row.");
    const unavailableSignal = await db.query.riskSignals.findFirst({ where: and(eq(riskSignals.taskId, task.id), eq(riskSignals.signalType, "weather_forecast"), eq(riskSignals.pollCycleId, unavailablePoll.pollCycleId)) });
    assert.equal(unavailableSignal?.status, "data_unavailable");
    assert.equal(unavailableSignal?.dataAvailable, false);

    // 2. Material risk fires (workforce signal above both thresholds) and, in
    //    MODEL_PROVIDER=mock (the default), the mitigation options exactly
    //    equal staticMitigations(type) -- the mechanism that keeps this
    //    reproducible offline.
    assert.equal(env.MODEL_PROVIDER, "mock", "This suite assumes MODEL_PROVIDER=mock (the offline default).");
    const materialPoll = await pollProjectRisks({ projectId: developmentProjectId, actorId: SEEDED_ACTOR, scenario: scenario(task.id, 0.9, 24, false) });
    assert.equal(materialPoll.emittedCount >= 1, true);
    riskRow = await db.query.scheduleRisks.findFirst({ where: and(eq(scheduleRisks.projectId, developmentProjectId), eq(scheduleRisks.taskId, task.id), eq(scheduleRisks.riskType, "workforce_availability")) });
    assert.ok(riskRow, "The above-threshold workforce signal must create a scheduleRisks row.");
    riskIds.push(riskRow!.id);
    assert.equal(riskRow!.status, "active");
    assert.deepEqual(riskRow!.mitigationOptions, staticMitigations("workforce_availability"), "Under MODEL_PROVIDER=mock, mitigation options must exactly equal the static options.");

    // 3. Self-resolution: the same risk stops being material and clears.
    const resolvedPoll = await pollProjectRisks({ projectId: developmentProjectId, actorId: SEEDED_ACTOR, scenario: scenario(task.id, 0.1, 0, false) });
    assert.equal(resolvedPoll.resolvedCount, 1, "The risk must self-resolve once the signal drops below materiality.");
    riskRow = await db.query.scheduleRisks.findFirst({ where: eq(scheduleRisks.id, riskRow!.id) });
    assert.equal(riskRow!.status, "resolved");

    console.log("Scenario-driven lifecycle verified: data_unavailable excluded from risk creation, mock-mode mitigations match static options exactly, and the risk self-resolved once no longer material.");
  } finally {
    await db.delete(alerts).where(inArray(alerts.dedupKey, riskIds.map((id) => `risk:${id}`)));
    if (riskIds.length) await db.delete(scheduleRisks).where(inArray(scheduleRisks.id, riskIds));
    for (const riskId of riskIds) await db.delete(scheduleEvents).where(and(eq(scheduleEvents.projectId, developmentProjectId), like(scheduleEvents.dedupKey, `predicted_risk_delay:${riskId}:%`)));
    // This task lives in developmentProjectId's current schedule version, so
    // the background recurring risk.poll.all job can independently create a
    // scheduleRisks row here too (a different riskType than the one this
    // script tracked in riskIds) -- untracked, but still referencing a
    // risk_signals row for this taskId via its own foreign key. Clear by
    // taskId (a superset of riskIds) before deleting risk_signals.
    const untrackedRisks = await db.select({ id: scheduleRisks.id }).from(scheduleRisks).where(eq(scheduleRisks.taskId, task.id));
    if (untrackedRisks.length) await db.delete(alerts).where(inArray(alerts.dedupKey, untrackedRisks.map((row) => `risk:${row.id}`)));
    await db.delete(scheduleRisks).where(eq(scheduleRisks.taskId, task.id));
    await db.delete(riskSignals).where(eq(riskSignals.taskId, task.id));
    await db.delete(scheduleAssignments).where(eq(scheduleAssignments.id, assignment.id));
    await db.delete(scheduleTasks).where(eq(scheduleTasks.id, task.id));
  }
}

// Part C: a forced generation failure (MODEL_PROVIDER=gemini with no API key
// configured) must fall back to the static options rather than throwing --
// this must never break the poll loop.
async function testGenerationFailureFallback() {
  const original = env.MODEL_PROVIDER;
  // env is parsed once at import time; mutate the live object directly so
  // getGenerationProvider() (which reads env.MODEL_PROVIDER at call time)
  // picks up the forced failure mode for this one check, then restore it.
  (env as { MODEL_PROVIDER: string }).MODEL_PROVIDER = "gemini";
  try {
    const result = await generateMitigations({ type: "equipment_lead_time" as RiskSignalType, taskName: "Forced-failure verification task", vendor: "Verify Vendor Co", probability: 0.9, estimatedDelayHours: 24, isCritical: true, deadlineBreach: true });
    assert.deepEqual(result.options, staticMitigations("equipment_lead_time"), "A generation failure must fall back to the static options.");
    assert.equal(result.model, "static-fallback-v1", "A fallback result must be identifiable as such in the audit trail.");
  } finally {
    (env as { MODEL_PROVIDER: string }).MODEL_PROVIDER = original;
  }
  console.log("Generation-failure fallback verified: a broken provider configuration falls back to static mitigation options instead of throwing.");
}

async function main() {
  await testLivelySyntheticFormula();
  await testScenarioDrivenLifecycle();
  await testGenerationFailureFallback();
  console.log("Predictive-risk mitigation verification passed.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
