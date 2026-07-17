import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { durableJobs, projects, scheduleDependencies, scheduleTasks } from "@/lib/db/schema";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { createScheduleVersion } from "@/lib/schedule/create-version";
import { assertAcyclic, ScheduleCycleError } from "@/lib/schedule/solver";

const schema = z.object({ horizonStart: z.string().datetime(), reason: z.string().trim().min(5).max(2000), idempotencyKey: z.string().min(8).max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A horizon start and solve reason are required." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    const [project, tasks, dependencies] = await Promise.all([
      db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
      db.query.scheduleTasks.findMany({ where: (table, { and, eq }) => and(eq(table.projectId, projectId), eq(table.reviewState, "accepted")) }),
      db.select().from(scheduleDependencies).where(eq(scheduleDependencies.projectId, projectId))
    ]);
    if (!project || !tasks.length) return NextResponse.json({ error: "At least one accepted task is required." }, { status: 409 });
    assertAcyclic(tasks.map((task) => task.id), dependencies);
    const idempotencyKey = parsed.data.idempotencyKey ?? `baseline:${projectId}:${randomUUID()}`;
    const queued = await enqueueDurableJob({ queue: "core", name: "schedule.baseline", tenantId: project.tenantId, projectId, idempotencyKey, payload: { projectId, actorId: actor.userId, horizonStart: parsed.data.horizonStart, reason: parsed.data.reason } });
    if (queued.queuedInRedis) return NextResponse.json({ solveJobId: queued.job.id, status: queued.job.status }, { status: queued.duplicate ? 200 : 202 });
    try {
      await db.update(durableJobs).set({ status: "running", startedAt: new Date(), attempts: 1, updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id));
      const result = await createScheduleVersion({ projectId, actorId: actor.userId, horizonStart: new Date(parsed.data.horizonStart), reason: parsed.data.reason });
      await db.update(durableJobs).set({ status: "completed", result: { versionId: result.version.id, versionNumber: result.version.versionNumber, solverStatus: result.solver.status }, completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id));
      return NextResponse.json({ solveJobId: queued.job.id, status: "completed", versionId: result.version.id, infrastructure: "inline-degraded" }, { status: 201 });
    } catch (error) {
      await db.update(durableJobs).set({ status: "failed", error: error instanceof Error ? error.message : "Solve failed", completedAt: new Date(), updatedAt: new Date() }).where(eq(durableJobs.id, queued.job.id));
      throw error;
    }
  } catch (error) {
    if (error instanceof ScheduleCycleError) return NextResponse.json({ error: error.message, offendingEdge: error.offendingEdge }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start baseline solve." }, { status: error instanceof AccessError ? error.status : 502 });
  }
}
