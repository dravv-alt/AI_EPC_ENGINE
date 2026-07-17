import { z } from "zod";

const base = z.object({
  eventId: z.string().min(8).max(200),
  projectId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  transitionId: z.string().min(1).max(160)
});

export const scheduleEventSchema = z.discriminatedUnion("eventType", [
  base.extend({ eventType: z.literal("TEST_FAILED"), payload: z.object({ testRecordId: z.string().uuid(), stepId: z.string().uuid(), findingId: z.string().uuid(), gateId: z.string().uuid() }) }),
  base.extend({ eventType: z.literal("SHIPMENT_DELAYED"), payload: z.object({ shipmentId: z.string().uuid(), status: z.enum(["amber", "red"]), affectedTaskIds: z.array(z.string().uuid()).default([]), estimate: z.literal(true) }) }),
  base.extend({ eventType: z.literal("SHIPMENT_RECOVERED"), payload: z.object({ shipmentId: z.string().uuid(), affectedTaskIds: z.array(z.string().uuid()).default([]), estimate: z.literal(true) }) }),
  base.extend({ eventType: z.literal("predicted_risk_delay"), payload: z.object({ riskId: z.string().uuid(), probability: z.number().min(0).max(1), delayDays: z.number().nonnegative(), affectedTaskIds: z.array(z.string().uuid()).min(1), materialitySignature: z.string().min(8).max(200) }) })
]);

export type ScheduleEvent = z.infer<typeof scheduleEventSchema>;

export function eventDedupKey(event: ScheduleEvent) {
  const sourceId = event.eventType === "TEST_FAILED" ? event.payload.testRecordId : event.eventType === "predicted_risk_delay" ? event.payload.riskId : event.payload.shipmentId;
  return `${event.eventType}:${sourceId}:${event.transitionId}`;
}
