import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEventInTransaction } from "@/lib/audit/write-event";
import { deriveFindingOwner, findingDueAt } from "@/lib/compliance/create-check";
import { db } from "@/lib/db/client";
import { complianceChecks, edges, findings, requirements } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";
import { captureTeachbackNote } from "@/lib/teachback/capture";
import { surfaceTeachbackAdvisory } from "@/lib/teachback/surface";

// Slice 8: advisory-only teach-back context for a similar past compliance
// check correction (the general case — distinct from the specialized,
// exact-hash-matched compliancePrecedents path this route already supports
// via `precedentId`). Read-only — never mutates the check.
export async function GET(request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = await params;
  const existing = await db.query.complianceChecks.findFirst({ where: eq(complianceChecks.id, checkId) });
  if (!existing) return NextResponse.json({ error: "Compliance check not found." }, { status: 404 });
  try {
    await requireProjectPermission(existing.projectId, "requirement:review");
    const advisory = await surfaceTeachbackAdvisory({ projectId: existing.projectId, subjectType: "compliance_check", queryText: existing.reason });
    return NextResponse.json({ advisory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load advisory context" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

const schema = z.object({
  action: z.enum(["accept", "edit", "reject"]),
  expectedVersion: z.number().int().positive(),
  note: z.string().trim().min(10).max(5000),
  finalVerdict: z.enum(["conforms", "deterministic_flag", "possible_mismatch"]).optional()
}).superRefine((value, context) => {
  if (value.action === "edit" && !value.finalVerdict) context.addIssue({ code: "custom", message: "An edited check requires the engineer's final verdict.", path: ["finalVerdict"] });
});

export async function PATCH(request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Compliance review is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  const existing = await db.query.complianceChecks.findFirst({ where: eq(complianceChecks.id, checkId) });
  if (!existing) return NextResponse.json({ error: "Compliance check not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(existing.projectId, "requirement:review");
    if (existing.reviewState !== "proposed") return NextResponse.json({ error: "This compliance proposal has already received a final human disposition." }, { status: 409 });
    const finalVerdict = parsed.data.action === "edit" ? parsed.data.finalVerdict! : existing.verdict;
    if (parsed.data.action === "accept" && existing.verdict === "needs_engineering_judgment") return NextResponse.json({ error: "Needs-engineering-judgment cannot be accepted unchanged. Edit it to an explicit disposition or reject it." }, { status: 409 });
    const acceptedDeviation = parsed.data.action !== "reject" && ["deterministic_flag", "possible_mismatch"].includes(finalVerdict);

    const outcome = await db.transaction(async (tx) => {
      let finding = existing.proposedFindingId ? await tx.query.findings.findFirst({ where: eq(findings.id, existing.proposedFindingId) }) : undefined;
      if (acceptedDeviation && !finding) {
        const gateEdge = await tx.query.edges.findFirst({ where: and(eq(edges.projectId, existing.projectId), eq(edges.fromType, "requirement"), eq(edges.fromId, existing.requirementId), eq(edges.relationshipType, "AFFECTS"), eq(edges.toType, "gate")) });
        const gateId = gateEdge?.toId ?? null;
        const requirement = await tx.query.requirements.findFirst({ where: eq(requirements.id, existing.requirementId) });
        const severity = finalVerdict === "deterministic_flag" ? "high" : "medium";
        const ownerId = await deriveFindingOwner(tx, existing.projectId, gateId, requirement?.reviewedBy ?? null);
        [finding] = await tx.insert(findings).values({ projectId: existing.projectId, gateId, title: `Accepted compliance ${finalVerdict.replaceAll("_", " ")}`, description: `${existing.reason}\n\nEngineer disposition: ${parsed.data.note}`, severity, status: "open", ownerId, dueAt: findingDueAt(severity) }).returning();
      } else if (finding) {
        // A finding already proposed by createComplianceCheck carries its own
        // ownerId/dueAt; only backfill here if an older row somehow lacks
        // them, so acceptance never regresses completeness below the
        // proposal's.
        const backfillOwnerId = finding.ownerId ?? await deriveFindingOwner(tx, existing.projectId, finding.gateId, null);
        const backfillDueAt = finding.dueAt ?? findingDueAt(finding.severity);
        [finding] = await tx.update(findings).set({
          status: acceptedDeviation ? "open" : "dismissed",
          title: acceptedDeviation ? `Accepted compliance ${finalVerdict.replaceAll("_", " ")}` : finding.title,
          description: `${finding.description ?? existing.reason}\n\nEngineer disposition: ${parsed.data.note}`,
          ownerId: backfillOwnerId,
          dueAt: backfillDueAt,
          version: sql`${findings.version} + 1`,
          updatedAt: new Date()
        }).where(eq(findings.id, finding.id)).returning();
      }
      const [check] = await tx.update(complianceChecks).set({
        verdict: finalVerdict,
        reviewState: parsed.data.action === "reject" ? "rejected" : parsed.data.action === "edit" ? "edited" : "accepted",
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note,
        proposedFindingId: finding?.id ?? existing.proposedFindingId,
        findingDisposition: finding ? acceptedDeviation ? "accepted_open" : "dismissed" : "not_applicable",
        version: sql`${complianceChecks.version} + 1`,
        updatedAt: new Date()
      }).where(and(eq(complianceChecks.id, checkId), eq(complianceChecks.version, parsed.data.expectedVersion), eq(complianceChecks.reviewState, "proposed"))).returning();
      if (!check) throw new Error("CONFLICT");
      if (parsed.data.action === "edit" || parsed.data.action === "reject") {
        await captureTeachbackNote(tx, {
          projectId: existing.projectId,
          subjectType: "compliance_check",
          subjectId: existing.id,
          correctedFrom: { verdict: existing.verdict, reason: existing.reason },
          correctedTo: parsed.data.action === "edit" ? { verdict: finalVerdict } : null,
          rationale: parsed.data.note,
          sourceRegionId: existing.targetSourceRegionId,
          createdBy: actor.userId,
          disposition: parsed.data.action === "edit" ? "edited" : "rejected",
          embedText: existing.reason
        });
      }
      await writeAuditEventInTransaction(tx, { projectId: existing.projectId, actorId: actor.userId, action: `compliance.check.${parsed.data.action === "reject" ? "rejected" : parsed.data.action === "edit" ? "edited" : "accepted"}`, entityType: "compliance_check", entityId: existing.id, before: existing, after: { check, finding } });
      return { check, finding };
    });
    if (outcome.finding) await persistProjectGateReadiness(existing.projectId);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") return NextResponse.json({ error: "This compliance check changed after you opened it. Reload before reviewing." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review compliance check." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
