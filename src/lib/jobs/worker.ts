import { Worker, type Job } from "bullmq";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { documentVersions, durableJobs, projects, projectMembers, scheduleAssignments, scheduleEvents, scheduleTasks, scheduleVersions, shipments, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis/client";
import { objectStorage } from "@/lib/storage/service";
import { createScheduleVersion } from "@/lib/schedule/create-version";
import { proposeDocumentRecords } from "@/lib/ingestion/proposals";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { generateChecklistDraft, generateCxReport } from "@/lib/cx/generation";
import { pollProjectRisks, type RiskScenarioOverride } from "@/lib/predictive-risk/engine";
import { getAisClient } from "@/lib/supply/ais-client";
import { getWeatherClient } from "@/lib/supply/weather-client";
import { calculateShipmentStatus } from "@/lib/supply/status";
import { currentMappedTaskIds } from "@/lib/supply/task-mapping";
import { processScheduleEvent } from "@/lib/events/process";

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
  "poll.heartbeat": async () => {
    const now = new Date();
    await db.insert(durableJobs)
      .values({ queue: "core", name: "poll.heartbeat", idempotencyKey: "poll:heartbeat", status: "completed", payload: {}, result: { heartbeatAt: now.toISOString() }, startedAt: now, completedAt: now })
      .onConflictDoUpdate({ target: durableJobs.idempotencyKey, set: { status: "completed", result: { heartbeatAt: now.toISOString() }, completedAt: now, error: null, updatedAt: now } });
    return { heartbeatAt: now.toISOString() };
  },
  "risk.poll.all": async () => {
    const active = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.status, "active"));
    const enqueued: string[] = [];
    for (const project of active) {
      const owner = await db.query.projectMembers.findFirst({ where: eq(projectMembers.projectId, project.id) });
      if (!owner) continue;
      const bucket = Math.floor(Date.now() / env.POLL_INTERVAL_MS);
      try {
        const queued = await enqueueDurableJob({ queue: "core", name: "risk.poll", tenantId: project.tenantId, projectId: project.id, idempotencyKey: `risk-poll-auto:${project.id}:${bucket}`, payload: { projectId: project.id, actorId: owner.userId } });
        enqueued.push(queued.job.id);
      } catch { /* a project without a current baseline cannot be polled yet; skip it */ }
    }
    return { activeProjects: active.length, enqueued: enqueued.length };
  },
  "supply.poll.all": async () => {
    const active = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.status, "active"));
    const bucket = Math.floor(Date.now() / env.POLL_INTERVAL_MS);
    const enqueued: string[] = [];
    for (const project of active) {
      const tracked = await db.select({ id: shipments.id }).from(shipments).where(and(eq(shipments.projectId, project.id), isNotNull(shipments.mmsi))).limit(1);
      if (!tracked.length) continue;
      const queued = await enqueueDurableJob({ queue: "core", name: "supply.poll", tenantId: project.tenantId, projectId: project.id, idempotencyKey: `supply-poll-auto:${project.id}:${bucket}`, payload: { projectId: project.id } });
      enqueued.push(queued.job.id);
    }
    return { activeProjects: active.length, enqueued: enqueued.length };
  },
  "supply.poll": async (job) => {
    const projectId = job.data.projectId ? String(job.data.projectId) : null;
    const now = new Date();
    const cycle = Math.floor(now.getTime() / env.POLL_INTERVAL_MS);
    const conditions = projectId ? and(eq(shipments.projectId, projectId), isNotNull(shipments.mmsi)) : isNotNull(shipments.mmsi);
    const tracked = await db.select().from(shipments).where(conditions);
    const aisClient = getAisClient();
    const weatherClient = getWeatherClient();
    let polled = 0;
    let transitioned = 0;
    for (const shipment of tracked) {
      if (shipment.originLat === null || shipment.originLng === null || shipment.destinationLat === null || shipment.destinationLng === null) continue;
      const observation = await aisClient.poll({
        mmsi: shipment.mmsi!,
        originLat: Number(shipment.originLat),
        originLng: Number(shipment.originLng),
        destinationLat: Number(shipment.destinationLat),
        destinationLng: Number(shipment.destinationLng),
        departedAt: shipment.createdAt,
        plannedEta: shipment.plannedEta,
        now
      });
      const weather = await weatherClient.forecast({ lat: observation.lat, lng: observation.lng, mmsi: shipment.mmsi });
      const calculated = calculateShipmentStatus({ plannedEta: shipment.plannedEta, requiredOnSite: shipment.requiredOnSite, portCongestion: shipment.portCongestion, weatherDelayFactor: weather.weatherDelayFactor, now });
      await db.update(shipments).set({
        currentLat: String(observation.lat),
        currentLng: String(observation.lng),
        positionSource: observation.positionSource,
        telemetryReason: `${observation.reason} ${weather.reason}`,
        lastPolledAt: now,
        weatherAdjustedEta: calculated.weatherAdjustedEta,
        weatherDelayFactor: String(calculated.weatherDelayFactor),
        status: calculated.status,
        lastNotifiedStatus: calculated.status,
        updatedAt: now
      }).where(eq(shipments.id, shipment.id));
      polled += 1;

      if (calculated.status !== shipment.lastNotifiedStatus) {
        const affectedTaskIds = shipment.equipmentId ? await currentMappedTaskIds(shipment.projectId, shipment.equipmentId) : [];
        const transitionId = `poll:${cycle}:${shipment.lastNotifiedStatus ?? "unknown"}-${calculated.status}`;
        const common = { eventId: randomUUID(), projectId: shipment.projectId, occurredAt: now.toISOString(), transitionId } as const;
        try {
          if (calculated.status === "green") {
            await processScheduleEvent({ ...common, eventType: "SHIPMENT_RECOVERED", payload: { shipmentId: shipment.id, availableAt: calculated.weatherAdjustedEta.toISOString(), previousAvailableAt: shipment.weatherAdjustedEta?.toISOString(), affectedTaskIds, estimate: true } }, shipment.createdBy);
          } else {
            await processScheduleEvent({ ...common, eventType: "SHIPMENT_DELAYED", payload: { shipmentId: shipment.id, status: calculated.status, availableAt: calculated.weatherAdjustedEta.toISOString(), previousAvailableAt: shipment.weatherAdjustedEta?.toISOString(), affectedTaskIds, estimate: true } }, shipment.createdBy);
          }
          transitioned += 1;
        } catch { /* a project without a current schedule baseline cannot accept task-linked events yet; status is still persisted */ }
      }
    }
    return { tracked: tracked.length, polled, transitioned };
  },
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
    const durableJobId = job.data.durableJobId ? String(job.data.durableJobId) : null;
    if (durableJobId) await db.update(durableJobs).set({ status: "running", attempts: job.attemptsMade + 1, startedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, durableJobId));
    const handler = handlers[job.name];
    if (!handler) throw new Error(`No worker handler is registered for ${job.name}.`);
    try {
      const result = await handler(job);
      if (durableJobId) await db.update(durableJobs).set({ status: "completed", result: result as Record<string, unknown>, completedAt: new Date(), updatedAt: new Date(), error: null }).where(eq(durableJobs.id, durableJobId));
      return result;
    } catch (error) {
      if (durableJobId) await db.update(durableJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Worker failed", completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, durableJobId));
      if (job.name === "schedule.event" && job.data.scheduleEventId) await db.update(scheduleEvents).set({ processingStatus: "solve_failed", processingError: error instanceof Error ? error.message : "Schedule event failed", processedAt: new Date(), updatedAt: new Date() }).where(eq(scheduleEvents.id, String(job.data.scheduleEventId)));
      throw error;
    }
  }, { connection: getRedis(), prefix: env.REDIS_PREFIX, concurrency: 4 });
  return worker;
}
