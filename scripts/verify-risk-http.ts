import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { alerts, durableJobs, riskSignals, scheduleAssignments, scheduleDependencies, scheduleEvents, scheduleResources, scheduleRisks, scheduleTaskResources, scheduleTasks, scheduleVersions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import type { RiskSignalType } from "../src/lib/predictive-risk/clients";

type Scenario = { taskId: string; signalType: RiskSignalType; dataAvailable: boolean; probability?: number; estimatedDelayHours?: number; unavailableReason?: string; value?: Record<string, unknown> };

async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function post(base: string, path: string, body: unknown) {
  return request(base, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function pollJob(base: string, jobId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await request(base, `/api/jobs/${jobId}`);
    if (result.job.status === "completed") return result.job;
    if (result.job.status === "failed") throw new Error(`Risk job ${jobId} failed: ${result.job.error}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Risk job ${jobId} timed out.`);
}

function scenario(taskId: string, workforceProbability: number, workforceDelayHours: number): Scenario[] {
  return [
    { taskId, signalType: "procurement_status", dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { state: "on_track" } },
    { taskId, signalType: "equipment_lead_time", dataAvailable: true, probability: 0.1, estimatedDelayHours: 0, value: { state: "available" } },
    { taskId, signalType: "workforce_availability", dataAvailable: true, probability: workforceProbability, estimatedDelayHours: workforceDelayHours, value: { availableCrew: 0 } },
    { taskId, signalType: "weather_forecast", dataAvailable: false, unavailableReason: "Synthetic weather endpoint intentionally unavailable." }
  ];
}

async function main() {
  const base = process.env.RISK_TEST_URL ?? "http://localhost:4173";
  const taskIds: string[] = [];
  const versionIds: string[] = [];
  const jobIds: string[] = [];
  const pollCycleIds: string[] = [];
  const riskIds: string[] = [];
  let resourceId: string | undefined;
  try {
    const resource = await post(base, `/api/projects/${developmentProjectId}/schedule/resources`, { name: `Risk verification crew ${Date.now()}`, capacity: 1, unit: "crew" });
    resourceId = resource.resource.id;
    await post(base, `/api/schedule/resources/${resourceId}/review`, { action: "accept", note: "Accepted for predictive-risk contract verification." });
    const created = await post(base, `/api/projects/${developmentProjectId}/schedule/tasks`, { name: `Deadline risk verification task ${Date.now()}`, durationHours: 12, deadline: new Date(Date.now() + 16 * 3_600_000).toISOString(), deadlineType: "soft", resourceDemands: [{ resourceId, demand: 1 }] });
    const taskId = created.task.id as string;
    taskIds.push(taskId);
    await post(base, `/api/schedule/tasks/${taskId}/review`, { action: "accept", note: "Accepted for predictive-risk contract verification." });
    const baseline = await post(base, `/api/projects/${developmentProjectId}/schedule/versions`, { horizonStart: new Date().toISOString(), reason: "Predictive-risk isolated baseline" });
    versionIds.push(baseline.version.id);
    assert.equal(baseline.solver.status, "OPTIMAL");
    assert.ok(baseline.solver.assignments.some((assignment: { task_id: string }) => assignment.task_id === taskId));
    const baselineVersionCount = await db.$count(scheduleVersions, eq(scheduleVersions.projectId, developmentProjectId));

    const first = await post(base, `/api/projects/${developmentProjectId}/schedule/risks`, { idempotencyKey: `risk-first-${randomUUID()}`, scenario: scenario(taskId, 0.8, 24) });
    jobIds.push(first.pollJobId);
    const firstJob = await pollJob(base, first.pollJobId);
    pollCycleIds.push(firstJob.result.pollCycleId);
    assert.equal(firstJob.result.emittedCount, 1);
    assert.equal(firstJob.result.unavailableCount, 1);
    const live = await request(base, `/api/projects/${developmentProjectId}/schedule/live-events?taskId=${taskId}`);
    const firstCycle = live.items.filter((item: { signal: { pollCycleId: string } }) => item.signal.pollCycleId === firstJob.result.pollCycleId);
    assert.equal(firstCycle.length, 4);
    assert.ok(firstCycle.some((item: { signal: { signalType: string; status: string; dataAvailable: boolean; unavailableReason: string | null } }) => item.signal.signalType === "weather_forecast" && item.signal.status === "data_unavailable" && item.signal.dataAvailable === false && item.signal.unavailableReason));
    let risks = await request(base, `/api/projects/${developmentProjectId}/schedule/risks?taskId=${taskId}`);
    assert.equal(risks.items.length, 1);
    let risk = risks.items[0].risk;
    riskIds.push(risk.id);
    assert.equal(risk.status, "active");
    assert.equal(risk.reviewState, "proposed");
    assert.ok(risk.mitigationOptions.length >= 2);
    assert.equal(risks.items[0].eventProcessingStatus, "status_only");
    let commandCenter = await request(base, `/api/projects/${developmentProjectId}/alerts`);
    assert.ok(commandCenter.items.some((item: { dedupKey: string; status: string }) => item.dedupKey === `risk:${risk.id}` && item.status === "active"));
    assert.equal(await db.$count(scheduleVersions, eq(scheduleVersions.projectId, developmentProjectId)), baselineVersionCount, "Predictive risk must not create a schedule version.");

    const unchanged = await post(base, `/api/projects/${developmentProjectId}/schedule/risks`, { idempotencyKey: `risk-unchanged-${randomUUID()}`, scenario: scenario(taskId, 0.8, 24) });
    jobIds.push(unchanged.pollJobId);
    const unchangedJob = await pollJob(base, unchanged.pollJobId);
    pollCycleIds.push(unchangedJob.result.pollCycleId);
    assert.equal(unchangedJob.result.emittedCount, 0);
    assert.equal(unchangedJob.result.unchangedCount, 1);
    assert.equal(await db.$count(scheduleEvents, and(eq(scheduleEvents.projectId, developmentProjectId), eq(scheduleEvents.eventType, "predicted_risk_delay"), eq(scheduleEvents.dedupKey, `predicted_risk_delay:${risk.id}:${risk.materialityHash.slice(0, 32)}`))), 1);

    const resolved = await post(base, `/api/projects/${developmentProjectId}/schedule/risks`, { idempotencyKey: `risk-resolved-${randomUUID()}`, scenario: scenario(taskId, 0.1, 0) });
    jobIds.push(resolved.pollJobId);
    const resolvedJob = await pollJob(base, resolved.pollJobId);
    pollCycleIds.push(resolvedJob.result.pollCycleId);
    assert.equal(resolvedJob.result.resolvedCount, 1);
    risks = await request(base, `/api/projects/${developmentProjectId}/schedule/risks?taskId=${taskId}`);
    assert.equal(risks.items[0].risk.status, "resolved");
    commandCenter = await request(base, `/api/projects/${developmentProjectId}/alerts`);
    assert.ok(commandCenter.items.some((item: { dedupKey: string; status: string }) => item.dedupKey === `risk:${risk.id}` && item.status === "cleared"));

    const changed = await post(base, `/api/projects/${developmentProjectId}/schedule/risks`, { idempotencyKey: `risk-changed-${randomUUID()}`, scenario: scenario(taskId, 0.9, 48) });
    jobIds.push(changed.pollJobId);
    const changedJob = await pollJob(base, changed.pollJobId);
    pollCycleIds.push(changedJob.result.pollCycleId);
    assert.equal(changedJob.result.emittedCount, 1);
    risks = await request(base, `/api/projects/${developmentProjectId}/schedule/risks?taskId=${taskId}`);
    risk = risks.items[0].risk;
    const reviewed = await request(base, `/api/schedule/risks/${risk.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "acknowledge", expectedVersion: risk.version, note: "Planner acknowledges the advisory signal; no mitigation or schedule date is applied." }) });
    assert.equal(reviewed.risk.reviewState, "accepted");
    assert.equal(reviewed.risk.mitigationDisposition, "acknowledged_only");
    assert.match(reviewed.authority, /No mitigation or schedule date was applied/);
    assert.equal(await db.$count(scheduleVersions, eq(scheduleVersions.projectId, developmentProjectId)), baselineVersionCount);
    console.log("Predictive-risk HTTP verification passed: four-source polling, explicit unavailable state, deterministic materiality, task/type deduplication, self-resolution, advisory events/alerts, human acknowledgement, and solver isolation.");
  } finally {
    if (riskIds.length) await db.delete(alerts).where(inArray(alerts.dedupKey, riskIds.map((id) => `risk:${id}`)));
    if (riskIds.length) await db.delete(scheduleRisks).where(inArray(scheduleRisks.id, riskIds));
    for (const riskId of riskIds) await db.delete(scheduleEvents).where(and(eq(scheduleEvents.projectId, developmentProjectId), like(scheduleEvents.dedupKey, `predicted_risk_delay:${riskId}:%`)));
    if (pollCycleIds.length) await db.delete(riskSignals).where(inArray(riskSignals.pollCycleId, pollCycleIds));
    if (jobIds.length) await db.delete(durableJobs).where(inArray(durableJobs.id, jobIds));
    if (versionIds.length) await db.delete(scheduleAssignments).where(inArray(scheduleAssignments.versionId, versionIds));
    if (versionIds.length) await db.delete(scheduleVersions).where(inArray(scheduleVersions.id, versionIds));
    if (taskIds.length) await db.delete(scheduleDependencies).where(and(eq(scheduleDependencies.projectId, developmentProjectId), inArray(scheduleDependencies.predecessorTaskId, taskIds)));
    if (taskIds.length) await db.delete(scheduleTaskResources).where(inArray(scheduleTaskResources.taskId, taskIds));
    if (taskIds.length) await db.delete(scheduleTasks).where(inArray(scheduleTasks.id, taskIds));
    if (resourceId) await db.delete(scheduleResources).where(eq(scheduleResources.id, resourceId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
