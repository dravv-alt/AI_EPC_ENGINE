import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { durableJobs, projects, riskSignals, scheduleEvents, scheduleRisks, scheduleTasks } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { pollProjectRisks } from "@/lib/predictive-risk/engine";
import { riskSignalTypes } from "@/lib/predictive-risk/clients";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceScheduleRateLimit } from "@/lib/redis/rate-limit";

const scenarioSchema = z.object({ taskId: z.string().uuid(), signalType: z.enum(riskSignalTypes), dataAvailable: z.boolean(), probability: z.number().min(0).max(1).optional(), estimatedDelayHours: z.number().int().nonnegative().max(2160).optional(), unavailableReason: z.string().trim().max(1000).optional(), value: z.record(z.unknown()).optional() }).superRefine((value, context) => { if (value.dataAvailable && (value.probability === undefined || value.estimatedDelayHours === undefined)) context.addIssue({ code: "custom", message: "Available scenario signals require probability and delay hours." }); });
const schema = z.object({ idempotencyKey: z.string().min(8).max(200).optional(), scenario: z.array(scenarioSchema).max(100).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const url = new URL(request.url); const riskType = url.searchParams.get("riskType"); const taskId = url.searchParams.get("taskId");
    const conditions = [eq(scheduleRisks.projectId, projectId)]; if (riskType) conditions.push(eq(scheduleRisks.riskType, riskType)); if (taskId) conditions.push(eq(scheduleRisks.taskId, taskId));
    const items = await db.select({ risk: scheduleRisks, taskName: scheduleTasks.name, signalStatus: riskSignals.status, signalSource: riskSignals.source, signalValue: riskSignals.value, signalUnavailableReason: riskSignals.unavailableReason, eventProcessingStatus: scheduleEvents.processingStatus, resultVersionId: scheduleEvents.resultVersionId }).from(scheduleRisks).innerJoin(scheduleTasks, eq(scheduleRisks.taskId, scheduleTasks.id)).leftJoin(riskSignals, eq(scheduleRisks.sourceSignalId, riskSignals.id)).leftJoin(scheduleEvents, eq(scheduleRisks.scheduleEventId, scheduleEvents.id)).where(and(...conditions)).orderBy(desc(scheduleRisks.observedAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load schedule risks." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Risk poll request is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const limited = await enforceScheduleRateLimit(`risks:${projectId}`);
    if (limited) return limited;
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    if (parsed.data.scenario?.length && env.AUTH_MODE !== "development") return NextResponse.json({ error: "Scenario overrides are restricted to the isolated development runtime." }, { status: 403 });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) }); if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const bucket = Math.floor(Date.now() / 30_000); const idempotencyKey = parsed.data.idempotencyKey ?? `risk-poll:${projectId}:${bucket}`;
    const queued = await enqueueDurableJob({ queue: "core", name: "risk.poll", tenantId: project.tenantId, projectId, idempotencyKey, payload: { projectId, actorId: actor.userId, scenario: parsed.data.scenario } });
    if (queued.queuedInRedis) return NextResponse.json({ pollJobId: queued.job.id, status: queued.job.status }, { status: queued.duplicate ? 200 : 202 });
    try {
      await db.update(durableJobs).set({ status: "running", startedAt: new Date(), attempts: 1, updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id));
      const result = await pollProjectRisks({ projectId, actorId: actor.userId, scenario: parsed.data.scenario });
      await db.update(durableJobs).set({ status: "completed", result, completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id));
      return NextResponse.json({ pollJobId: queued.job.id, status: "completed", result, infrastructure: "inline-degraded" }, { status: 201 });
    } catch (error) {
      await db.update(durableJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Risk poll failed", completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id)); throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start risk polling." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
