import { and, eq } from "drizzle-orm";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { compareCompliance, normalizedContentHash } from "@/lib/compliance/compare";
import { db } from "@/lib/db/client";
import { complianceChecks, compliancePrecedents, documents, documentVersions, edges, findings, requirements, sourceRegions } from "@/lib/db/schema";

export async function citation(regionId: string) {
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

export function hierarchy(documentType: string) {
  const rank: Record<string, number> = { client_spec: 100, specification: 100, standard: 80, procedure: 70, submittal: 50, shop_drawing: 50, drawing: 50, po: 50 };
  return rank[documentType.toLowerCase()] ?? 40;
}

export class CreateComplianceCheckError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}

// Creates one complianceChecks row (and, when the deterministic comparator
// flags a mismatch, a proposed finding) from a requirement + target source
// region pair. Shared by the synchronous POST /compliance/checks route and
// the durable "compliance.check.candidate" job handler so there is exactly
// one place that owns check-creation logic — this is also the single seam a
// later slice swaps in an LLM-based comparator behind.
export async function createComplianceCheck(input: {
  projectId: string;
  requirementId: string;
  targetSourceRegionId: string;
  actorId: string;
  precedentId?: string;
}) {
  const { projectId, requirementId, targetSourceRegionId, actorId, precedentId } = input;

  const requirement = await db.query.requirements.findFirst({ where: and(eq(requirements.id, requirementId), eq(requirements.projectId, projectId)) });
  if (!requirement) throw new CreateComplianceCheckError("The controlled requirement is outside this project.", 422);
  if (requirement.reviewState !== "accepted") throw new CreateComplianceCheckError("Only accepted requirements can be checked.", 409);

  const [requirementCitation, targetCitation] = await Promise.all([citation(requirement.sourceRegionId), citation(targetSourceRegionId)]);
  if (!requirementCitation || !targetCitation) throw new CreateComplianceCheckError("Both exact source regions are required.", 422);

  const targetDocument = await db.query.documents.findFirst({ where: and(eq(documents.id, targetCitation.documentId), eq(documents.projectId, projectId)) });
  const requirementDocument = await db.query.documents.findFirst({ where: and(eq(documents.id, requirementCitation.documentId), eq(documents.projectId, projectId)) });
  if (!targetDocument || !requirementDocument) throw new CreateComplianceCheckError("Both citations must belong to this project.", 422);

  let acceptedPrecedent: typeof compliancePrecedents.$inferSelect | undefined;
  if (precedentId) {
    acceptedPrecedent = await db.query.compliancePrecedents.findFirst({ where: and(eq(compliancePrecedents.id, precedentId), eq(compliancePrecedents.projectId, projectId), eq(compliancePrecedents.requirementId, requirement.id), eq(compliancePrecedents.reviewState, "accepted")) });
    if (!acceptedPrecedent || acceptedPrecedent.targetContentHash !== normalizedContentHash(targetCitation.text)) throw new CreateComplianceCheckError("The selected precedent is not accepted for this requirement and exact normalized target line.", 409);
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

  await writeAuditEvent({ projectId, actorId, action: "compliance.check.proposed", entityType: "compliance_check", entityId: created.check.id, after: { ...created.check, sourceConflict, advisory: true, findingStatus: created.finding?.status ?? null } });

  return { check: created.check, proposedFinding: created.finding, requirementCitation, targetCitation, sourceConflict };
}
