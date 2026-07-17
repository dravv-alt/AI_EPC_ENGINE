import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { documentVersions, durableJobs, scheduleAssignments, scheduleEvents, scheduleTasks, scheduleVersions, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis/client";
import { objectStorage } from "@/lib/storage/service";
import { createScheduleVersion } from "@/lib/schedule/create-version";
import { and, asc, desc, inArray } from "drizzle-orm";

export async function extractDocument(input: { documentVersionId: string; objectKey: string }) {
  const { documentVersionId, objectKey } = input;
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
  "document.extract": (job) => extractDocument(job.data as { documentVersionId: string; objectKey: string }),
  "schedule.event": async (job) => {
    const event = await db.query.scheduleEvents.findFirst({ where: eq(scheduleEvents.id, String(job.data.scheduleEventId)) });
    if (!event) throw new Error("Schedule event is missing.");
    const payload = event.payload as { affectedTaskIds?: string[] };
    if (!payload.affectedTaskIds?.length) return { accepted: true, scheduleEventId: event.id, action: "history_only", reason: "No affected task IDs were supplied." };
    const affected = await db.select({ id: scheduleTasks.id }).from(scheduleTasks).where(and(eq(scheduleTasks.projectId, event.projectId), inArray(scheduleTasks.id, payload.affectedTaskIds)));
    if (!affected.length) return { accepted: true, scheduleEventId: event.id, action: "history_only", reason: "Affected IDs do not map to accepted project tasks." };
    const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, event.projectId), orderBy: [desc(scheduleVersions.versionNumber)] });
    const [firstAssignment] = latest ? await db.select().from(scheduleAssignments).where(eq(scheduleAssignments.versionId, latest.id)).orderBy(asc(scheduleAssignments.startAt)).limit(1) : [];
    const result = await createScheduleVersion({ projectId: event.projectId, actorId: String(job.data.actorId), horizonStart: firstAssignment?.startAt ?? event.occurredAt, reason: `Event ${event.eventType} (${event.eventId}) affected ${affected.length} accepted task(s).` });
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
      throw error;
    }
  }, { connection: getRedis(), prefix: env.REDIS_PREFIX, concurrency: 4 });
  return worker;
}
