import { and, desc, eq, inArray } from "drizzle-orm";
import { clearAlerts, raiseAlert } from "@/lib/alerts/write-alert";
import { db } from "@/lib/db/client";
import { riskSignals, scheduleAssignments, scheduleEvents, scheduleRisks, scheduleVersions } from "@/lib/db/schema";
import { eventDedupKey, type ScheduleEvent } from "@/lib/events/contract";
import { enqueueDurableJob } from "@/lib/jobs/queue";

async function assertCurrentTaskScope(event: ScheduleEvent) {
  if (!("affectedTaskIds" in event.payload) || !event.payload.affectedTaskIds.length) return;
  const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, event.projectId), orderBy: [desc(scheduleVersions.versionNumber)] });
  if (!latest) throw new Error("A schedule baseline is required before task-linked events can be accepted.");
  const current = await db.select({ taskId: scheduleAssignments.taskId }).from(scheduleAssignments).where(and(eq(scheduleAssignments.versionId, latest.id), inArray(scheduleAssignments.taskId, event.payload.affectedTaskIds)));
  if (current.length !== new Set(event.payload.affectedTaskIds).size) throw new Error("Every affected task must exist in the current immutable schedule version.");
}

async function assertPredictedRiskScope(event: ScheduleEvent) {
  if (event.eventType !== "predicted_risk_delay") return;
  const [linked] = await db.select({ riskId: scheduleRisks.id })
    .from(scheduleRisks)
    .innerJoin(riskSignals, eq(scheduleRisks.sourceSignalId, riskSignals.id))
    .where(and(
      eq(scheduleRisks.id, event.payload.riskId),
      eq(scheduleRisks.projectId, event.projectId),
      eq(scheduleRisks.riskType, event.payload.riskType),
      eq(scheduleRisks.sourceSignalId, event.payload.sourceSignalId),
      eq(riskSignals.projectId, event.projectId),
      eq(riskSignals.taskId, scheduleRisks.taskId),
      inArray(scheduleRisks.taskId, event.payload.affectedTaskIds)
    ));
  if (!linked) throw new Error("The predicted-risk event must reference its project-scoped risk, source signal, and affected task.");
}

export async function processScheduleEvent(event: ScheduleEvent, actorId: string) {
  await assertCurrentTaskScope(event);
  await assertPredictedRiskScope(event);
  const dedupKey = eventDedupKey(event);
  const [inserted] = await db.insert(scheduleEvents).values({ projectId: event.projectId, eventId: event.eventId, eventType: event.eventType, dedupKey, occurredAt: new Date(event.occurredAt), payload: event.payload, processingStatus: "queued" }).onConflictDoNothing().returning();
  let stored = inserted;
  if (!stored) {
    // A conflict on the dedup key is normally an inert duplicate. The one
    // exception is a row a prior solve attempt left as SOLVE_FAILED: that
    // status exists specifically so the same event can be resubmitted for a
    // manual retry (Rules.md line 33/88) instead of being silently absorbed
    // as a no-op, which would strand the event unprocessed forever.
    const existing = await db.query.scheduleEvents.findFirst({ where: and(eq(scheduleEvents.projectId, event.projectId), eq(scheduleEvents.dedupKey, dedupKey)) });
    if (existing?.processingStatus !== "SOLVE_FAILED") return { duplicate: true, dedupKey };
    const [retried] = await db.update(scheduleEvents).set({ processingStatus: "queued", processingError: null, processedAt: null, durableJobId: null, resultVersionId: null, updatedAt: new Date() }).where(eq(scheduleEvents.id, existing.id)).returning();
    stored = retried;
  }

  if (event.eventType === "TEST_FAILED") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `test:${event.payload.testRecordId}:${event.payload.stepId}`, title: "Commissioning test step requires action", payload: event.payload });
  if (event.eventType === "SHIPMENT_DELAYED") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `shipment:${event.payload.shipmentId}`, title: `Shipment is ${event.payload.status}`, payload: event.payload });
  if (event.eventType === "SHIPMENT_RECOVERED") await clearAlerts(event.projectId, `shipment:${event.payload.shipmentId}`);
  if (event.eventType === "predicted_risk_delay") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `risk:${event.payload.riskId}`, title: "Predicted schedule delay requires review", payload: event.payload });

  // Commissioning failure enters the evidence graph. Predictive risk remains
  // advisory. Neither is allowed to mutate deterministic schedule dates.
  if (event.eventType === "TEST_FAILED" || event.eventType === "predicted_risk_delay" || !event.payload.affectedTaskIds.length) {
    await db.update(scheduleEvents).set({ processingStatus: "status_only", processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, stored.id));
    return { duplicate: false, dedupKey, event: stored, action: "status_only", jobId: null, queuedInRedis: false };
  }
  const queued = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: event.projectId, idempotencyKey: `schedule-event:${event.eventId}`, payload: { scheduleEventId: stored.id, actorId } });
  await db.update(scheduleEvents).set({ durableJobId: queued.job.id, processingStatus: "queued", updatedAt: new Date() }).where(eq(scheduleEvents.id, stored.id));
  return { duplicate: false, dedupKey, event: stored, action: "queued", jobId: queued.job.id, queuedInRedis: queued.queuedInRedis };
}
