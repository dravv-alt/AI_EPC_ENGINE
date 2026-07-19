import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { complianceChecks, documentVersions, documents, findings, knowledgeChunks, projectMembers, projects, requirements, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit, expectedStatus?: number) { const response = await fetch(url, init); const body = await response.json(); if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(body)); else if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`); return body; }
async function post(base: string, path: string, body: unknown) { return request(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }

async function pollJob(base: string, jobId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await request(`${base}/api/jobs/${jobId}`);
    if (result.job.status === "completed") return result.job;
    if (result.job.status === "failed") throw new Error(`Compliance candidate job ${jobId} failed: ${result.job.error}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Compliance candidate job ${jobId} timed out.`);
}

// Slice 5: semantic candidate discovery. Given an accepted requirement,
// discoverCandidateTargets searches only submittal/po/shop_drawing/drawing
// knowledge chunks (project-scoped, metadata-filtered before ranking) and
// POST /compliance/scan enqueues one durable "compliance.check.candidate" job
// per candidate pair -- idempotent on (requirementId, targetSourceRegionId),
// so re-running a scan never creates duplicate compliance_checks rows.
async function main() {
  const base = process.env.COMPLIANCE_SCAN_TEST_URL ?? "http://localhost:4173";
  const tag = randomUUID().slice(0, 8);
  const documentIds: string[] = [];
  const versionIds: string[] = [];
  const regionIds: string[] = [];
  const chunkIds: string[] = [];
  const requirementIds: string[] = [];
  const checkIds: string[] = [];
  const findingIds: string[] = [];
  let crossProjectId: string | undefined;
  let emptyProjectId: string | undefined;

  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) });
    assert.ok(project, "The seeded development project is required.");
    const owner = await db.query.projectMembers.findFirst({ where: eq(projectMembers.projectId, developmentProjectId) });
    assert.ok(owner, "The seeded development project requires a member to reuse for the throwaway projects.");
    const provider = getModelProvider();
    const modelTag = activeEmbeddingModelTag();

    const requirementStatement = `Semantic discovery verification requirement ${tag}: cooling water flow shall be 450 LPM at rated load, matched against the submitted vendor documentation.`;

    async function controlledRegion(projectId: string, documentType: string, title: string, text: string) {
      const [document] = await db.insert(documents).values({ projectId, documentType, title }).returning(); documentIds.push(document.id);
      const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "Scan Test", status: "approved", sha256: hash(`version:${tag}:${randomUUID()}`), objectKey: `${projectId}/${hash(randomUUID())}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
      const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(`${title}:${randomUUID()}`) }).returning(); regionIds.push(region.id);
      return region;
    }

    async function chunk(projectId: string, tenantId: string, sourceRegionId: string, documentType: string, content: string, hashSuffix: string) {
      const embedding = await provider.embed(content);
      const [row] = await db.insert(knowledgeChunks).values({ tenantId, projectId, sourceRegionId, documentType, content, contentHash: `hash-scan-${tag}-${hashSuffix}`, embedding, embeddingModel: modelTag }).returning();
      chunkIds.push(row.id);
      return row;
    }

    // The requirement's own citation source. A knowledge chunk is also indexed
    // against this exact region tagged documentType "submittal" with
    // identical, maximally-similar text -- this is the self-exclusion trap: a
    // requirement must never be proposed as a candidate against its own
    // citation, even when it is the single best-matching submittal chunk.
    const ownRegion = await controlledRegion(developmentProjectId, "client_spec", `Scan verification client spec ${tag}`, requirementStatement);
    await chunk(developmentProjectId, project.tenantId, ownRegion.id, "submittal", requirementStatement, "self");

    const [requirement] = await db.insert(requirements).values({ projectId: developmentProjectId, sourceRegionId: ownRegion.id, statement: requirementStatement, modality: "shall", numericValue: "450", unit: "l/s", tolerance: "5", reviewState: "accepted", confidence: "1.0000" }).returning();
    requirementIds.push(requirement.id);

    // Three legitimate candidate document types.
    const poRegion = await controlledRegion(developmentProjectId, "po", `Scan verification PO ${tag}`, "Cooling water flow: 450 LPM confirmed by vendor.");
    await chunk(developmentProjectId, project.tenantId, poRegion.id, "po", requirementStatement, "po");
    const shopDrawingRegion = await controlledRegion(developmentProjectId, "shop_drawing", `Scan verification shop drawing ${tag}`, "Cooling water flow: 450 LPM as drawn.");
    await chunk(developmentProjectId, project.tenantId, shopDrawingRegion.id, "shop_drawing", requirementStatement, "shopdrawing");
    const drawingRegion = await controlledRegion(developmentProjectId, "drawing", `Scan verification drawing ${tag}`, "Cooling water flow: 450 LPM per P&ID.");
    await chunk(developmentProjectId, project.tenantId, drawingRegion.id, "drawing", requirementStatement, "drawing");

    // A wrong document type (standard) with an identical, maximally-similar
    // text: must never surface as a discovery candidate, regardless of
    // similarity, because the metadata filter runs in SQL before ranking.
    const standardRegion = await controlledRegion(developmentProjectId, "standard", `Scan verification standard ${tag}`, requirementStatement);
    await chunk(developmentProjectId, project.tenantId, standardRegion.id, "standard", requirementStatement, "wrongtype");

    // A cross-project submittal chunk with identical, maximally-similar text:
    // must never surface regardless of similarity or document type.
    const [crossProject] = await db.insert(projects).values({ tenantId: project.tenantId, name: `Compliance scan cross-project check ${tag}`, code: `CSC-${tag}`, timezone: "UTC" }).returning();
    crossProjectId = crossProject.id;
    const crossRegion = await controlledRegion(crossProject.id, "submittal", `Scan verification cross-project submittal ${tag}`, requirementStatement);
    await chunk(crossProject.id, crossProject.tenantId, crossRegion.id, "submittal", requirementStatement, "cross");

    // --- First scan: discovers candidates, enqueues one job per pair ---
    const firstScan = await post(base, `/api/projects/${developmentProjectId}/compliance/scan`, { requirementIds: [requirement.id], limit: 5 });
    assert.equal(firstScan.requirementsScanned, 1, "The seeded accepted requirement must be scanned.");
    assert.ok(firstScan.candidatesFound >= 3, `Expected at least the three legitimate candidates (got ${firstScan.candidatesFound}).`);

    const candidateRegionIds = new Set(firstScan.items.map((item: { targetSourceRegionId: string }) => item.targetSourceRegionId));
    assert.ok(candidateRegionIds.has(poRegion.id), "The PO candidate must be discovered.");
    assert.ok(candidateRegionIds.has(shopDrawingRegion.id), "The shop-drawing candidate must be discovered.");
    assert.ok(candidateRegionIds.has(drawingRegion.id), "The drawing candidate must be discovered.");
    assert.ok(!candidateRegionIds.has(standardRegion.id), "A wrong-document-type region must never be a discovery candidate.");
    assert.ok(!candidateRegionIds.has(crossRegion.id), "A cross-project region must never be a discovery candidate.");
    assert.ok(!candidateRegionIds.has(ownRegion.id), "The requirement's own citation source region must never be proposed as its own candidate target.");

    for (const item of firstScan.items) {
      const job = await pollJob(base, item.jobId);
      assert.equal(job.status, "completed", `Candidate job for target ${item.targetSourceRegionId} must complete.`);
    }

    const checksAfterFirstScan = await db.select().from(complianceChecks).where(and(eq(complianceChecks.projectId, developmentProjectId), eq(complianceChecks.requirementId, requirement.id)));
    checkIds.push(...checksAfterFirstScan.map((check) => check.id));
    for (const check of checksAfterFirstScan) if (check.proposedFindingId) findingIds.push(check.proposedFindingId);
    assert.equal(checksAfterFirstScan.length, firstScan.candidatesFound, "One compliance check must exist per discovered candidate after the first scan.");

    // --- Second scan: same requirement, same candidates -> no duplicates ---
    const secondScan = await post(base, `/api/projects/${developmentProjectId}/compliance/scan`, { requirementIds: [requirement.id], limit: 5 });
    assert.equal(secondScan.candidatesFound, firstScan.candidatesFound, "Re-running the scan must discover the same candidate set.");
    assert.equal(secondScan.jobsDuplicate, secondScan.candidatesFound, "Every candidate pair must be recognized as an idempotency duplicate on a re-scan.");
    for (const item of secondScan.items) if (!item.duplicate) await pollJob(base, item.jobId);

    const checksAfterSecondScan = await db.select().from(complianceChecks).where(and(eq(complianceChecks.projectId, developmentProjectId), eq(complianceChecks.requirementId, requirement.id)));
    assert.equal(checksAfterSecondScan.length, checksAfterFirstScan.length, "Re-running the scan for the same requirement must not create duplicate compliance_checks rows.");

    // --- Zero accepted requirements: empty scan, HTTP 200, not an error ---
    const [emptyProject] = await db.insert(projects).values({ tenantId: project.tenantId, name: `Compliance scan empty project ${tag}`, code: `CSE-${tag}`, timezone: "UTC" }).returning();
    emptyProjectId = emptyProject.id;
    await db.insert(projectMembers).values({ projectId: emptyProject.id, userId: owner.userId, role: "admin" });
    const emptyScan = await post(base, `/api/projects/${emptyProject.id}/compliance/scan`, {});
    assert.equal(emptyScan.requirementsScanned, 0, "A project with zero accepted requirements must scan nothing.");
    assert.equal(emptyScan.candidatesFound, 0, "A project with zero accepted requirements must find zero candidates.");

    console.log(`Compliance scan HTTP verification passed: discovery limited to submittal/po/shop_drawing/drawing, cross-project and wrong-type and self-citation regions excluded, idempotent re-scan created no duplicate checks (${checksAfterFirstScan.length} checks), empty-project scan returned 200 with zero candidates.`);
  } finally {
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (emptyProjectId) await db.delete(projectMembers).where(eq(projectMembers.projectId, emptyProjectId));
    if (emptyProjectId) await db.delete(projects).where(eq(projects.id, emptyProjectId));
    if (crossProjectId) await db.delete(projects).where(eq(projects.id, crossProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
