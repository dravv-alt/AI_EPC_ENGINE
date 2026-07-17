import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { alerts, durableJobs, scheduleAssignments, scheduleDependencies, scheduleEvents, scheduleResources, scheduleTaskResources, scheduleTasks, scheduleVersions } from "../src/lib/db/schema";
import { randomUUID } from "node:crypto";
import { developmentProjectId } from "../src/lib/demo";

async function json(url: string, body: Record<string, unknown>) { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(`${url} returned ${response.status}: ${JSON.stringify(data)}`); return data; }

async function main() {
  const base = process.env.SCHEDULE_TEST_URL ?? "http://localhost:4173"; const taskIds: string[] = []; const versionIds: string[] = []; let resourceId: string | undefined; let eventId: string | undefined; let durableJobId: string | undefined; let riskId: string | undefined;
  try {
    const resource = await json(`${base}/api/projects/${developmentProjectId}/schedule/resources`, { name: `Verification crew ${Date.now()}`, capacity: 1, unit: "crew" }); resourceId = resource.resource.id;
    for (const [name, durationHours] of [["Install verification skid", 8], ["Complete controls verification", 6], ["Integrated verification test", 4]] as const) { const created = await json(`${base}/api/projects/${developmentProjectId}/schedule/tasks`, { name, durationHours, resourceDemands: [{ resourceId, demand: 1 }] }); taskIds.push(created.task.id); await json(`${base}/api/schedule/tasks/${created.task.id}/review`, { decision: "accept", note: "Accepted by isolated CP-SAT contract verification" }); }
    await json(`${base}/api/projects/${developmentProjectId}/schedule/dependencies`, { predecessorTaskId: taskIds[0], successorTaskId: taskIds[2] });
    await json(`${base}/api/projects/${developmentProjectId}/schedule/dependencies`, { predecessorTaskId: taskIds[1], successorTaskId: taskIds[2] });
    const solved = await json(`${base}/api/projects/${developmentProjectId}/schedule/versions`, { horizonStart: new Date().toISOString(), reason: "Isolated CP-SAT HTTP contract verification" }); versionIds.push(solved.version.id);
    assert.equal(solved.solver.status, "OPTIMAL"); assert.equal(solved.solver.objective_hours, 18); assert.equal(solved.solver.assignments.length, 3); assert.ok(solved.solver.critical_task_ids.includes(taskIds[2])); assert.equal(solved.explanationProvider, "mock");
    eventId = randomUUID(); riskId = randomUUID(); const event = await json(`${base}/api/schedule/events`, { eventId, projectId: developmentProjectId, occurredAt: new Date().toISOString(), transitionId: "material-change-1", eventType: "predicted_risk_delay", payload: { riskId, probability: 0.74, delayDays: 2, affectedTaskIds: [taskIds[2]], materialitySignature: "risk-delay-v1" } }); durableJobId = event.jobId;
    let job; for (let attempt = 0; attempt < 60; attempt += 1) { const response = await fetch(`${base}/api/jobs/${durableJobId}`); job = (await response.json()).job; if (["completed", "failed"].includes(job?.status)) break; await new Promise((resolve) => setTimeout(resolve, 100)); }
    assert.equal(job.status, "completed"); assert.equal(job.result.action, "re_solved"); assert.equal(job.result.warmStartHintCount, 3); versionIds.push(job.result.versionId);
    console.log("Schedule HTTP verification passed: accepted-only inputs, dependency/resource constraints, CP-SAT optimum, immutable baseline, event delta, warm-start re-solve, history, and post-save explanation.");
  } finally {
    if (versionIds.length) await db.delete(scheduleAssignments).where(inArray(scheduleAssignments.versionId, versionIds));
    if (versionIds.length) await db.delete(scheduleVersions).where(inArray(scheduleVersions.id, versionIds));
    if (eventId) await db.delete(scheduleEvents).where(eq(scheduleEvents.eventId, eventId));
    if (durableJobId) await db.delete(durableJobs).where(eq(durableJobs.id, durableJobId));
    if (riskId) await db.delete(alerts).where(eq(alerts.dedupKey, `risk:${riskId}:risk-delay-v1`));
    if (taskIds.length) await db.delete(scheduleDependencies).where(and(eq(scheduleDependencies.projectId, developmentProjectId), inArray(scheduleDependencies.predecessorTaskId, taskIds)));
    if (taskIds.length) await db.delete(scheduleTaskResources).where(inArray(scheduleTaskResources.taskId, taskIds));
    if (taskIds.length) await db.delete(scheduleTasks).where(inArray(scheduleTasks.id, taskIds));
    if (resourceId) await db.delete(scheduleResources).where(eq(scheduleResources.id, resourceId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
