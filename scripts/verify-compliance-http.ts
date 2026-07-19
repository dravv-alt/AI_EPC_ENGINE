import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { complianceChecks, compliancePrecedents, documentVersions, documents, edges, findings, gates, projects, requirements, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit, expectedStatus?: number) { const response = await fetch(url, init); const body = await response.json(); if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(body)); else if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`); return body; }

async function main() {
  const base = process.env.COMPLIANCE_TEST_URL ?? "http://localhost:4173";
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = []; const requirementIds: string[] = []; const checkIds: string[] = []; const precedentIds: string[] = []; const findingIds: string[] = []; const edgeIds: string[] = [];
  let gateId: string | undefined; let originalGateStatus: typeof gates.$inferSelect.status | undefined;
  let otherProjectId: string | undefined;
  try {
    const gate = await db.query.gates.findFirst({ where: eq(gates.projectId, developmentProjectId) }); assert.ok(gate); gateId = gate.id; originalGateStatus = gate.status;
    // A dedicated throwaway project for the cross-project rejection check,
    // rather than an arbitrary unordered row from `projects` — a clean
    // database has no "other" project to find, and relying on one left over
    // from a prior run is exactly the kind of debris-dependent fragility that
    // silently masks a real bug until the database happens to be clean.
    const developmentProject = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) }); assert.ok(developmentProject);
    const [otherProject] = await db.insert(projects).values({ tenantId: developmentProject.tenantId, name: `Compliance cross-project check ${randomUUID().slice(0, 8)}`, code: `CPX-${randomUUID().slice(0, 8)}`, timezone: "UTC" }).returning();
    otherProjectId = otherProject.id;

    async function controlledRegion(projectId: string, documentType: string, title: string, text: string) {
      const token = randomUUID();
      const [document] = await db.insert(documents).values({ projectId, documentType, title }).returning(); documentIds.push(document.id);
      const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "Contract Test", status: "approved", sha256: hash(`version:${token}`), objectKey: `${projectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
      const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(text) }).returning(); regionIds.push(region.id);
      return region;
    }

    const numericClause = await controlledRegion(developmentProjectId, "client_spec", "Synthetic client specification", "The operating pressure shall be 100 kPa plus or minus 2 kPa.");
    const conformingLine = await controlledRegion(developmentProjectId, "submittal", "Synthetic vendor submittal", "Operating pressure: 1 bar.");
    const deviatingLine = await controlledRegion(developmentProjectId, "shop_drawing", "Synthetic shop drawing", "Operating pressure: 120 kPa.");
    const qualitativeClause = await controlledRegion(developmentProjectId, "standard", "Synthetic controlled standard", "The enclosure finish shall be suitable for the operating environment.");
    const qualitativeLine = await controlledRegion(developmentProjectId, "submittal", "Synthetic finish submittal", "Finish system: vendor marine coating arrangement.");
    const crossProjectLine = await controlledRegion(otherProject.id, "submittal", "Other tenant target", "Operating pressure: 100 kPa.");
    const [numericRequirement, qualitativeRequirement] = await db.insert(requirements).values([
      { projectId: developmentProjectId, sourceRegionId: numericClause.id, statement: numericClause.extractedText, modality: "shall", numericValue: "100", unit: "kPa", tolerance: "2", reviewState: "accepted", confidence: "1.0000" },
      { projectId: developmentProjectId, sourceRegionId: qualitativeClause.id, statement: qualitativeClause.extractedText, modality: "shall", reviewState: "accepted", confidence: "1.0000" }
    ]).returning(); requirementIds.push(numericRequirement.id, qualitativeRequirement.id);
    const [edge] = await db.insert(edges).values({ projectId: developmentProjectId, fromType: "requirement", fromId: numericRequirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gate.id }).returning(); edgeIds.push(edge.id);

    const conforming = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: conformingLine.id }) }); checkIds.push(conforming.check.id); assert.equal(conforming.check.comparisonType, "numeric"); assert.equal(conforming.check.verdict, "conforms"); assert.equal(conforming.check.proposedFindingId, null); assert.match(conforming.check.reason, /1 bar = 100 kPa/);

    const deviating = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: deviatingLine.id }) }); checkIds.push(deviating.check.id); findingIds.push(deviating.proposedFinding.id); assert.equal(deviating.check.verdict, "deterministic_flag"); assert.equal(deviating.proposedFinding.status, "proposed"); assert.equal((await db.query.gates.findFirst({ where: eq(gates.id, gate.id) }))?.status, originalGateStatus, "A machine-proposed finding must not change gate authority.");
    const acceptedDeviation = await request(`${base}/api/compliance/checks/${deviating.check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", expectedVersion: deviating.check.version, note: "Engineer confirms the unit-normalized pressure deviation against both exact citations." }) }); assert.equal(acceptedDeviation.check.reviewState, "accepted"); assert.equal(acceptedDeviation.finding.status, "open"); assert.equal((await db.query.gates.findFirst({ where: eq(gates.id, gate.id) }))?.status, "blocked");

    const qualitative = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: qualitativeRequirement.id, targetSourceRegionId: qualitativeLine.id }) }); checkIds.push(qualitative.check.id); findingIds.push(qualitative.proposedFinding.id); assert.equal(qualitative.check.verdict, "possible_mismatch"); assert.equal(qualitative.check.confidence, "0.0000");
    const proposedPrecedent = await request(`${base}/api/projects/${developmentProjectId}/compliance/precedents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkId: qualitative.check.id, title: "Marine coating accepted for this enclosure clause", rationale: "Engineer compared the cited coating system and controlled environmental suitability clause and determined them equivalent for this scoped application." }) }); precedentIds.push(proposedPrecedent.precedent.id); assert.equal(proposedPrecedent.precedent.reviewState, "proposed");
    const approvedPrecedent = await request(`${base}/api/compliance/precedents/${proposedPrecedent.precedent.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", note: "Approved as an exact-citation, project-scoped equality precedent after engineering review." }) }); assert.equal(approvedPrecedent.precedent.reviewState, "accepted"); assert.equal(approvedPrecedent.check.verdict, "equivalent_by_precedent"); assert.equal(approvedPrecedent.finding.status, "dismissed");
    const reused = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: qualitativeRequirement.id, targetSourceRegionId: qualitativeLine.id, precedentId: proposedPrecedent.precedent.id }) }); checkIds.push(reused.check.id); assert.equal(reused.check.verdict, "equivalent_by_precedent"); assert.equal(reused.check.precedentId, proposedPrecedent.precedent.id);

    await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: crossProjectLine.id }) }, 422);
    const list = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`); assert.ok(list.items.some((item: { id: string; requirementCitation: unknown; targetCitation: unknown }) => item.id === reused.check.id && item.requirementCitation && item.targetCitation));
    console.log("Compliance HTTP verification passed: unit-normalized deterministic comparison, non-authoritative proposed finding, human blocker promotion, qualitative mandatory review, exact-citation precedent approval/reuse, and cross-project rejection.");
  } finally {
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (precedentIds.length) await db.delete(compliancePrecedents).where(inArray(compliancePrecedents.id, precedentIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (gateId && originalGateStatus) await db.update(gates).set({ status: originalGateStatus, updatedAt: new Date() }).where(and(eq(gates.id, gateId), eq(gates.projectId, developmentProjectId)));
    if (otherProjectId) await db.delete(projects).where(eq(projects.id, otherProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
