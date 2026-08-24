import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CreateComplianceCheckError, createComplianceCheck } from "../src/lib/compliance/create-check";
import { db } from "../src/lib/db/client";
import { auditEvents, complianceChecks, documentVersions, documents, findings, projectMembers, requirements, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function main() {
  const documentIds: string[] = [];
  const versionIds: string[] = [];
  const regionIds: string[] = [];
  const requirementIds: string[] = [];
  const checkIds: string[] = [];
  const findingIds: string[] = [];
  const auditIds: string[] = [];
  try {
    const actor = await db.query.projectMembers.findFirst({ where: eq(projectMembers.projectId, developmentProjectId) });
    assert.ok(actor, "The verification project requires a member.");

    async function controlledRegion(documentType: string, title: string, text: string, status: "draft" | "approved" | "superseded") {
      const token = randomUUID();
      const [document] = await db.insert(documents).values({ projectId: developmentProjectId, documentType, title }).returning();
      documentIds.push(document.id);
      const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: `Authority ${token.slice(0, 8)}`, status, sha256: hash(`version:${token}`), objectKey: `${developmentProjectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning();
      versionIds.push(version.id);
      const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(text) }).returning();
      regionIds.push(region.id);
      return region;
    }

    const requirementRegion = await controlledRegion("client_spec", "Authority test client specification", "Operating pressure shall be 100 kPa.", "approved");
    const draftTarget = await controlledRegion("submittal", "Authority test draft submittal", "Operating pressure: 120 kPa.", "draft");
    const supersededTarget = await controlledRegion("shop_drawing", "Authority test superseded shop drawing", "Operating pressure: 120 kPa.", "superseded");
    const approvedTarget = await controlledRegion("drawing", "Authority test approved drawing", "Motor schedule: 480 V.\nOperating pressure: 120 kPa.\nAmbient limit: 40 °C.", "approved");
    const [requirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: requirementRegion.id, statement: requirementRegion.extractedText, modality: "shall", numericValue: "100", unit: "kPa", tolerance: "0", comparisonModality: "numeric", reviewState: "accepted", confidence: "1.0000", reviewedBy: actor.userId, reviewedAt: new Date() }).returning();
    requirementIds.push(requirement.id);

    for (const [label, targetSourceRegionId] of [["draft", draftTarget.id], ["superseded", supersededTarget.id]] as const) {
      await assert.rejects(
        createComplianceCheck({ projectId: developmentProjectId, requirementId: requirement.id, targetSourceRegionId, actorId: actor.userId }),
        (error: unknown) => error instanceof CreateComplianceCheckError && error.status === 409 && error.message.includes("completed, approved"),
        `${label} target must fail closed`,
      );
    }

    const created = await createComplianceCheck({ projectId: developmentProjectId, requirementId: requirement.id, targetSourceRegionId: approvedTarget.id, actorId: actor.userId });
    checkIds.push(created.check.id);
    if (created.proposedFinding) findingIds.push(created.proposedFinding.id);
    assert.equal(created.check.verdict, "deterministic_flag");
    assert.ok(created.proposedFinding, "A controlled deterministic deviation must create a proposed finding.");
    const targetSnapshot = created.check.targetSnapshot as { text?: string; excerptSelection?: string; regionContentHash?: string; excerptHash?: string };
    assert.equal(targetSnapshot.text, "Operating pressure: 120 kPa.", "The comparison must use the relevant exact target fragment.");
    assert.equal(targetSnapshot.excerptSelection, "deterministic_fragment");
    assert.equal(targetSnapshot.regionContentHash, approvedTarget.contentHash);
    assert.match(targetSnapshot.excerptHash ?? "", /^[a-f0-9]{64}$/);

    const audit = await db.query.auditEvents.findFirst({ where: and(eq(auditEvents.entityId, created.check.id), eq(auditEvents.action, "compliance.check.proposed")) });
    assert.ok(audit?.afterHash, "The compliance row and hash-chained audit event must commit together.");
    auditIds.push(audit.id);

    await assert.rejects(
      createComplianceCheck({ projectId: developmentProjectId, requirementId: requirement.id, targetSourceRegionId: approvedTarget.id, actorId: actor.userId }),
      (error: unknown) => error instanceof CreateComplianceCheckError && error.status === 409 && error.message.includes("pending compliance review"),
      "A duplicate pending comparison must be rejected",
    );

    console.log("Compliance authority verification passed: uncontrolled versions rejected, exact fragment selected, deviation finding proposed, duplicate blocked, and audit event committed.");
  } finally {
    if (auditIds.length) {
      const [head] = await db.select({ id: auditEvents.id }).from(auditEvents).where(eq(auditEvents.projectId, developmentProjectId)).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(1);
      // Removing only the current tail preserves the prior chain. If another
      // workflow appended after this verifier, retain the fixture event as a
      // historical audit record rather than deleting a middle link.
      if (head && auditIds.includes(head.id)) await db.delete(auditEvents).where(eq(auditEvents.id, head.id));
    }
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
