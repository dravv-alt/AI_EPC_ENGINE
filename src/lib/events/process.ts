import { clearAlerts, raiseAlert } from "@/lib/alerts/write-alert";
import { db } from "@/lib/db/client";
import { scheduleEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventDedupKey, type ScheduleEvent } from "@/lib/events/contract";
import { enqueueDurableJob } from "@/lib/jobs/queue";

export async function processScheduleEvent(event: ScheduleEvent, actorId: string) {
  const dedupKey = eventDedupKey(event);
  const [stored] = await db.insert(scheduleEvents).values({ projectId: event.projectId, eventId: event.eventId, eventType: event.eventType, dedupKey, occurredAt: new Date(event.occurredAt), payload: event.payload }).onConflictDoNothing().returning();
  if (!stored) return { duplicate: true, dedupKey };

  if (event.eventType === "TEST_FAILED") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `test:${event.payload.testRecordId}:${event.payload.stepId}`, title: "Commissioning test step requires action", payload: event.payload });
  if (event.eventType === "SHIPMENT_DELAYED") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `shipment:${event.payload.shipmentId}`, title: `Shipment is ${event.payload.status}`, payload: event.payload });
  if (event.eventType === "SHIPMENT_RECOVERED") await clearAlerts(event.projectId, `shipment:${event.payload.shipmentId}`);
  if (event.eventType === "predicted_risk_delay") await raiseAlert({ projectId: event.projectId, eventType: event.eventType, dedupKey: `risk:${event.payload.riskId}:${event.payload.materialitySignature}`, title: "Predicted schedule delay requires review", payload: event.payload });

  const queued = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: event.projectId, idempotencyKey: `schedule-event:${event.eventId}`, payload: { scheduleEventId: stored.id, actorId } });
  await db.update(scheduleEvents).set({ processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, stored.id));
  return { duplicate: false, dedupKey, event: stored, jobId: queued.job.id, queuedInRedis: queued.queuedInRedis };
}
