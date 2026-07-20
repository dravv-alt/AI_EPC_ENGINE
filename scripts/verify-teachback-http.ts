import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { complianceChecks, compliancePrecedents, documentVersions, documents, edges, findings, gates, projectMembers, projects, requirements, sourceRegions, teachbackNotes, users } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

// Slice 8: generalizes the compliance-only teach-back mechanism
// (compliancePrecedents) to every AI proposal/disposition, via a new
// polymorphic `teachback_notes` table plus capture/surface wiring in the 7
// generic review routes (requirements, evidence, cx checklists, schedule
// tasks/resources/risks, compliance checks). `compliancePrecedents` is the
// specialized, exact-hash-matched compliance case and is left untouched.
//
// This script exercises the seam end-to-end over HTTP:
//   1. Rejecting a proposed requirement with a rationale creates a note.
//   2. Editing a proposed requirement with a rationale creates a note with
//      correctedTo populated.
//   3. Accepting a proposed requirement teaches nothing — no note.
//   4. A later, near-identical requirement in the same project surfaces the
//      rejected note as advisory context (never mutating the record).
//   5. The same near-identical text in a *different* project never surfaces
//      it — cross-project isolation.
//   6. The general mechanism also applies to compliance checks (one of the
//      7 generic routes), and the specialized compliancePrecedents path
//      keeps working exactly as before, alongside it.

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.TEACHBACK_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = [];
  const requirementIds: string[] = []; const noteIds: string[] = [];
  const checkIds: string[] = []; const precedentIds: string[] = []; const findingIds: string[] = []; const edgeIds: string[] = [];
  let otherProjectId: string | undefined; let otherMembershipId: string | undefined;

  async function controlledRegion(projectId: string, documentType: string, title: string, text: string) {
    const token = randomUUID();
    const [document] = await db.insert(documents).values({ projectId, documentType, title }).returning(); documentIds.push(document.id);
    const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "Teachback test", status: "approved", sha256: hash(`version:${token}`), objectKey: `${projectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
    const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(text) }).returning(); regionIds.push(region.id);
    return region;
  }

  try {
    const developmentProject = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) });
    assert.ok(developmentProject, "The seeded development project is required.");
    const devUser = await db.query.users.findFirst({ where: eq(users.email, "manager@pramana.local") });
    assert.ok(devUser, "The seeded development identity's user row is required.");

    // ── 1. Reject captures a teach-back note ──────────────────────────────
    const rejectedText = `Chiller ${tag}: Condenser water flow shall be 900 LPM at design load.`;
    const rejectedRegion = await controlledRegion(developmentProjectId, "spec", "Rejected requirement source", rejectedText);
    const [rejectedRequirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: rejectedRegion.id, statement: rejectedText, modality: "shall", reviewState: "proposed" }).returning();
    requirementIds.push(rejectedRequirement.id);

    const rejectRationale = `Rejected teachback test ${tag}: this reading conflicts with the as-built condenser loop capacity, confirmed against the mechanical schedule.`;
    const rejected = await request(`${base}/api/requirements/${rejectedRequirement.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reject", note: rejectRationale }) });
    assert.equal(rejected.requirement.reviewState, "rejected");

    const rejectedNotes = await db.select().from(teachbackNotes).where(eq(teachbackNotes.subjectId, rejectedRequirement.id));
    assert.equal(rejectedNotes.length, 1, "A rejection with a rationale must create exactly one teach-back note.");
    noteIds.push(rejectedNotes[0]!.id);
    assert.equal(rejectedNotes[0]!.subjectType, "requirement");
    assert.equal(rejectedNotes[0]!.rationale, rejectRationale);
    assert.equal(rejectedNotes[0]!.correctedTo, null, "A rejection has no corrected-to value.");
    assert.equal((rejectedNotes[0]!.correctedFrom as { statement: string }).statement, rejectedText);
    assert.equal(rejectedNotes[0]!.reviewState, "rejected");

    // ── 2. Edit captures a note with correctedTo populated ────────────────
    const editedText = `Pump ${tag}: Flow rate shall be 400 LPM at rated head.`;
    const editedRegion = await controlledRegion(developmentProjectId, "spec", "Edited requirement source", editedText);
    const [editedRequirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: editedRegion.id, statement: editedText, modality: "shall", reviewState: "proposed" }).returning();
    requirementIds.push(editedRequirement.id);
    const editRationale = `Edited teachback test ${tag}: corrected the normalized unit against the vendor curve.`;
    const editedStatement = `Pump ${tag}: Flow rate shall be 420 LPM at rated head, corrected from vendor curve.`;
    const edited = await request(`${base}/api/requirements/${editedRequirement.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit", statement: editedStatement, note: editRationale }) });
    assert.equal(edited.requirement.reviewState, "edited");
    const editedNotes = await db.select().from(teachbackNotes).where(eq(teachbackNotes.subjectId, editedRequirement.id));
    assert.equal(editedNotes.length, 1, "An edit with a rationale must create exactly one teach-back note.");
    noteIds.push(editedNotes[0]!.id);
    assert.equal((editedNotes[0]!.correctedTo as { statement: string }).statement, editedStatement, "An edit's teach-back note must capture the corrected-to value.");
    assert.equal(editedNotes[0]!.reviewState, "edited");

    // ── 3. Plain accept teaches nothing ────────────────────────────────────
    const acceptedText = `Sensor ${tag}: Ambient temperature reading shall report in Celsius.`;
    const acceptedRegion = await controlledRegion(developmentProjectId, "spec", "Accepted requirement source", acceptedText);
    const [acceptedRequirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: acceptedRegion.id, statement: acceptedText, modality: "shall", reviewState: "proposed" }).returning();
    requirementIds.push(acceptedRequirement.id);
    const accepted = await request(`${base}/api/requirements/${acceptedRequirement.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) });
    assert.equal(accepted.requirement.reviewState, "accepted");
    const acceptedNotes = await db.select().from(teachbackNotes).where(eq(teachbackNotes.subjectId, acceptedRequirement.id));
    assert.equal(acceptedNotes.length, 0, "Accepting a proposal must never capture a teach-back note.");

    // ── 4. Surfacing: a similar future requirement sees the rejected note ──
    // The mock embedding provider is a deterministic hash of exact text (no
    // real semantic model available offline), so — exactly like every other
    // verify script in this repo that exercises cosine similarity
    // (verify-rfi-similar-http.ts, verify-knowledge-http.ts) — "similar
    // enough to match" here means the same statement text recurring on a
    // later requirement, which is precisely the teach-back scenario: the
    // same AI proposal text appearing again.
    const similarText = rejectedText;
    const similarRegion = await controlledRegion(developmentProjectId, "spec", "Similar future requirement source", similarText);
    const [similarRequirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: similarRegion.id, statement: similarText, modality: "shall", reviewState: "proposed" }).returning();
    requirementIds.push(similarRequirement.id);
    const advisoryBefore = await request(`${base}/api/requirements/${similarRequirement.id}/review`);
    assert.ok(Array.isArray(advisoryBefore.advisory), "The advisory endpoint must return an array.");
    assert.ok(advisoryBefore.advisory.some((note: { id: string }) => note.id === rejectedNotes[0]!.id), "A near-identical future requirement must surface the prior rejection as advisory context.");

    // The GET is read-only: the reviewed record must be untouched.
    const untouched = await db.query.requirements.findFirst({ where: eq(requirements.id, similarRequirement.id) });
    assert.equal(untouched?.reviewState, "proposed", "Surfacing advisory context must never change the reviewed record's state.");

    // ── 5. Cross-project isolation ─────────────────────────────────────────
    const [otherProject] = await db.insert(projects).values({ tenantId: developmentProject.tenantId, name: `Teachback cross-project ${tag}`, code: `TBX-${tag}`, timezone: "UTC" }).returning();
    otherProjectId = otherProject.id;
    const [membership] = await db.insert(projectMembers).values({ projectId: otherProject.id, userId: devUser.id, role: "commissioning_manager" }).returning();
    otherMembershipId = membership.id;
    const crossProjectRegion = await controlledRegion(otherProject.id, "spec", "Cross-project requirement source", similarText);
    const [crossProjectRequirement] = await db.insert(requirements).values({ projectId: otherProject.id, sourceRegionId: crossProjectRegion.id, statement: similarText, modality: "shall", reviewState: "proposed" }).returning();
    requirementIds.push(crossProjectRequirement.id);
    const crossProjectAdvisory = await request(`${base}/api/requirements/${crossProjectRequirement.id}/review`);
    assert.ok(!crossProjectAdvisory.advisory.some((note: { id: string }) => note.id === rejectedNotes[0]!.id), "A note from one project must never surface for a different project's review.");

    // ── 6. General mechanism reaches compliance checks; the specialized
    //       compliancePrecedents path keeps working unchanged alongside it ──
    const gate = await db.query.gates.findFirst({ where: eq(gates.projectId, developmentProjectId) });
    assert.ok(gate, "A seeded gate is required.");
    const numericClause = await controlledRegion(developmentProjectId, "client_spec", "Teachback compliance clause", `Operating pressure ${tag} shall be 100 kPa plus or minus 2 kPa.`);
    const deviatingLine = await controlledRegion(developmentProjectId, "shop_drawing", "Teachback compliance shop drawing", "Operating pressure: 120 kPa.");
    const qualitativeClause = await controlledRegion(developmentProjectId, "standard", "Teachback qualitative clause", `The enclosure finish ${tag} shall be suitable for the operating environment.`);
    const qualitativeLine = await controlledRegion(developmentProjectId, "submittal", "Teachback qualitative submittal", "Finish system: vendor marine coating arrangement.");
    const [numericRequirement, qualitativeRequirement] = await db.insert(requirements).values([
      { projectId: developmentProjectId, sourceRegionId: numericClause.id, statement: numericClause.extractedText, modality: "shall", numericValue: "100", unit: "kPa", tolerance: "2", reviewState: "accepted", confidence: "1.0000" },
      { projectId: developmentProjectId, sourceRegionId: qualitativeClause.id, statement: qualitativeClause.extractedText, modality: "shall", reviewState: "accepted", confidence: "1.0000" }
    ]).returning();
    requirementIds.push(numericRequirement.id, qualitativeRequirement.id);
    const [edge] = await db.insert(edges).values({ projectId: developmentProjectId, fromType: "requirement", fromId: numericRequirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gate.id }).returning();
    edgeIds.push(edge.id);

    const deviating = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: deviatingLine.id }) });
    checkIds.push(deviating.check.id); findingIds.push(deviating.proposedFinding.id);
    const editRationaleCheck = `Teachback compliance edit ${tag}: engineer re-derives the deviation as a possible mismatch pending vendor confirmation.`;
    const editedCheck = await request(`${base}/api/compliance/checks/${deviating.check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit", expectedVersion: deviating.check.version, finalVerdict: "possible_mismatch", note: editRationaleCheck }) });
    assert.equal(editedCheck.check.reviewState, "edited");
    const checkNotes = await db.select().from(teachbackNotes).where(eq(teachbackNotes.subjectId, deviating.check.id));
    assert.equal(checkNotes.length, 1, "Editing a compliance check with a rationale must create a teach-back note (the general case).");
    noteIds.push(checkNotes[0]!.id);
    assert.equal(checkNotes[0]!.subjectType, "compliance_check");
    assert.equal((checkNotes[0]!.correctedTo as { verdict: string }).verdict, "possible_mismatch");

    // The specialized compliancePrecedents path — untouched by any of the
    // above — still runs its own exact-hash-matched propose/accept flow.
    const qualitative = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: qualitativeRequirement.id, targetSourceRegionId: qualitativeLine.id }) });
    checkIds.push(qualitative.check.id); findingIds.push(qualitative.proposedFinding.id);
    const proposedPrecedent = await request(`${base}/api/projects/${developmentProjectId}/compliance/precedents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkId: qualitative.check.id, title: `Teachback precedent regression ${tag}`, rationale: "Engineer compared the cited coating system and controlled environmental suitability clause and determined them equivalent for this scoped application." }) });
    precedentIds.push(proposedPrecedent.precedent.id);
    assert.equal(proposedPrecedent.precedent.reviewState, "proposed");
    const approvedPrecedent = await request(`${base}/api/compliance/precedents/${proposedPrecedent.precedent.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", note: "Approved as an exact-citation, project-scoped equality precedent after engineering review." }) });
    assert.equal(approvedPrecedent.precedent.reviewState, "accepted", "compliancePrecedents accept flow must behave exactly as before Slice 8.");
    assert.equal(approvedPrecedent.check.verdict, "equivalent_by_precedent");
    assert.equal(approvedPrecedent.finding.status, "dismissed");
    // The specialized path never writes to the general teach-back table.
    const precedentGeneralNotes = await db.select().from(teachbackNotes).where(eq(teachbackNotes.subjectId, proposedPrecedent.precedent.id));
    assert.equal(precedentGeneralNotes.length, 0, "compliancePrecedents accept/reject must never write a generalized teach-back note for itself.");

    console.log("Teach-back generalization verified: reject/edit capture rationale with before/after values, plain accept captures nothing, a near-identical future requirement surfaces the prior note as read-only advisory context, cross-project notes never leak, the general mechanism reaches compliance checks, and the specialized compliancePrecedents path is untouched.");
  } finally {
    if (noteIds.length) await db.delete(teachbackNotes).where(inArray(teachbackNotes.id, noteIds));
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (precedentIds.length) await db.delete(compliancePrecedents).where(inArray(compliancePrecedents.id, precedentIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (otherMembershipId) await db.delete(projectMembers).where(eq(projectMembers.id, otherMembershipId));
    if (otherProjectId) await db.delete(projects).where(eq(projects.id, otherProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
