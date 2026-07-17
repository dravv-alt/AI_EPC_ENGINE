import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxClauseCitations } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const stepEdit = z.object({ id: z.string().uuid(), instruction: z.string().trim().min(8).max(4000).optional(), required: z.boolean().optional(), nominalValue: z.number().finite().nullable().optional(), tolerance: z.number().nonnegative().nullable().optional(), expectedBoolean: z.boolean().nullable().optional(), narrativeCriterion: z.string().trim().min(3).max(4000).nullable().optional() });
const schema = z.object({ action: z.enum(["accept", "edit", "reject"]), note: z.string().trim().min(5).max(3000), steps: z.array(stepEdit).max(100).default([]) });

export async function POST(request: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const { checklistId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review action and a substantive note are required.", details: parsed.error.flatten() }, { status: 400 });
  const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) });
  if (!checklist) return NextResponse.json({ error: "Checklist not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(checklist.projectId, "requirement:review");
    if (checklist.status !== "draft") return NextResponse.json({ error: "Only a draft checklist can be reviewed." }, { status: 409 });
    if (checklist.generationStatus !== "completed") return NextResponse.json({ error: "Checklist generation must complete successfully before review.", generationStatus: checklist.generationStatus, generationError: checklist.generationError }, { status: 409 });
    const [steps, citations] = await Promise.all([db.select().from(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklist.id)), db.select().from(cxClauseCitations).where(eq(cxClauseCitations.checklistId, checklist.id))]);
    if (!steps.length) return NextResponse.json({ error: "An empty generated checklist cannot be reviewed." }, { status: 409 });
    if (parsed.data.steps.some((edit) => !steps.some((step) => step.id === edit.id))) return NextResponse.json({ error: "Every edited step must belong to this checklist." }, { status: 422 });
    if (parsed.data.action === "accept") {
      const uncited = steps.filter((step) => !citations.some((citation) => citation.stepId === step.id && citation.sourceRegionId && citation.verificationStatus === "verified"));
      if (uncited.length) return NextResponse.json({ error: "Every accepted step requires at least one verified controlled citation.", uncitedStepIds: uncited.map((step) => step.id) }, { status: 409 });
    }
    const updated = await db.transaction(async (tx) => {
      if (parsed.data.action === "edit") for (const edit of parsed.data.steps) {
        const current = steps.find((step) => step.id === edit.id)!;
        await tx.update(cxChecklistSteps).set({ instruction: edit.instruction ?? current.instruction, required: edit.required ?? current.required, nominalValue: edit.nominalValue === undefined ? current.nominalValue : edit.nominalValue === null ? null : String(edit.nominalValue), tolerance: edit.tolerance === undefined ? current.tolerance : edit.tolerance === null ? null : String(edit.tolerance), expectedBoolean: edit.expectedBoolean === undefined ? current.expectedBoolean : edit.expectedBoolean, narrativeCriterion: edit.narrativeCriterion === undefined ? current.narrativeCriterion : edit.narrativeCriterion, reviewState: "edited", reviewNote: parsed.data.note, updatedAt: new Date() }).where(and(eq(cxChecklistSteps.id, edit.id), eq(cxChecklistSteps.checklistId, checklist.id)));
      }
      const nextStatus = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "reject" ? "rejected" : "draft";
      const nextStepState = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "reject" ? "rejected" : null;
      if (nextStepState) await tx.update(cxChecklistSteps).set({ reviewState: nextStepState, reviewNote: parsed.data.note, updatedAt: new Date() }).where(inArray(cxChecklistSteps.id, steps.map((step) => step.id)));
      const [row] = await tx.update(cxChecklists).set({ status: nextStatus, reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, updatedAt: new Date() }).where(eq(cxChecklists.id, checklist.id)).returning();
      return row;
    });
    await writeAuditEvent({ projectId: checklist.projectId, actorId: actor.userId, action: `cx.checklist.${parsed.data.action}`, entityType: "cx_checklist", entityId: checklist.id, before: { status: checklist.status }, after: { status: updated.status, note: parsed.data.note, editedStepIds: parsed.data.steps.map((step) => step.id) } });
    return NextResponse.json({ checklist: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review checklist." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
