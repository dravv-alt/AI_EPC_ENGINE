import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { documents, documentVersions, scheduleResources, scheduleTaskResources, scheduleTasks, sourceRegions } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceScheduleRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({
  name: z.string().trim().min(3).max(240), durationHours: z.number().int().min(1).max(100000), sourceRegionId: z.string().uuid().optional(), earliestStart: z.string().datetime().optional(), deadline: z.string().datetime().optional(), fixedStart: z.string().datetime().optional(), vendor: z.string().trim().max(200).optional(), leadTimeDays: z.number().int().nonnegative().optional(), deadlineType: z.enum(["hard", "soft"]).optional(), confidence: z.number().min(0).max(1).optional(), validationIssues: z.array(z.string().min(1).max(200)).max(50).default([]), resourceDemands: z.array(z.object({ resourceId: z.string().uuid(), demand: z.number().int().positive() })).max(100).default([])
}).superRefine((value, context) => { if (new Set(value.resourceDemands.map((item) => item.resourceId)).size !== value.resourceDemands.length) context.addIssue({ code: "custom", message: "Each resource can appear only once.", path: ["resourceDemands"] }); });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ items: await db.select().from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load schedule tasks." }, { status: error instanceof AccessError ? error.status : 500 }); } }

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const limited = await enforceScheduleRateLimit(`tasks:${projectId}`); if (limited) return limited; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Task proposal is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    const resourceIds = parsed.data.resourceDemands.map((item) => item.resourceId);
    if (resourceIds.length) { const rows = await db.select({ id: scheduleResources.id }).from(scheduleResources).where(and(eq(scheduleResources.projectId, projectId), inArray(scheduleResources.id, resourceIds))); if (rows.length !== resourceIds.length) return NextResponse.json({ error: "Every resource demand must reference this project." }, { status: 400 }); }
    if (parsed.data.sourceRegionId) { const rows = await db.select({ id: sourceRegions.id }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(and(eq(sourceRegions.id, parsed.data.sourceRegionId), eq(documents.projectId, projectId))); if (!rows.length) return NextResponse.json({ error: "Task citation must reference this project." }, { status: 400 }); }
    const task = await db.transaction(async (tx) => { const [task] = await tx.insert(scheduleTasks).values({ projectId, name: parsed.data.name, durationHours: parsed.data.durationHours, sourceRegionId: parsed.data.sourceRegionId ?? null, earliestStart: parsed.data.earliestStart ? new Date(parsed.data.earliestStart) : null, deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null, fixedStart: parsed.data.fixedStart ? new Date(parsed.data.fixedStart) : null, vendor: parsed.data.vendor ?? null, leadTimeDays: parsed.data.leadTimeDays ?? null, deadlineType: parsed.data.deadlineType ?? null, confidence: parsed.data.confidence === undefined ? null : String(parsed.data.confidence), validationIssues: parsed.data.validationIssues, reviewState: "proposed" }).returning(); if (parsed.data.resourceDemands.length) await tx.insert(scheduleTaskResources).values(parsed.data.resourceDemands.map((item) => ({ taskId: task.id, resourceId: item.resourceId, demand: item.demand }))); return task; });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "schedule.task_proposed", entityType: "schedule_task", entityId: task.id, after: parsed.data }); return NextResponse.json({ task, authority: "proposed" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create task proposal." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
