import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { decisions, documentVersions, documents, edges, evidence, findings, gates, requirements, sourceRegions } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

/**
 * A single node on the change blast radius. `distance` is the number of hops from
 * a changed source region: 1 = a requirement rooted in a changed region,
 * 2 = evidence / gates reached from that requirement through the edge graph.
 */
type ImpactNode = { id: string; type: "requirement" | "evidence" | "gate"; label: string; state: string; distance: number };

export async function POST(_: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const [target] = await db.select({ version: documentVersions, document: documents }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documentVersions.id, versionId));
  if (!target) return NextResponse.json({ error: "Document version not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(target.document.projectId, "requirement:review");
    if (target.version.extractionStatus !== "completed") return NextResponse.json({ error: "Change assessment requires completed extraction." }, { status: 409 });
    const previous = await db.query.documentVersions.findFirst({ where: and(eq(documentVersions.documentId, target.document.id), ne(documentVersions.id, target.version.id)), orderBy: [desc(documentVersions.createdAt)] });
    if (!previous) return NextResponse.json({ error: "A previous controlled version is required for comparison." }, { status: 409 });
    const [oldRegions, newRegions] = await Promise.all([db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, previous.id)), db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, target.version.id))]);
    const newHashes = new Set(newRegions.map((item) => item.contentHash));
    const changedRegionIds = oldRegions.filter((item) => !newHashes.has(item.contentHash)).map((item) => item.id);
    // Hop 1: requirements rooted in a changed source region.
    const affectedRequirements = changedRegionIds.length ? await db.select().from(requirements).where(inArray(requirements.sourceRegionId, changedRegionIds)) : [];
    const requirementIds = affectedRequirements.map((item) => item.id);
    // Hop 2a: evidence that PROVES an impacted requirement.
    const proofEdges = requirementIds.length ? await db.select().from(edges).where(and(eq(edges.projectId, target.document.projectId), eq(edges.fromType, "evidence"), eq(edges.relationshipType, "PROVES"), inArray(edges.toId, requirementIds))) : [];
    const evidenceIds = [...new Set(proofEdges.map((item) => item.fromId))];
    // Hop 2b: gates the impacted requirements AFFECT.
    const gateEdges = requirementIds.length ? await db.select().from(edges).where(and(eq(edges.projectId, target.document.projectId), eq(edges.fromType, "requirement"), eq(edges.relationshipType, "AFFECTS"), inArray(edges.fromId, requirementIds), eq(edges.toType, "gate"))) : [];
    const gateIds = [...new Set(gateEdges.map((item) => item.toId))];
    await db.transaction(async (tx) => {
      await tx.update(documentVersions).set({ status: "superseded", updatedAt: new Date() }).where(eq(documentVersions.id, previous.id));
      if (evidenceIds.length) await tx.update(evidence).set({ validityState: "stale", updatedAt: new Date() }).where(and(inArray(evidence.id, evidenceIds), eq(evidence.validityState, "accepted")));
      if (gateIds.length) await tx.update(gates).set({ status: "in_review", updatedAt: new Date() }).where(and(inArray(gates.id, gateIds), eq(gates.status, "approved")));
      for (const gateId of gateIds) {
        const existing = await tx.query.findings.findFirst({ where: and(eq(findings.gateId, gateId), eq(findings.status, "open"), eq(findings.title, `Reassess source revision ${target.version.revision}`)) });
        if (!existing) await tx.insert(findings).values({ projectId: target.document.projectId, gateId, title: `Reassess source revision ${target.version.revision}`, severity: "high", status: "open", ownerId: actor.userId });
      }
    });
    // Re-read the reached entities so the blast-radius list reports their
    // post-assessment state (stale evidence, reopened gates) alongside labels.
    const [impactedEvidence, impactedGates] = await Promise.all([
      evidenceIds.length ? db.select().from(evidence).where(inArray(evidence.id, evidenceIds)) : Promise.resolve([]),
      gateIds.length ? db.select().from(gates).where(inArray(gates.id, gateIds)) : Promise.resolve([])
    ]);
    const impact: ImpactNode[] = [
      ...affectedRequirements.map((item) => ({ id: item.id, type: "requirement" as const, label: item.statement, state: item.reviewState, distance: 1 })),
      ...impactedEvidence.map((item) => ({ id: item.id, type: "evidence" as const, label: item.notes ?? item.evidenceType, state: item.validityState, distance: 2 })),
      ...impactedGates.map((item) => ({ id: item.id, type: "gate" as const, label: item.name, state: item.status, distance: 2 }))
    ];
    const impactedDecisionCount = gateIds.length ? (await db.select().from(decisions).where(inArray(decisions.gateId, gateIds))).length : 0;
    await writeAuditEvent({ projectId: target.document.projectId, actorId: actor.userId, action: "source.change_assessed", entityType: "document_version", entityId: target.version.id, before: { previousVersionId: previous.id }, after: { changedRegionIds, affectedRequirementIds: requirementIds, staleEvidenceIds: evidenceIds, gateIds, impactedDecisionCount } });
    return NextResponse.json({ previousVersionId: previous.id, currentVersionId: target.version.id, changedRegionIds, affectedRequirementIds: requirementIds, staleEvidenceIds: evidenceIds, gateIds, impact, impactedDecisionCount, deterministic: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to assess change." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
