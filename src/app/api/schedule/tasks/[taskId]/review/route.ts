import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { scheduleTasks } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { captureTeachbackNote } from "@/lib/teachback/capture";
import { surfaceTeachbackAdvisory } from "@/lib/teachback/surface";

const schema = z.object({ action: z.enum(["accept", "edit", "reject"]), name: z.string().trim().min(3).max(240).optional(), durationHours: z.number().int().positive().optional(), earliestStart: z.string().datetime().nullable().optional(), deadline: z.string().datetime().nullable().optional(), fixedStart: z.string().datetime().nullable().optional(), vendor: z.string().trim().max(200).nullable().optional(), leadTimeDays: z.number().int().nonnegative().nullable().optional(), deadlineType: z.enum(["hard", "soft"]).nullable().optional(), resolveValidationIssues: z.boolean().default(false), note: z.string().trim().min(3).max(2000) });

// Slice 8: advisory-only teach-back context for a similar past task
// correction. Read-only — never mutates the task.
export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await db.query.scheduleTasks.findFirst({ where: eq(scheduleTasks.id, taskId) });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  try {
    await requireProjectPermission(task.projectId, "schedule:manage");
    const advisory = await surfaceTeachbackAdvisory({ projectId: task.projectId, subjectType: "schedule_task", queryText: task.name });
    return NextResponse.json({ advisory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load advisory context" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Task review is invalid.", issues: parsed.error.flatten() }, { status: 400 }); const task = await db.query.scheduleTasks.findFirst({ where: eq(scheduleTasks.id, taskId) }); if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(task.projectId, "schedule:manage"); if (!["proposed", "edited"].includes(task.reviewState)) return NextResponse.json({ error: "Only proposed or edited tasks can be reviewed." }, { status: 409 });
    const issues = task.validationIssues as string[]; if (parsed.data.action === "accept" && issues.length) return NextResponse.json({ error: "Resolve every flagged field through an explicit edit before accepting.", validationIssues: issues }, { status: 409 });
    const reviewState = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "reject" ? "rejected" : "edited";
    const toDate = (value: string | null | undefined, current: Date | null) => value === undefined ? current : value === null ? null : new Date(value);
    const updated = await db.transaction(async (tx) => {
      const [updated] = await tx.update(scheduleTasks).set({ name: parsed.data.name ?? task.name, durationHours: parsed.data.durationHours ?? task.durationHours, earliestStart: toDate(parsed.data.earliestStart, task.earliestStart), deadline: toDate(parsed.data.deadline, task.deadline), fixedStart: toDate(parsed.data.fixedStart, task.fixedStart), vendor: parsed.data.vendor === undefined ? task.vendor : parsed.data.vendor, leadTimeDays: parsed.data.leadTimeDays === undefined ? task.leadTimeDays : parsed.data.leadTimeDays, deadlineType: parsed.data.deadlineType === undefined ? task.deadlineType : parsed.data.deadlineType, validationIssues: parsed.data.action === "edit" && parsed.data.resolveValidationIssues ? [] : issues, reviewState, reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, updatedAt: new Date() }).where(eq(scheduleTasks.id, task.id)).returning();
      if (parsed.data.action === "edit" || parsed.data.action === "reject") {
        await captureTeachbackNote(tx, {
          projectId: task.projectId,
          subjectType: "schedule_task",
          subjectId: task.id,
          correctedFrom: { name: task.name, durationHours: task.durationHours, vendor: task.vendor, leadTimeDays: task.leadTimeDays, deadlineType: task.deadlineType },
          correctedTo: parsed.data.action === "edit" ? { name: updated!.name, durationHours: updated!.durationHours, vendor: updated!.vendor, leadTimeDays: updated!.leadTimeDays, deadlineType: updated!.deadlineType } : null,
          rationale: parsed.data.note,
          sourceRegionId: task.sourceRegionId,
          createdBy: actor.userId,
          disposition: parsed.data.action === "edit" ? "edited" : "rejected",
          embedText: task.name
        });
      }
      return updated;
    });
    await writeAuditEvent({ projectId: task.projectId, actorId: actor.userId, action: `schedule.task_${reviewState}`, entityType: "schedule_task", entityId: task.id, before: task, after: updated }); return NextResponse.json({ task: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review task." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
