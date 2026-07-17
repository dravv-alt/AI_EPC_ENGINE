import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { canonicalJson } from "@/lib/crypto/canonical-json";
import { editableReportSchema } from "@/lib/cx/generation";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxStepResults, cxTestRecords, edges, evidence, gates, requirements, storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { objectStorage, type StoredObject } from "@/lib/storage/service";

const schema = z.object({ reason: z.string().trim().min(12).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ testRecordId: string }> }) {
  const { testRecordId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Engineer approval requires a substantive review reason." }, { status: 400 });
  const record = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, testRecordId) });
  if (!record) return NextResponse.json({ error: "Test record not found." }, { status: 404 });
  let stored: StoredObject | undefined;
  try {
    const actor = await requireProjectPermission(record.projectId, "requirement:review");
    if (record.reportStatus === "approved" || record.evidenceId) return NextResponse.json({ error: "This report is already approved and immutable." }, { status: 409 });
    const content = editableReportSchema.safeParse(record.reportContent);
    if (!content.success || record.reportGenerationStatus !== "completed") return NextResponse.json({ error: "A complete editable draft is required before approval." }, { status: 409 });
    const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, record.checklistId) });
    if (!checklist || checklist.status !== "accepted") return NextResponse.json({ error: "The governing checklist is not accepted." }, { status: 409 });
    const [steps, results, gateRequirementEdges] = await Promise.all([
      db.select().from(cxChecklistSteps).where(and(eq(cxChecklistSteps.checklistId, checklist.id), eq(cxChecklistSteps.reviewState, "accepted"))),
      db.select().from(cxStepResults).where(eq(cxStepResults.testRecordId, record.id)),
      db.select().from(edges).where(and(eq(edges.projectId, record.projectId), eq(edges.fromType, "requirement"), eq(edges.relationshipType, "AFFECTS"), eq(edges.toType, "gate"), eq(edges.toId, record.gateId)))
    ]);
    const resultByStep = new Map(results.map((result) => [result.stepId, result]));
    const missing = steps.filter((step) => step.required && !resultByStep.has(step.id));
    if (missing.length) return NextResponse.json({ error: "Every required accepted step must be recorded before approval.", missingStepIds: missing.map((step) => step.id) }, { status: 409 });
    const failed = results.filter((result) => result.verdict === "proposed_fail");
    if (failed.length) return NextResponse.json({ error: "A report containing a deterministic proposed failure cannot be approved into accepted evidence.", failedStepIds: failed.map((result) => result.stepId) }, { status: 409 });
    const requirementIds = [...new Set(gateRequirementEdges.map((edge) => edge.fromId))];
    const acceptedRequirements = requirementIds.length ? await db.select({ id: requirements.id }).from(requirements).where(and(inArray(requirements.id, requirementIds), eq(requirements.reviewState, "accepted"), eq(requirements.projectId, record.projectId))) : [];
    const approvedAt = new Date();
    const artifact = { ...content.data, label: "ENGINEER APPROVED — IMMUTABLE ARTIFACT", approval: { approvedBy: actor.userId, approvedAt: approvedAt.toISOString(), reason: parsed.data.reason, priorDraftModel: record.reportModelVersion, humanReviewResolved: results.some((result) => result.verdict === "needs_human_review") } };
    const bytes = Buffer.from(canonicalJson(artifact));
    stored = await objectStorage.put({ tenantId: record.tenantId, projectId: record.projectId, bytes, mediaType: "application/json", fileName: `cx-report-${record.id}.json` });
    const transaction = await db.transaction(async (tx) => {
      const [object] = await tx.insert(storageObjects).values({ tenantId: record.tenantId, projectId: record.projectId, objectKey: stored!.objectKey, mediaType: stored!.mediaType, byteSize: stored!.byteSize, sha256: stored!.sha256, createdBy: actor.userId }).returning();
      const [newEvidence] = await tx.insert(evidence).values({ projectId: record.projectId, systemId: checklist.systemId, assetId: checklist.assetId, storageObjectId: object.id, evidenceType: "cx_test_report", validityState: "accepted", contentHash: stored!.sha256, capturedBy: actor.userId, capturedAt: approvedAt, notes: `Engineer-approved Cx report. Review: ${parsed.data.reason}` }).returning();
      const graphRows = [
        { projectId: record.projectId, fromType: "evidence", fromId: newEvidence.id, relationshipType: "AFFECTS", toType: "gate", toId: record.gateId },
        { projectId: record.projectId, fromType: "evidence", fromId: newEvidence.id, relationshipType: "AFFECTS", toType: "asset", toId: checklist.assetId },
        ...acceptedRequirements.map((requirement) => ({ projectId: record.projectId, fromType: "evidence", fromId: newEvidence.id, relationshipType: "PROVES", toType: "requirement", toId: requirement.id }))
      ];
      await tx.insert(edges).values(graphRows);
      const [updated] = await tx.update(cxTestRecords).set({ reportStatus: "approved", reportContentHash: stored!.sha256, reportArtifactObjectId: object.id, evidenceId: newEvidence.id, approvedBy: actor.userId, approvedAt, reportReviewNote: parsed.data.reason, updatedAt: approvedAt }).where(eq(cxTestRecords.id, record.id)).returning();
      await tx.update(gates).set({ status: "in_review", updatedAt: approvedAt }).where(and(eq(gates.id, record.gateId), eq(gates.projectId, record.projectId)));
      return { report: updated, evidence: newEvidence, object };
    });
    await writeAuditEvent({ projectId: record.projectId, actorId: actor.userId, action: "cx.report.approved", entityType: "cx_test_record", entityId: record.id, after: { evidenceId: transaction.evidence.id, artifactObjectId: transaction.object.id, artifactHash: stored.sha256, gateStatus: "in_review", reason: parsed.data.reason, provedRequirementIds: acceptedRequirements.map((requirement) => requirement.id) } });
    return NextResponse.json({ report: transaction.report, evidenceId: transaction.evidence.id, gateState: "in_review", artifactHash: stored.sha256, artifactUrl: await objectStorage.signedReadUrl(stored.objectKey, 300), label: "ENGINEER APPROVED — IMMUTABLE ARTIFACT" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve report." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
