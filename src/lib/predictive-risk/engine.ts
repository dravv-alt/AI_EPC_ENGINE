import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { clearAlerts } from "@/lib/alerts/write-alert";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { riskSignals, scheduleAssignments, scheduleRisks, scheduleTasks, scheduleVersions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { processScheduleEvent } from "@/lib/events/process";
import { getRiskSignalClients, type RiskSignalType, type SignalObservation } from "@/lib/predictive-risk/clients";

export interface RiskScenarioOverride {
  taskId: string;
  signalType: RiskSignalType;
  dataAvailable: boolean;
  probability?: number;
  estimatedDelayHours?: number;
  unavailableReason?: string;
  value?: Record<string, unknown>;
}

interface MitigationOption { id: string; label: string; description: string }

function mitigations(type: RiskSignalType): MitigationOption[] {
  const options: Record<RiskSignalType, MitigationOption[]> = {
    procurement_status: [
      { id: "expedite-vendor", label: "Review vendor expediting", description: "A planner may confirm expediting feasibility and then model the accepted constraint separately." },
      { id: "alternate-source", label: "Evaluate an alternate source", description: "Procurement may assess an approved alternative supplier without the risk engine selecting one." }
    ],
    equipment_lead_time: [
      { id: "split-delivery", label: "Evaluate split delivery", description: "The delivery owner may assess whether a controlled partial shipment protects the critical task." },
      { id: "resequence", label: "Review task resequencing", description: "A scheduler may model a reviewed precedence change through a separate deterministic solve." }
    ],
    workforce_availability: [
      { id: "reallocate-crew", label: "Review crew reallocation", description: "The planner may assess moving an available crew and explicitly update reviewed resource constraints." },
      { id: "approved-subcontract", label: "Evaluate approved subcontract support", description: "The project team may assess qualified support; this proposal does not appoint or schedule anyone." }
    ],
    weather_forecast: [
      { id: "weather-window", label: "Review a protected weather window", description: "The planner may set a reviewed work window before invoking the deterministic solver." },
      { id: "indoor-resequence", label: "Evaluate indoor work resequencing", description: "The scheduler may assess moving unaffected indoor tasks without this engine changing dates." }
    ]
  };
  return options[type];
}

function materialityHash(input: { versionId: string; taskId: string; signalType: string; probability: number; estimatedDelayHours: number }) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function scenarioObservation(override: RiskScenarioOverride): SignalObservation {
  if (!override.dataAvailable) return { dataAvailable: false, source: `scenario:${override.signalType}`, probability: null, estimatedDelayHours: null, value: override.value ?? null, unavailableReason: override.unavailableReason ?? "Scenario marks this signal unavailable." };
  return { dataAvailable: true, source: `scenario:${override.signalType}`, probability: override.probability ?? 0, estimatedDelayHours: override.estimatedDelayHours ?? 0, value: override.value ?? { mode: "verification-scenario" }, unavailableReason: null };
}

export async function pollProjectRisks(input: { projectId: string; actorId: string; scenario?: RiskScenarioOverride[] }) {
  const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, input.projectId), orderBy: [desc(scheduleVersions.versionNumber)] });
  if (!latest) {
    console.warn(`[predictive-risk] No schedule version for project ${input.projectId}. Skipping poll.`);
    return { pollCycleId: randomUUID(), scheduleVersionId: null, taskCount: 0, availableCount: 0, unavailableCount: 0, emittedCount: 0, unchangedCount: 0, resolvedCount: 0, thresholds: { probability: env.RISK_PROBABILITY_THRESHOLD, delayHours: env.RISK_DELAY_HOURS_THRESHOLD } };
  }
  const assignments = await db.select({ taskId: scheduleTasks.id, taskName: scheduleTasks.name, deadline: scheduleTasks.deadline, startAt: scheduleAssignments.startAt, endAt: scheduleAssignments.endAt, isCritical: scheduleAssignments.isCritical }).from(scheduleAssignments).innerJoin(scheduleTasks, eq(scheduleAssignments.taskId, scheduleTasks.id)).where(and(eq(scheduleAssignments.versionId, latest.id), eq(scheduleTasks.projectId, input.projectId), eq(scheduleTasks.reviewState, "accepted")));
  if (!assignments.length) {
    console.warn(`[predictive-risk] No accepted assignments for project ${input.projectId}. Skipping poll.`);
    return { pollCycleId: randomUUID(), scheduleVersionId: latest.id, taskCount: 0, availableCount: 0, unavailableCount: 0, emittedCount: 0, unchangedCount: 0, resolvedCount: 0, thresholds: { probability: env.RISK_PROBABILITY_THRESHOLD, delayHours: env.RISK_DELAY_HOURS_THRESHOLD } };
  }
  const pollCycleId = randomUUID(); const observedAt = new Date(); const clients = getRiskSignalClients();
  let availableCount = 0; let unavailableCount = 0; let emittedCount = 0; let unchangedCount = 0; let resolvedCount = 0;

  for (const task of assignments) {
    for (const client of clients) {
      const override = input.scenario?.find((item) => item.taskId === task.taskId && item.signalType === client.type);
      const observation = override ? scenarioObservation(override) : await client.poll({ ...task });
      const [signal] = await db.insert(riskSignals).values({ projectId: input.projectId, taskId: task.taskId, pollCycleId, signalType: client.type, status: observation.dataAvailable ? "available" : "data_unavailable", dataAvailable: observation.dataAvailable, source: observation.source, value: observation.value, unavailableReason: observation.unavailableReason, observedAt }).returning();
      if (!observation.dataAvailable || observation.probability === null || observation.estimatedDelayHours === null) { unavailableCount += 1; continue; }
      availableCount += 1;
      const probability = observation.probability; const delayHours = observation.estimatedDelayHours;
      const deadlineBreach = Boolean(task.deadline && new Date(task.endAt.getTime() + delayHours * 3_600_000) > task.deadline);
      const material = probability >= env.RISK_PROBABILITY_THRESHOLD && delayHours >= env.RISK_DELAY_HOURS_THRESHOLD && (task.isCritical || deadlineBreach);
      const existing = await db.query.scheduleRisks.findFirst({ where: and(eq(scheduleRisks.projectId, input.projectId), eq(scheduleRisks.taskId, task.taskId), eq(scheduleRisks.riskType, client.type)) });
      if (!material) {
        if (existing?.status === "active") {
          const [resolved] = await db.update(scheduleRisks).set({ status: "resolved", sourceSignalId: signal.id, probability: String(probability), estimatedDelayHours: delayHours, observedAt, clearedAt: observedAt, version: existing.version + 1, updatedAt: observedAt }).where(eq(scheduleRisks.id, existing.id)).returning();
          await clearAlerts(input.projectId, `risk:${existing.id}`); resolvedCount += 1;
          await writeAuditEvent({ projectId: input.projectId, actorId: input.actorId, action: "schedule.risk.resolved", entityType: "schedule_risk", entityId: existing.id, before: existing, after: resolved });
        }
        continue;
      }
      const hash = materialityHash({ versionId: latest.id, taskId: task.taskId, signalType: client.type, probability, estimatedDelayHours: delayHours });
      if (existing?.status === "active" && existing.materialityHash === hash) {
        await db.update(scheduleRisks).set({ sourceSignalId: signal.id, observedAt, updatedAt: observedAt }).where(eq(scheduleRisks.id, existing.id)); unchangedCount += 1; continue;
      }
      const options = mitigations(client.type);
      const [risk] = existing
        ? await db.update(scheduleRisks).set({ sourceSignalId: signal.id, status: "active", probability: String(probability), estimatedDelayHours: delayHours, mitigationOptions: options, materialityHash: hash, scheduleEventId: null, reviewState: "proposed", reviewedBy: null, reviewedAt: null, reviewNote: null, mitigationDisposition: "unreviewed", observedAt, clearedAt: null, version: existing.version + 1, updatedAt: observedAt }).where(eq(scheduleRisks.id, existing.id)).returning()
        : await db.insert(scheduleRisks).values({ projectId: input.projectId, taskId: task.taskId, sourceSignalId: signal.id, riskType: client.type, status: "active", probability: String(probability), estimatedDelayHours: delayHours, mitigationOptions: options, materialityHash: hash, observedAt }).returning();
      const eventResult = await processScheduleEvent({ eventId: randomUUID(), projectId: input.projectId, occurredAt: observedAt.toISOString(), transitionId: hash.slice(0, 32), eventType: "predicted_risk_delay", payload: { riskId: risk.id, riskType: client.type, sourceSignalId: signal.id, probability, delayDays: delayHours / 24, affectedTaskIds: [task.taskId], mitigationOptions: options, materialitySignature: hash } }, input.actorId);
      const scheduleEventId = "event" in eventResult ? eventResult.event?.id ?? null : null;
      await db.update(scheduleRisks).set({ scheduleEventId, updatedAt: new Date() }).where(eq(scheduleRisks.id, risk.id)); emittedCount += 1;
      await writeAuditEvent({ projectId: input.projectId, actorId: input.actorId, action: "schedule.risk.material_change_emitted", entityType: "schedule_risk", entityId: risk.id, before: existing, after: { risk, scheduleEventId, advisory: true, solverInvoked: false } });
    }
  }
  const summary = { pollCycleId, scheduleVersionId: latest.id, taskCount: assignments.length, availableCount, unavailableCount, emittedCount, unchangedCount, resolvedCount, thresholds: { probability: env.RISK_PROBABILITY_THRESHOLD, delayHours: env.RISK_DELAY_HOURS_THRESHOLD } };
  await writeAuditEvent({ projectId: input.projectId, actorId: input.actorId, action: "schedule.risk.poll_completed", entityType: "project", entityId: input.projectId, after: summary });
  return summary;
}
