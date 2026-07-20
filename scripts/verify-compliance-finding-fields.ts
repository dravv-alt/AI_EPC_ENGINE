// Slice 4 — a compliance-generated finding must be as actionable as a
// manually created one: assignable (ownerId) and time-bound (dueAt). This
// verifies both the auto-proposal path (createComplianceCheck) and the
// human-acceptance path (PATCH .../review), and that owner derivation never
// fabricates or crosses project boundaries.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { complianceChecks, documentVersions, documents, edges, findings, gates, memberRole, projectMembers, projects, requirements, sourceRegions, systems } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit, expectedStatus?: number) { const response = await fetch(url, init); const body = await response.json(); if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(body)); else if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`); return body; }

async function main() {
  const base = process.env.COMPLIANCE_FINDING_FIELDS_TEST_URL ?? process.env.COMPLIANCE_TEST_URL ?? "http://localhost:4173";
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = []; const requirementIds: string[] = []; const checkIds: string[] = []; const findingIds: string[] = []; const edgeIds: string[] = []; const gateIds: string[] = [];

  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) }); assert.ok(project);
    const system = await db.query.systems.findFirst({ where: eq(systems.projectId, developmentProjectId) }); assert.ok(system, "fixture project must have at least one system");
    const members = await db.query.projectMembers.findMany({ where: eq(projectMembers.projectId, developmentProjectId) }); assert.ok(members.length > 0);
    const roleWithMember = members.find((m) => m.role === "approver") ?? members[0];
    const heldRoles = new Set(members.map((m) => m.role));
    const roleWithNoMember = memberRole.enumValues.find((role) => !heldRoles.has(role));
    assert.ok(roleWithNoMember, "fixture project must have at least one member role unheld, to exercise the no-approver-member fallback");
    // A real project member distinct from the approvalRole holder, used as
    // requirement.reviewedBy for the fallback path.
    const reviewerFallback = members.find((m) => m.userId !== roleWithMember.userId) ?? roleWithMember;

    async function controlledRegion(projectId: string, documentType: string, title: string, text: string) {
      const token = randomUUID();
      const [document] = await db.insert(documents).values({ projectId, documentType, title }).returning(); documentIds.push(document.id);
      const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "Finding Fields Test", status: "approved", sha256: hash(`version:${token}`), objectKey: `${projectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
      const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(text) }).returning(); regionIds.push(region.id);
      return region;
    }

    const [gateWithApprover, gateWithNoMember] = await db.insert(gates).values([
      { projectId: developmentProjectId, systemId: system.id, name: `Finding fields gate (approver) ${randomUUID().slice(0, 8)}`, sequenceNumber: "90", approvalRole: roleWithMember.role },
      { projectId: developmentProjectId, systemId: system.id, name: `Finding fields gate (unheld role) ${randomUUID().slice(0, 8)}`, sequenceNumber: "91", approvalRole: roleWithNoMember! }
    ]).returning(); gateIds.push(gateWithApprover.id, gateWithNoMember.id);

    // req1: numeric deviation, gate whose approvalRole IS held -> owner should
    // be that approver; deterministic_flag -> severity high -> due in ~7 days.
    const req1Clause = await controlledRegion(developmentProjectId, "client_spec", "FF-1 client spec", "The operating pressure shall be 100 kPa plus or minus 2 kPa.");
    const req1Deviating = await controlledRegion(developmentProjectId, "shop_drawing", "FF-1 shop drawing", "Operating pressure: 120 kPa.");
    const [req1] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: req1Clause.id, statement: req1Clause.extractedText, modality: "shall", numericValue: "100", unit: "kPa", tolerance: "2", reviewState: "accepted", confidence: "1.0000" }).returning(); requirementIds.push(req1.id);
    const [edge1] = await db.insert(edges).values({ projectId: developmentProjectId, fromType: "requirement", fromId: req1.id, relationshipType: "AFFECTS", toType: "gate", toId: gateWithApprover.id }).returning(); edgeIds.push(edge1.id);

    // req2: qualitative mismatch, gate whose approvalRole has NO member, but
    // requirement.reviewedBy is a real member -> owner should fall back to
    // reviewedBy; possible_mismatch -> severity medium -> due in ~14 days.
    const req2Clause = await controlledRegion(developmentProjectId, "standard", "FF-2 controlled standard", "The enclosure finish shall be suitable for the operating environment.");
    const req2Deviating = await controlledRegion(developmentProjectId, "submittal", "FF-2 submittal", "Finish system: vendor marine coating arrangement.");
    const [req2] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: req2Clause.id, statement: req2Clause.extractedText, modality: "shall", reviewState: "accepted", reviewedBy: reviewerFallback.userId, confidence: "1.0000" }).returning(); requirementIds.push(req2.id);
    const [edge2] = await db.insert(edges).values({ projectId: developmentProjectId, fromType: "requirement", fromId: req2.id, relationshipType: "AFFECTS", toType: "gate", toId: gateWithNoMember.id }).returning(); edgeIds.push(edge2.id);

    // req3: numeric deviation, no gate edge at all, no reviewedBy -> owner
    // must be null (never fabricated), while dueAt is still populated.
    const req3Clause = await controlledRegion(developmentProjectId, "client_spec", "FF-3 client spec", "The operating pressure shall be 200 kPa plus or minus 2 kPa.");
    const req3Deviating = await controlledRegion(developmentProjectId, "shop_drawing", "FF-3 shop drawing", "Operating pressure: 260 kPa.");
    const [req3] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: req3Clause.id, statement: req3Clause.extractedText, modality: "shall", numericValue: "200", unit: "kPa", tolerance: "2", reviewState: "accepted", confidence: "1.0000" }).returning(); requirementIds.push(req3.id);

    const beforeReq1 = Date.now();
    const check1 = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: req1.id, targetSourceRegionId: req1Deviating.id }) });
    checkIds.push(check1.check.id); findingIds.push(check1.proposedFinding.id);
    assert.equal(check1.check.verdict, "deterministic_flag");
    assert.equal(check1.proposedFinding.severity, "high");
    assert.equal(check1.proposedFinding.ownerId, roleWithMember.userId);
    assert.ok(check1.proposedFinding.dueAt, "proposed finding must carry a due date");
    const dueAt1 = new Date(check1.proposedFinding.dueAt).getTime();
    assertWithinDays(dueAt1 - beforeReq1, 7);

    const beforeReq2 = Date.now();
    const check2 = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: req2.id, targetSourceRegionId: req2Deviating.id }) });
    checkIds.push(check2.check.id); findingIds.push(check2.proposedFinding.id);
    assert.equal(check2.check.verdict, "possible_mismatch");
    assert.equal(check2.proposedFinding.severity, "medium");
    assert.equal(check2.proposedFinding.ownerId, reviewerFallback.userId, "owner must fall back to the requirement's reviewedBy when the gate's approvalRole has no project member");
    const dueAt2 = new Date(check2.proposedFinding.dueAt).getTime();
    assertWithinDays(dueAt2 - beforeReq2, 14);
    assert.ok(dueAt2 - beforeReq2 > dueAt1 - beforeReq1, "a medium-severity finding must be due later than a high-severity one");

    const check3 = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: req3.id, targetSourceRegionId: req3Deviating.id }) });
    checkIds.push(check3.check.id); findingIds.push(check3.proposedFinding.id);
    assert.equal(check3.check.verdict, "deterministic_flag");
    assert.equal(check3.proposedFinding.ownerId, null, "with no gate approver and no reviewedBy, the owner must be null, never fabricated");
    assert.ok(check3.proposedFinding.dueAt);

    // Every non-null owner must be a real member of THIS project.
    for (const [label, ownerId] of [["req1", check1.proposedFinding.ownerId], ["req2", check2.proposedFinding.ownerId]] as const) {
      const membership = await db.query.projectMembers.findFirst({ where: eq(projectMembers.userId, ownerId) });
      assert.ok(membership, `${label} owner must exist as a project member row`);
      assert.equal(membership.projectId, developmentProjectId, `${label} owner must be scoped to the checked project, never cross-project`);
    }

    // Acceptance path, case A: a finding already proposed keeps its owner/due
    // date through human acceptance (parity, not regression).
    const accepted1 = await request(`${base}/api/compliance/checks/${check1.check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", expectedVersion: check1.check.version, note: "Engineer confirms the unit-normalized pressure deviation against both exact citations." }) });
    assert.equal(accepted1.finding.ownerId, roleWithMember.userId);
    assert.ok(accepted1.finding.dueAt);

    // Acceptance path, case B: a check that was NOT flagged at proposal time
    // (conforms, no proposedFinding) gets edited to a deviation on review —
    // the finding is created fresh in the review route itself, and must be
    // no less complete than the proposal path would have produced.
    const req1Conforming = await controlledRegion(developmentProjectId, "submittal", "FF-1 conforming submittal", "Operating pressure: 1 bar.");
    const conformsCheck = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: req1.id, targetSourceRegionId: req1Conforming.id }) });
    checkIds.push(conformsCheck.check.id);
    assert.equal(conformsCheck.check.verdict, "conforms");
    assert.equal(conformsCheck.check.proposedFindingId, null);
    const beforeEdit = Date.now();
    const editedToFlag = await request(`${base}/api/compliance/checks/${conformsCheck.check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit", expectedVersion: conformsCheck.check.version, note: "Engineer overrides: this normalized comparison is actually a deviation on closer reading of the source drawing.", finalVerdict: "deterministic_flag" }) });
    assert.ok(editedToFlag.finding, "editing a conforms verdict into a flag must create a finding in the review route itself");
    findingIds.push(editedToFlag.finding.id);
    assert.equal(editedToFlag.finding.ownerId, roleWithMember.userId, "a finding created fresh on the review path must derive an owner just like the proposal path");
    assert.ok(editedToFlag.finding.dueAt, "a finding created fresh on the review path must carry a due date just like the proposal path");
    assertWithinDays(new Date(editedToFlag.finding.dueAt).getTime() - beforeEdit, 7);

    console.log("Compliance finding-fields verification passed: proposed and human-accepted findings both carry a deterministic, project-scoped owner and a severity-derived due date.");
  } finally {
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (gateIds.length) await db.delete(gates).where(inArray(gates.id, gateIds));
  }
}

// Allows generous slack (the request round-trip plus clock skew) while still
// asserting the day-scale bucket the severity maps to, distinguishing 7 days
// from 14 unambiguously.
function assertWithinDays(actualMs: number, expectedDays: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  assert.ok(actualMs > (expectedDays - 0.5) * dayMs && actualMs < (expectedDays + 0.5) * dayMs, `expected dueAt roughly ${expectedDays} days out, got ${actualMs / dayMs} days`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
