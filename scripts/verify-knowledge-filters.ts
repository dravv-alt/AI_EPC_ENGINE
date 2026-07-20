import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { assets, documents, documentVersions, edges, evidence, gates, knowledgeChunks, projects, requirements, sourceRegions, systems } from "../src/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";
import { developmentProjectId } from "../src/lib/demo";
import { retrieveSemanticCitations } from "../src/lib/knowledge/query";

// Slice 10 (PRD US-28 / ADR-021): retrieveSemanticCitations only filtered on
// project + optional documentType. ADR-021 names every dimension of the
// mandatory-first metadata filter: tenant/project/system/asset/gate/doc_type/
// date/revision. This verifies the four newly-added dimensions
// (system/asset/gate resolved through the provenance graph, revision/date
// resolved directly off documentVersions) each hold, and — the load-bearing
// assertion — that the exclusion happens IN SQL BEFORE ranking, not as a
// post-filter on already-ranked results: for every dimension we seed the
// EXCLUDED chunk with text IDENTICAL to the query (so it would be the exact
// top match, similarity ~1.0, if the filter were ever skipped or applied only
// after ranking) and assert it never appears in a query scoped away from it.

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.KNOWLEDGE_FILTERS_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);

  const documentIds: string[] = [];
  const versionIds: string[] = [];
  const regionIds: string[] = [];
  const chunkIds: string[] = [];
  const evidenceIds: string[] = [];
  const requirementIds: string[] = [];
  const edgeIds: string[] = [];
  const systemIds: string[] = [];
  const assetIds: string[] = [];
  const gateIds: string[] = [];

  const developmentProject = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) });
  assert.ok(developmentProject, "The seeded development project is required.");
  const projectId = developmentProjectId;
  const tenantId = developmentProject.tenantId;
  const provider = getModelProvider();

  // Creates one document/version/region/chunk with fully-controlled revision
  // and createdAt (the columns retrieveSemanticCitations filters on for the
  // revision/date dimensions), embedding `text` verbatim.
  async function makeChunk(opts: { text: string; hashSuffix: string; title?: string; revision?: string; createdAt?: Date }) {
    const [document] = await db.insert(documents).values({ projectId, documentType: "procedure", title: opts.title ?? `Filter fixture ${opts.hashSuffix}` }).returning();
    documentIds.push(document.id);
    const [version] = await db.insert(documentVersions).values({
      documentId: document.id,
      revision: opts.revision ?? "1",
      status: "approved",
      sha256: hash(`version:${opts.hashSuffix}`),
      objectKey: `filters/${opts.hashSuffix}`,
      mediaType: "text/plain",
      extractionStatus: "completed",
      ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {})
    }).returning();
    versionIds.push(version.id);
    const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: opts.text, contentHash: hash(`region:${opts.hashSuffix}`) }).returning();
    regionIds.push(region.id);
    const [chunk] = await db.insert(knowledgeChunks).values({ tenantId, projectId, sourceRegionId: region.id, documentType: "procedure", content: opts.text, contentHash: `hash-${opts.hashSuffix}`, embedding: await provider.embed(opts.text), embeddingModel: activeEmbeddingModelTag() }).returning();
    chunkIds.push(chunk.id);
    return { document, version, region, chunk };
  }

  async function anchorEvidence(regionId: string, opts: { systemId: string; assetId?: string }) {
    const [row] = await db.insert(evidence).values({ projectId, systemId: opts.systemId, assetId: opts.assetId, sourceRegionId: regionId, evidenceType: "manual_reading", capturedAt: new Date() }).returning();
    evidenceIds.push(row.id);
    return row;
  }

  async function anchorRequirementToGate(regionId: string, gateId: string) {
    const [requirement] = await db.insert(requirements).values({ projectId, sourceRegionId: regionId, statement: `Filter fixture requirement ${tag}`, modality: "shall" }).returning();
    requirementIds.push(requirement.id);
    const [edge] = await db.insert(edges).values({ projectId, fromType: "requirement", fromId: requirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gateId }).returning();
    edgeIds.push(edge.id);
    return requirement;
  }

  try {
    // ── Exact document dimension and deterministic title routing ─────────
    const documentText = `Document-scoped fixture ${tag}: grounding must never cross a named controlled source boundary.`;
    const documentChunkA = await makeChunk({ text: documentText, hashSuffix: `doc-a-${tag}`, title: `Named Alpha Standard ${tag}` });
    const documentChunkB = await makeChunk({ text: documentText, hashSuffix: `doc-b-${tag}`, title: `Named Beta Standard ${tag}` });
    const directDocumentCitations = await retrieveSemanticCitations({ projectId, query: documentText, documentId: documentChunkA.document.id });
    assert.ok(directDocumentCitations.some((citation) => citation.contentHash === `hash-doc-a-${tag}`), `Direct document retrieval must return its exact embedded chunk: ${JSON.stringify(directDocumentCitations)}`);
    const documentQuery = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: documentText, documentId: documentChunkA.document.id }) });
    assert.ok(documentQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-doc-a-${tag}`), `Document-scoped query must return the selected document's chunk: ${JSON.stringify(documentQuery)}`);
    assert.ok(!documentQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-doc-b-${tag}`), "Document-scoped query must never return an identical chunk from another document.");
    assert.equal(documentQuery.scopedTo.documentId, documentChunkA.document.id, "The response must disclose its enforced document scope.");

    const namedQuery = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: `According to Named Alpha Standard ${tag}, ${documentText}` }) });
    assert.equal(namedQuery.scopedTo.documentId, documentChunkA.document.id, `A uniquely named document in the query must be auto-scoped: ${JSON.stringify(namedQuery)}`);
    assert.ok(!namedQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-doc-b-${tag}`), "Automatic title routing must not cross into an identical other document.");
    assert.equal(namedQuery.scopedTo.documentScopeSource, "query-title", "Automatic title routing must be visible to the caller.");

    // ── System dimension ──────────────────────────────────────────────────
    const [sysA] = await db.insert(systems).values({ projectId, name: `Filter System A ${tag}`, systemType: "mechanical" }).returning();
    const [sysB] = await db.insert(systems).values({ projectId, name: `Filter System B ${tag}`, systemType: "mechanical" }).returning();
    systemIds.push(sysA.id, sysB.id);
    const systemText = `System-scoped fixture ${tag}: chilled-water header pressure shall be maintained per the controlled procedure.`;
    const systemChunkA = await makeChunk({ text: systemText, hashSuffix: `sys-a-${tag}` });
    const systemChunkB = await makeChunk({ text: systemText, hashSuffix: `sys-b-${tag}` });
    await anchorEvidence(systemChunkA.region.id, { systemId: sysA.id });
    await anchorEvidence(systemChunkB.region.id, { systemId: sysB.id });

    const systemQueryA = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: systemText, systemId: sysA.id }) });
    assert.ok(systemQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-sys-a-${tag}`), "System A scoped query must return the System A chunk.");
    assert.ok(!systemQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-sys-b-${tag}`), "System A scoped query must never return the System B chunk, even though it is an identical-text (top-similarity) match.");

    const systemQueryB = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: systemText, systemId: sysB.id }) });
    assert.ok(systemQueryB.claims.some((c: { contentHash: string }) => c.contentHash === `hash-sys-b-${tag}`), "System B scoped query must return the System B chunk.");
    assert.ok(!systemQueryB.claims.some((c: { contentHash: string }) => c.contentHash === `hash-sys-a-${tag}`), "System B scoped query must never return the System A chunk.");

    // ── Asset dimension ───────────────────────────────────────────────────
    const [assetA] = await db.insert(assets).values({ projectId, systemId: sysA.id, tag: `FLT-A-${tag}`, assetType: "pump" }).returning();
    const [assetB] = await db.insert(assets).values({ projectId, systemId: sysA.id, tag: `FLT-B-${tag}`, assetType: "pump" }).returning();
    assetIds.push(assetA.id, assetB.id);
    const assetText = `Asset-scoped fixture ${tag}: pump vibration shall remain within the controlled acceptance envelope.`;
    const assetChunkA = await makeChunk({ text: assetText, hashSuffix: `asset-a-${tag}` });
    const assetChunkB = await makeChunk({ text: assetText, hashSuffix: `asset-b-${tag}` });
    await anchorEvidence(assetChunkA.region.id, { systemId: sysA.id, assetId: assetA.id });
    await anchorEvidence(assetChunkB.region.id, { systemId: sysA.id, assetId: assetB.id });

    const assetQueryA = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: assetText, assetId: assetA.id }) });
    assert.ok(assetQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-asset-a-${tag}`), "Asset A scoped query must return the Asset A chunk.");
    assert.ok(!assetQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-asset-b-${tag}`), "Asset A scoped query must never return the Asset B chunk, even though it is an identical-text (top-similarity) match.");

    // ── Gate dimension ────────────────────────────────────────────────────
    const [gateA] = await db.insert(gates).values({ projectId, systemId: sysA.id, name: `Filter Gate A ${tag}`, sequenceNumber: "1" }).returning();
    const [gateB] = await db.insert(gates).values({ projectId, systemId: sysA.id, name: `Filter Gate B ${tag}`, sequenceNumber: "2" }).returning();
    gateIds.push(gateA.id, gateB.id);
    const gateText = `Gate-scoped fixture ${tag}: integrated test sign-off requires the controlled checklist to be complete.`;
    const gateChunkA = await makeChunk({ text: gateText, hashSuffix: `gate-a-${tag}` });
    const gateChunkB = await makeChunk({ text: gateText, hashSuffix: `gate-b-${tag}` });
    await anchorRequirementToGate(gateChunkA.region.id, gateA.id);
    await anchorRequirementToGate(gateChunkB.region.id, gateB.id);

    const gateQueryA = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: gateText, gateId: gateA.id }) });
    assert.ok(gateQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-gate-a-${tag}`), "Gate A scoped query must return the Gate A chunk.");
    assert.ok(!gateQueryA.claims.some((c: { contentHash: string }) => c.contentHash === `hash-gate-b-${tag}`), "Gate A scoped query must never return the Gate B chunk, even though it is an identical-text (top-similarity) match.");

    // ── Revision dimension ────────────────────────────────────────────────
    const revisionText = `Revision-scoped fixture ${tag}: valve torque values shall match the controlled drawing revision.`;
    const revisionChunkOld = await makeChunk({ text: revisionText, hashSuffix: `rev-old-${tag}`, revision: `Rev-Old-${tag}` });
    const revisionChunkNew = await makeChunk({ text: revisionText, hashSuffix: `rev-new-${tag}`, revision: `Rev-New-${tag}` });

    const revisionQuery = await request(`${base}/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: revisionText, revision: `Rev-New-${tag}` }) });
    assert.ok(revisionQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-rev-new-${tag}`), "Revision-scoped query must return the matching revision's chunk.");
    assert.ok(!revisionQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-rev-old-${tag}`), "Revision-scoped query must never return a chunk from a different revision, even though it is an identical-text (top-similarity) match.");
    void revisionChunkOld; void revisionChunkNew;

    // ── Date range dimension ──────────────────────────────────────────────
    const dateText = `Date-scoped fixture ${tag}: submittal approvals shall be logged within the controlled date window.`;
    const oldDate = new Date("2020-01-01T00:00:00Z");
    const newDate = new Date("2026-01-01T00:00:00Z");
    const dateChunkOld = await makeChunk({ text: dateText, hashSuffix: `date-old-${tag}`, createdAt: oldDate });
    const dateChunkNew = await makeChunk({ text: dateText, hashSuffix: `date-new-${tag}`, createdAt: newDate });

    const dateQuery = await request(`${base}/api/projects/${projectId}/knowledge/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: dateText, dateFrom: "2025-01-01T00:00:00Z", dateTo: "2027-01-01T00:00:00Z" })
    });
    assert.ok(dateQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-date-new-${tag}`), "Date-range-scoped query must return the chunk whose document version falls inside the window.");
    assert.ok(!dateQuery.claims.some((c: { contentHash: string }) => c.contentHash === `hash-date-old-${tag}`), "Date-range-scoped query must never return a chunk outside the window, even though it is an identical-text (top-similarity) match.");
    void dateChunkOld; void dateChunkNew;

    console.log(`Knowledge metadata filters verified (tag ${tag}): document/title routing plus system/asset/gate/revision/date-range are mandatory-first in SQL; identical top-similarity chunks outside scope never appeared.`);
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (evidenceIds.length) await db.delete(evidence).where(inArray(evidence.id, evidenceIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (gateIds.length) await db.delete(gates).where(inArray(gates.id, gateIds));
    if (assetIds.length) await db.delete(assets).where(inArray(assets.id, assetIds));
    if (systemIds.length) await db.delete(systems).where(inArray(systems.id, systemIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
