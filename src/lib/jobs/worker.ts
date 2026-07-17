import { Worker, type Job } from "bullmq";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { documentVersions, durableJobs, scheduleAssignments, scheduleEvents, scheduleTasks, scheduleVersions, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis/client";
import { objectStorage } from "@/lib/storage/service";
import { createScheduleVersion } from "@/lib/schedule/create-version";
import { proposeDocumentRecords } from "@/lib/ingestion/proposals";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { generateChecklistDraft, generateCxReport } from "@/lib/cx/generation";
import { pollProjectRisks, type RiskScenarioOverride } from "@/lib/predictive-risk/engine";

export async function extractDocument(input: { documentVersionId: string; objectKey: string }) {
  const { documentVersionId, objectKey } = input;
  const existing = await db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, documentVersionId));
  if (existing.length) {
    await db.update(documentVersions).set({ extractionStatus: "completed", extractionError: null, updatedAt: new Date() }).where(eq(documentVersions.id, documentVersionId));
    return { regionCount: existing.length, idempotent: true };
  }
  const bytes = await objectStorage.read(objectKey);
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "application/pdf" }), "controlled-source.pdf");
  const response = await fetch(`${env.INGESTION_SERVICE_URL}/parse-upload`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Ingestion service returned ${response.status}.`);
  const parsed = await response.json() as { chunks: Array<{ page_number: number; text: string; bbox?: unknown; content_hash?: string }> };
  await db.transaction(async (tx) => {
    if (parsed.chunks.length) await tx.insert(sourceRegions).values(parsed.chunks.map((chunk) => ({ documentVersionId, pageNumber: String(chunk.page_number), bbox: chunk.bbox ?? null, extractedText: chunk.text, contentHash: chunk.content_hash ?? createHash("sha256").update(chunk.text).digest("hex") })));
    await tx.update(documentVersions).set({ extractionStatus: "completed", extractionError: null, updatedAt: new Date() }).where(eq(documentVersions.id, documentVersionId));
  });
  return { regionCount: parsed.chunks.length };
}

const handlers: Record<string, (job: Job) => Promise<unknown>> = {
  "document.extract": async (job) => {
    const data = job.data as { documentVersionId: string; objectKey: string; actorId?: string; tenantId?: string; projectId?: string };
    const extraction = await extractDocument(data);
    if (data.actorId && data.projectId) {
      const proposal = await enqueueDurableJob({ queue: "core", name: "document.propose", tenantId: data.tenantId, projectId: data.projectId, idempotencyKey: `document-propose:${data.documentVersionId}`, payload: { documentVersionId: data.documentVersionId, actorId: data.actorId } });
      return { ...extraction, proposalJobId: proposal.job.id };
    }
    return extraction;
  },
  "document.propose": (job) => {
    const data = job.data as { documentVersionId: string; actorId: string };
    return proposeDocumentRecords(data.documentVersionId, data.actorId);
  },
  "cx.checklist.generate": (job) => {
    const data = job.data as { checklistId: string; actorId: string };
    return generateChecklistDraft(data.checklistId, data.actorId);
  },
  "cx.report.generate": (job) => {
    const data = job.data as { testRecordId: string; actorId: string };
    return generateCxReport(data.testRecordId, data.actorId);
  },
  "risk.poll": (job) => {
    const data = job.data as { projectId: string; actorId: string; scenario?: RiskScenarioOverride[] };
    return pollProjectRisks(data);
  },
  "schedule.baseline": async (job) => {
    const data = job.data as { projectId: string; actorId: string; horizonStart: string; reason: string };
    const result = await createScheduleVersion({ projectId: data.projectId, actorId: data.actorId, horizonStart: new Date(data.horizonStart), reason: data.reason });
    return { action: "baseline_saved", versionId: result.version.id, versionNumber: result.version.versionNumber, solverStatus: result.solver.status, overrunHours: result.solver.overrun_hours };
  },
  "schedule.event": async (job) => {
    const event = await db.query.scheduleEvents.findFirst({ where: eq(scheduleEvents.id, String(job.data.scheduleEventId)) });
    if (!event) throw new Error("Schedule event is missing.");
    const payload = event.payload as { affectedTaskIds?: string[]; availableAt?: string };
    if (!payload.affectedTaskIds?.length) throw new Error("A queued shipment event requires affected task IDs.");
    const affected = await db.select({ id: scheduleTasks.id }).from(scheduleTasks).where(and(eq(scheduleTasks.projectId, event.projectId), eq(scheduleTasks.reviewState, "accepted"), inArray(scheduleTasks.id, payload.affectedTaskIds)));
    if (affected.length !== new Set(payload.affectedTaskIds).size) throw new Error("Affected IDs must map to accepted project tasks.");
    const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, event.projectId), orderBy: [desc(scheduleVersions.versionNumber)] });
    const assignments = latest ? await db.select().from(scheduleAssignments).where(and(eq(scheduleAssignments.versionId, latest.id), inArray(scheduleAssignments.taskId, payload.affectedTaskIds))).orderBy(asc(scheduleAssignments.startAt)) : [];
    const material = event.eventType === "SHIPMENT_RECOVERED" || Boolean(payload.availableAt && assignments.some((assignment) => assignment.startAt < new Date(payload.availableAt!)));
    if (!material) {
      await db.update(scheduleEvents).set({ processingStatus: "status_only", processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, event.id));
      return { accepted: true, scheduleEventId: event.id, action: "status_only", reason: "The shipment availability does not move a current task start." };
    }
    const [firstAssignment] = latest ? await db.select().from(scheduleAssignments).where(eq(scheduleAssignments.versionId, latest.id)).orderBy(asc(scheduleAssignments.startAt)).limit(1) : [];
    const result = await createScheduleVersion({ projectId: event.projectId, actorId: String(job.data.actorId), horizonStart: firstAssignment?.startAt ?? event.occurredAt, reason: `Event ${event.eventType} (${event.eventId}) materially affected ${affected.length} accepted task(s).`, triggerEventId: event.id });
    await db.update(scheduleEvents).set({ processingStatus: "resolved", resultVersionId: result.version.id, processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, event.id));
    return { accepted: true, scheduleEventId: event.id, action: "re_solved", versionId: result.version.id, warmStartHintCount: result.warmStartHintCount };
  }
};

export function startWorker(queueName = "core") {
  const worker = new Worker(queueName, async (job) => {
    const durableJobId = String(job.data.durableJobId);
    await db.update(durableJobs).set({ status: "running", attempts: job.attemptsMade + 1, startedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, durableJobId));
    const handler = handlers[job.name];
    if (!handler) throw new Error(`No worker handler is registered for ${job.name}.`);
    try {
      const result = await handler(job);
      await db.update(durableJobs).set({ status: "completed", result: result as Record<string, unknown>, completedAt: new Date(), updatedAt: new Date(), error: null }).where(eq(durableJobs.id, durableJobId));
      return result;
    } catch (error) {
      await db.update(durableJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Worker failed", completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, durableJobId));
      if (job.name === "schedule.event" && job.data.scheduleEventId) await db.update(scheduleEvents).set({ processingStatus: "solve_failed", processingError: error instanceof Error ? error.message : "Schedule event failed", processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, String(job.data.scheduleEventId)));
      throw error;
    }
  }, { connection: getRedis(), prefix: env.REDIS_PREFIX, concurrency: 4 });
  return worker;
}
