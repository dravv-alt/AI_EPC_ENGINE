import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { compareCompliance, normalizedContentHash } from "@/lib/compliance/compare";
import { db } from "@/lib/db/client";
import { complianceChecks, compliancePrecedents, documents, documentVersions, edges, findings, requirements, sourceRegions, users } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({
  requirementId: z.string().uuid(),
  targetSourceRegionId: z.string().uuid(),
  precedentId: z.string().uuid().optional()
});

async function citation(regionId: string) {
  const [row] = await db.select({
    regionId: sourceRegions.id,
    pageNumber: sourceRegions.pageNumber,
    bbox: sourceRegions.bbox,
    text: sourceRegions.extractedText,
    contentHash: sourceRegions.contentHash,
    versionId: documentVersions.id,
    revision: documentVersions.revision,
    versionStatus: documentVersions.status,
    versionCreatedAt: documentVersions.createdAt,
    documentId: documents.id,
    documentTitle: documents.title,
    documentType: documents.documentType
  }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(sourceRegions.id, regionId)).limit(1);
  return row ?? null;
}

function hierarchy(documentType: string) {
  const rank: Record<string, number> = { client_spec: 100, specification: 100, standard: 80, procedure: 70, submittal: 50, shop_drawing: 50, drawing: 50, po: 50 };
  return rank[documentType.toLowerCase()] ?? 40;
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const rows = await db.select({ check: complianceChecks, reviewerName: users.displayName }).from(complianceChecks).leftJoin(users, eq(complianceChecks.reviewedBy, users.id)).where(eq(complianceChecks.projectId, projectId)).orderBy(desc(complianceChecks.createdAt));
    const items = await Promise.all(rows.map(async ({ check, reviewerName }) => ({
      ...check,
      reviewerName,
      requirementCitation: await citation((await db.query.requirements.findFirst({ where: and(eq(requirements.id, check.requirementId), eq(requirements.projectId, projectId)) }))!.sourceRegionId),
      targetCitation: await citation(check.targetSourceRegionId)
    })));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load compliance checks." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comparison request.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "requirement:review");
    const requirement = await db.query.requirements.findFirst({ where: and(eq(requirements.id, parsed.data.requirementId), eq(requirements.projectId, projectId)) });
    if (!requirement) return NextResponse.json({ error: "The controlled requirement is outside this project." }, { status: 422 });
    if (requirement.reviewState !== "accepted") return NextResponse.json({ error: "Only accepted requirements can be checked." }, { status: 409 });
    const [requirementCitation, targetCitation] = await Promise.all([citation(requirement.sourceRegionId), citation(parsed.data.targetSourceRegionId)]);
    if (!requirementCitation || !targetCitation) return NextResponse.json({ error: "Both exact source regions are required." }, { status: 422 });
    const targetDocument = await db.query.documents.findFirst({ where: and(eq(documents.id, targetCitation.documentId), eq(documents.projectId, projectId)) });
    const requirementDocument = await db.query.documents.findFirst({ where: and(eq(documents.id, requirementCitation.documentId), eq(documents.projectId, projectId)) });
    if (!targetDocument || !requirementDocument) return NextResponse.json({ error: "Both citations must belong to this project." }, { status: 422 });

    let acceptedPrecedent: typeof compliancePrecedents.$inferSelect | undefined;
    if (parsed.data.precedentId) {
      acceptedPrecedent = await db.query.compliancePrecedents.findFirst({ where: and(eq(compliancePrecedents.id, parsed.data.precedentId), eq(compliancePrecedents.projectId, projectId), eq(compliancePrecedents.requirementId, requirement.id), eq(compliancePrecedents.reviewState, "accepted")) });
      if (!acceptedPrecedent || acceptedPrecedent.targetContentHash !== normalizedContentHash(targetCitation.text)) return NextResponse.json({ error: "The selected precedent is not accepted for this requirement and exact normalized target line." }, { status: 409 });
    }

    const result = compareCompliance(requirement, targetCitation.text, Boolean(acceptedPrecedent));
    const sourceConflict = hierarchy(requirementDocument.documentType) !== hierarchy(targetDocument.documentType) && !["conforms", "equivalent_by_precedent"].includes(result.verdict);
    result.requirementSnapshot.source = { regionId: requirementCitation.regionId, documentType: requirementDocument.documentType, documentTitle: requirementDocument.title, revision: requirementCitation.revision, hierarchy: hierarchy(requirementDocument.documentType), createdAt: requirementCitation.versionCreatedAt };
    result.targetSnapshot.source = { regionId: targetCitation.regionId, documentType: targetDocument.documentType, documentTitle: targetDocument.title, revision: targetCitation.revision, hierarchy: hierarchy(targetDocument.documentType), createdAt: targetCitation.versionCreatedAt };
    result.targetSnapshot.sourceConflict = sourceConflict;

    const created = await db.transaction(async (tx) => {
      const [check] = await tx.insert(complianceChecks).values({
        projectId,
        requirementId: requirement.id,
        targetSourceRegionId: targetCitation.regionId,
        comparisonType: result.comparisonType,
        requirementSnapshot: result.requirementSnapshot,
        targetSnapshot: result.targetSnapshot,
        verdict: result.verdict,
        confidence: result.confidence,
        reason: result.reason,
        precedentId: acceptedPrecedent?.id ?? null,
        findingDisposition: ["deterministic_flag", "possible_mismatch"].includes(result.verdict) ? "proposed" : "not_applicable"
      }).returning();
      if (!["deterministic_flag", "possible_mismatch"].includes(result.verdict)) return { check, finding: null };
      const gateEdge = await tx.query.edges.findFirst({ where: and(eq(edges.projectId, projectId), eq(edges.fromType, "requirement"), eq(edges.fromId, requirement.id), eq(edges.relationshipType, "AFFECTS"), eq(edges.toType, "gate")) });
      const [finding] = await tx.insert(findings).values({ projectId, gateId: gateEdge?.toId ?? null, title: `Proposed compliance ${result.verdict.replaceAll("_", " ")}`, description: `${result.reason}\n\nRequirement citation: ${requirement.sourceRegionId}\nTarget citation: ${targetCitation.regionId}`, severity: result.verdict === "deterministic_flag" ? "high" : "medium", status: "proposed" }).returning();
      const [updated] = await tx.update(complianceChecks).set({ proposedFindingId: finding.id, updatedAt: new Date() }).where(eq(complianceChecks.id, check.id)).returning();
      return { check: updated, finding };
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "compliance.check.proposed", entityType: "compliance_check", entityId: created.check.id, after: { ...created.check, sourceConflict, advisory: true, findingStatus: created.finding?.status ?? null } });
    return NextResponse.json({ check: created.check, proposedFinding: created.finding, requirementCitation, targetCitation, sourceConflict }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run check." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
