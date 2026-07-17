import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { raiseAlert } from "@/lib/alerts/write-alert";
import { aggregateVerdicts, evaluateStep } from "@/lib/cx/acceptance";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxStepResults, cxTestRecords, findings, gates, projects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ value: z.number().finite().optional(), boolean: z.boolean().optional(), text: z.string().max(5000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ checklistId: string; stepId: string }> }) {
  const { checklistId, stepId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reading", details: parsed.error.flatten() }, { status: 400 });
  const [checklist, step] = await Promise.all([db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) }), db.query.cxChecklistSteps.findFirst({ where: and(eq(cxChecklistSteps.id, stepId), eq(cxChecklistSteps.checklistId, checklistId)) })]);
  if (!checklist || !step) return NextResponse.json({ error: "Checklist step not found" }, { status: 404 });
  try {
    const actor = await requireProjectPermission(checklist.projectId, "evidence:capture");
    if (checklist.status !== "accepted") return NextResponse.json({ error: "An engineer must accept this draft checklist before execution." }, { status: 409 });
    let record = await db.query.cxTestRecords.findFirst({ where: and(eq(cxTestRecords.checklistId, checklistId), eq(cxTestRecords.executedBy, actor.userId)) });
    if (!record) { const project = await db.query.projects.findFirst({ where: (projects, { eq }) => eq(projects.id, checklist.projectId) }); if (!project) throw new Error("Project not found"); [record] = await db.insert(cxTestRecords).values({ tenantId: project.tenantId, projectId: checklist.projectId, checklistId, gateId: checklist.gateId, executedBy: actor.userId }).returning(); }
    const verdict = evaluateStep({ modality: step.modality as "numeric" | "boolean" | "narrative", nominalValue: step.nominalValue ? Number(step.nominalValue) : null, tolerance: step.tolerance ? Number(step.tolerance) : null, expectedBoolean: step.expectedBoolean }, parsed.data);
    const [result] = await db.insert(cxStepResults).values({ testRecordId: record.id, stepId, readingValue: parsed.data.value?.toString(), readingBoolean: parsed.data.boolean, readingText: parsed.data.text, enteredBy: actor.userId, enteredAt: new Date(), verdict }).onConflictDoUpdate({ target: [cxStepResults.testRecordId, cxStepResults.stepId], set: { readingValue: parsed.data.value?.toString(), readingBoolean: parsed.data.boolean, readingText: parsed.data.text, enteredBy: actor.userId, enteredAt: new Date(), verdict, updatedAt: new Date() } }).returning();
    if (verdict === "proposed_fail" && !result.findingId) { const [finding] = await db.insert(findings).values({ projectId: checklist.projectId, gateId: checklist.gateId, title: `Proposed test failure: ${step.instruction}`, severity: "high", status: "open", ownerId: actor.userId }).returning(); await db.update(cxStepResults).set({ findingId: finding.id }).where(eq(cxStepResults.id, result.id)); await db.update(gates).set({ status: "blocked", updatedAt: new Date() }).where(eq(gates.id, checklist.gateId)); await raiseAlert({ projectId: checklist.projectId, eventType: "TEST_FAILED", dedupKey: `test-failed:${result.id}`, title: "Commissioning test step requires action", payload: { findingId: finding.id, gateId: checklist.gateId, stepId } }); }
    const results = await db.select().from(cxStepResults).where(eq(cxStepResults.testRecordId, record.id)); const overallStatus = aggregateVerdicts(results.map((item) => item.verdict)); await db.update(cxTestRecords).set({ overallStatus, updatedAt: new Date() }).where(eq(cxTestRecords.id, record.id)); await writeAuditEvent({ projectId: checklist.projectId, actorId: actor.userId, action: "cx.step.reading.recorded", entityType: "cx_step_result", entityId: result.id, after: { verdict, testRecordId: record.id } });
    return NextResponse.json({ step: result, verdict, overallStatus, label: `Proposed ${verdict.replace("proposed_", "")}` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record reading" }, { status: error instanceof AccessError ? error.status : 500 }); }
}
