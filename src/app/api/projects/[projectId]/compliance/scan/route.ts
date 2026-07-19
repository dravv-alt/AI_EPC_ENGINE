import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createComplianceCheck } from "@/lib/compliance/create-check";
import { discoverCandidateTargets } from "@/lib/compliance/discover";
import { db } from "@/lib/db/client";
import { projects, requirements } from "@/lib/db/schema";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({
  requirementIds: z.array(z.string().uuid()).max(200).optional(),
  limit: z.number().int().positive().max(20).optional()
});

// Discovery-only tracer: for each accepted requirement, semantically finds
// candidate submittal/PO/shop-drawing/drawing regions and enqueues one
// durable "compliance.check.candidate" job per candidate pair. No comparison
// runs synchronously here -- createComplianceCheck (deterministic in this
// slice) runs inside the job, either via the worker or inline when Redis is
// degraded, mirroring the cx/checklists generation route's pattern.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid scan request.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "requirement:review");
    const limited = await enforceAiRateLimit(`compliance-scan:${projectId}`);
    if (limited) return limited;

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const candidateLimit = parsed.data.limit ?? 5;
    const scopedRequirements = parsed.data.requirementIds?.length
      ? await db.select().from(requirements).where(and(eq(requirements.projectId, projectId), inArray(requirements.id, parsed.data.requirementIds), eq(requirements.reviewState, "accepted")))
      : await db.select().from(requirements).where(and(eq(requirements.projectId, projectId), eq(requirements.reviewState, "accepted")));

    const requestedCount = parsed.data.requirementIds?.length ?? scopedRequirements.length;
    const skipped: Array<{ requirementId: string; reason: string }> = [];
    if (parsed.data.requirementIds?.length) {
      const foundIds = new Set(scopedRequirements.map((requirement) => requirement.id));
      for (const requirementId of parsed.data.requirementIds) {
        if (!foundIds.has(requirementId)) skipped.push({ requirementId, reason: "Not an accepted, project-scoped requirement." });
      }
    }

    let candidatesFound = 0;
    let jobsEnqueued = 0;
    let jobsInline = 0;
    let jobsDuplicate = 0;
    const scannedRequirementIds: string[] = [];
    const items: Array<{ requirementId: string; targetSourceRegionId: string; jobId: string; duplicate: boolean; queuedInRedis: boolean }> = [];

    for (const requirement of scopedRequirements) {
      const candidates = await discoverCandidateTargets({ projectId, requirementId: requirement.id, limit: candidateLimit });
      if (!candidates.length) {
        skipped.push({ requirementId: requirement.id, reason: "No candidate target regions found." });
        continue;
      }
      scannedRequirementIds.push(requirement.id);
      for (const candidate of candidates) {
        candidatesFound += 1;
        const queued = await enqueueDurableJob({
          queue: "core",
          name: "compliance.check.candidate",
          tenantId: project.tenantId,
          projectId,
          idempotencyKey: `compliance-check:${requirement.id}:${candidate.targetSourceRegionId}`,
          payload: { projectId, requirementId: requirement.id, targetSourceRegionId: candidate.targetSourceRegionId, actorId: actor.userId }
        });
        items.push({ requirementId: requirement.id, targetSourceRegionId: candidate.targetSourceRegionId, jobId: queued.job.id, duplicate: queued.duplicate, queuedInRedis: queued.queuedInRedis });
        if (queued.duplicate) { jobsDuplicate += 1; continue; }
        if (queued.queuedInRedis) {
          jobsEnqueued += 1;
        } else {
          jobsInline += 1;
          try {
            await createComplianceCheck({ projectId, requirementId: requirement.id, targetSourceRegionId: candidate.targetSourceRegionId, actorId: actor.userId });
          } catch (error) {
            skipped.push({ requirementId: requirement.id, reason: `Inline candidate check failed: ${error instanceof Error ? error.message : "unknown error"}` });
          }
        }
      }
    }

    return NextResponse.json({
      requirementsRequested: requestedCount,
      requirementsScanned: scannedRequirementIds.length,
      requirementsSkipped: skipped,
      candidatesFound,
      jobsEnqueued,
      jobsInline,
      jobsDuplicate,
      items,
      infrastructure: jobsInline > 0 && jobsEnqueued === 0 ? "inline-degraded" : "queued"
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run compliance scan." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
