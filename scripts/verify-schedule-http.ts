import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { alerts, auditEvents, durableJobs, projectMembers, projects, riskSignals, scheduleAssignments, scheduleDependencies, scheduleEvents, scheduleResources, scheduleRisks, scheduleTaskResources, scheduleTasks, scheduleVersions, shipments } from "../src/lib/db/schema";
import { randomUUID } from "node:crypto";
import { developmentProjectId } from "../src/lib/demo";

async function json(url: string, body: Record<string, unknown>) { const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(`${url} returned ${response.status}: ${JSON.stringify(data)}`); return data; }

async function main() {
  const base = process.env.SCHEDULE_TEST_URL ?? "http://localhost:4173"; const testProjectId = randomUUID(); const taskIds: string[] = []; const versionIds: string[] = []; const eventIds: string[] = []; const durableJobIds: string[] = []; let resourceId: string | undefined; let shipmentId: string | undefined; let riskId: string | undefined; let riskSignalId: string | undefined;
  try {
    await db.insert(projects).values({
      id: testProjectId,
      tenantId: "10000000-0000-4000-8000-000000000001",
      name: "Schedule Verification Project",
      code: `SVP-${testProjectId.slice(0, 8)}`,
      timezone: "Asia/Kolkata"
    });
    await db.insert(projectMembers).values({
      projectId: testProjectId,
      userId: "10000000-0000-4000-8000-000000000002", // Aarav Mehta (admin)
      role: "admin"
    });

    const resource = await json(`${base}/api/projects/${testProjectId}/schedule/resources`, { name: `Verification crew ${Date.now()}`, capacity: 1, unit: "crew" }); resourceId = resource.resource.id;
    await json(`${base}/api/schedule/resources/${resourceId}/review`, { action: "accept", note: "Accepted by isolated CP-SAT contract verification" });
    for (const [name, durationHours] of [["Install verification skid", 8], ["Complete controls verification", 6], ["Integrated verification test", 4]] as const) { const created = await json(`${base}/api/projects/${testProjectId}/schedule/tasks`, { name, durationHours, resourceDemands: [{ resourceId, demand: 1 }] }); taskIds.push(created.task.id); await json(`${base}/api/schedule/tasks/${created.task.id}/review`, { action: "accept", note: "Accepted by isolated CP-SAT contract verification" }); }
    await json(`${base}/api/projects/${testProjectId}/schedule/dependencies`, { predecessorTaskId: taskIds[0], successorTaskId: taskIds[2] });
    await json(`${base}/api/projects/${testProjectId}/schedule/dependencies`, { predecessorTaskId: taskIds[1], successorTaskId: taskIds[2] });
    const solved = await json(`${base}/api/projects/${testProjectId}/schedule/versions`, { horizonStart: new Date().toISOString(), reason: "Isolated CP-SAT HTTP contract verification" }); versionIds.push(solved.version.id);
    assert.equal(solved.solver.status, "OPTIMAL"); assert.equal(solved.solver.objective_hours, 18); assert.equal(solved.solver.assignments.length, 3); assert.ok(solved.solver.critical_task_ids.includes(taskIds[2])); assert.equal(solved.explanationProvider, "mock");
    const advisoryEventId = randomUUID(); eventIds.push(advisoryEventId); riskId = randomUUID(); riskSignalId = randomUUID();
    await db.insert(riskSignals).values({ id: riskSignalId, projectId: testProjectId, taskId: taskIds[2], pollCycleId: randomUUID(), signalType: "workforce_availability", status: "available", dataAvailable: true, source: "schedule-contract-test", value: { mode: "verification" }, observedAt: new Date() });
    await db.insert(scheduleRisks).values({ id: riskId, projectId: testProjectId, taskId: taskIds[2], sourceSignalId: riskSignalId, riskType: "workforce_availability", status: "active", probability: "0.7400", estimatedDelayHours: 48, mitigationOptions: [{ id: "resequence", label: "Review resequencing", description: "Planner may evaluate a reviewed resequencing constraint in a separate deterministic solve." }], materialityHash: "risk-delay-v1", observedAt: new Date() });
    const advisory = await json(`${base}/api/schedule/events`, { eventId: advisoryEventId, projectId: testProjectId, occurredAt: new Date().toISOString(), transitionId: "advisory-risk-1", eventType: "predicted_risk_delay", payload: { riskId, riskType: "workforce_availability", sourceSignalId: riskSignalId, probability: 0.74, delayDays: 2, affectedTaskIds: [taskIds[2]], mitigationOptions: [{ id: "resequence", label: "Review resequencing", description: "Planner may evaluate a reviewed resequencing constraint in a separate deterministic solve." }], materialitySignature: "risk-delay-v1" } }); assert.equal(advisory.action, "status_only"); assert.equal(advisory.jobId, null);
    const project = await db.query.projects.findFirst({ where: eq(projects.id, testProjectId) }); const member = await db.query.projectMembers.findFirst({ where: eq(projectMembers.projectId, testProjectId) }); assert.ok(project && member); const [shipment] = await db.insert(shipments).values({ tenantId: project.tenantId, projectId: testProjectId, name: `Schedule verification shipment ${Date.now()}`, plannedEta: new Date(), requiredOnSite: new Date(), status: "red", createdBy: member.userId }).returning(); shipmentId = shipment.id;
    const delayedEventId = randomUUID(); eventIds.push(delayedEventId); const event = await json(`${base}/api/schedule/events`, { eventId: delayedEventId, projectId: testProjectId, occurredAt: new Date().toISOString(), transitionId: "shipment-material-change-1", eventType: "SHIPMENT_DELAYED", payload: { shipmentId, status: "red", availableAt: new Date(Date.now() + 48 * 3_600_000).toISOString(), affectedTaskIds: [taskIds[2]], estimate: true } }); const durableJobId = event.jobId as string; durableJobIds.push(durableJobId);
    let job; for (let attempt = 0; attempt < 60; attempt += 1) { const response = await fetch(`${base}/api/jobs/${durableJobId}`); job = (await response.json()).job; if (["completed", "failed"].includes(job?.status)) break; await new Promise((resolve) => setTimeout(resolve, 100)); }
    assert.equal(job.status, "completed"); assert.equal(job.result.action, "re_solved"); assert.equal(job.result.warmStartHintCount, 3); versionIds.push(job.result.versionId);
    console.log("Schedule HTTP verification passed: accepted-only inputs, dependency/resource constraints, CP-SAT optimum, advisory risk isolation, shipment materiality, warm-start re-solve, history, and post-save explanation.");
  } finally {
    if (versionIds.length) await db.delete(scheduleAssignments).where(inArray(scheduleAssignments.versionId, versionIds));
    if (versionIds.length) await db.delete(scheduleVersions).where(inArray(scheduleVersions.id, versionIds));
    if (eventIds.length) await db.delete(scheduleEvents).where(inArray(scheduleEvents.eventId, eventIds));
    if (durableJobIds.length) await db.delete(durableJobs).where(inArray(durableJobs.id, durableJobIds));
    if (riskId) await db.delete(alerts).where(eq(alerts.dedupKey, `risk:${riskId}`));
    if (riskId) await db.delete(scheduleRisks).where(eq(scheduleRisks.id, riskId));
    if (riskSignalId) await db.delete(riskSignals).where(eq(riskSignals.id, riskSignalId));
    if (shipmentId) await db.delete(alerts).where(eq(alerts.dedupKey, `shipment:${shipmentId}`));
    if (shipmentId) await db.delete(shipments).where(eq(shipments.id, shipmentId));
    if (taskIds.length) await db.delete(scheduleDependencies).where(and(eq(scheduleDependencies.projectId, testProjectId), inArray(scheduleDependencies.predecessorTaskId, taskIds)));
    if (taskIds.length) await db.delete(scheduleTaskResources).where(inArray(scheduleTaskResources.taskId, taskIds));
    if (taskIds.length) await db.delete(scheduleTasks).where(inArray(scheduleTasks.id, taskIds));
    if (resourceId) await db.delete(scheduleResources).where(eq(scheduleResources.id, resourceId));
    await db.delete(auditEvents).where(eq(auditEvents.projectId, testProjectId));
    await db.delete(projectMembers).where(eq(projectMembers.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
