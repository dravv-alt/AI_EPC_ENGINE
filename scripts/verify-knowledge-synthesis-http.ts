import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { documents, documentVersions, knowledgeChunks, projects, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { filterGroundedClaims } from "../src/lib/knowledge/pipeline";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";

// Slice 3: the cited-answer pipeline (plan call -> retrieval -> synthesis
// call -> deterministic groundedness filter). MODEL_PROVIDER=mock makes both
// LLM calls deterministic (plan reduces to a single sub-query, synthesis
// reduces to one claim per retrieved chunk citing its own region), so mock
// mode must reproduce the pre-Slice-3 route's concatenation-style output
// closely enough that verify-knowledge-query-http.ts's assertions still hold.
// The groundedness filter itself -- the load-bearing part -- cannot be
// exercised end-to-end in mock mode (mock synthesis never fabricates a
// citation), so it's asserted directly as a unit-level check against the
// exported filterGroundedClaims helper.

async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function post(base: string, path: string, body: unknown) {
  return request(base, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function firstSourceRegion(projectId: string): Promise<string> {
  const [row] = await db.select({ id: sourceRegions.id }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).limit(1);
  assert.ok(row, "A source region is required to anchor a knowledge chunk.");
  return row.id;
}

// ── Part A: unit-level groundedness filter ──────────────────────────────────
function assertGroundednessFilter() {
  const realRegion = randomUUID();
  const fabricatedRegion = randomUUID();
  const allowed = new Set([realRegion]);

  // A fully grounded claim survives.
  const clean = { text: "A clean, fully grounded claim.", citations: [realRegion] };
  // A claim citing a region outside the retrieved set must be dropped whole.
  const fabricated = { text: "A claim citing a fabricated region.", citations: [fabricatedRegion] };
  // A mixed claim -- one real citation, one fabricated -- must also be
  // dropped whole: a claim can't be trusted piecemeal.
  const mixed = { text: "A mixed claim with one real and one fabricated citation.", citations: [realRegion, fabricatedRegion] };

  const { grounded, droppedCount } = filterGroundedClaims([clean, fabricated, mixed], allowed);
  assert.equal(grounded.length, 1, "Only the fully grounded claim must survive.");
  assert.equal(grounded[0].text, clean.text, "The surviving claim must be the clean one.");
  assert.equal(droppedCount, 2, "Both the fabricated and mixed claims must be counted as dropped.");

  // All-fabricated -> zero survivors.
  const { grounded: allDropped, droppedCount: allDroppedCount } = filterGroundedClaims([fabricated, mixed], allowed);
  assert.equal(allDropped.length, 0, "An all-fabricated claim set must leave zero survivors.");
  assert.equal(allDroppedCount, 2, "Every claim in an all-fabricated set must be counted as dropped.");

  console.log("Groundedness filter (unit): mixed and fabricated claims dropped whole, clean claims survive — OK");
}

async function main() {
  assertGroundednessFilter();

  const base = process.env.KNOWLEDGE_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const matchText = `Synthesis verification chunk ${tag}: chilled-water pumps shall maintain 450 LPM during the integrated test.`;
  const otherText = `Unrelated synthesis chunk ${tag}: fire suppression agent concentration reaches seven percent within ten seconds.`;
  const chunkIds: string[] = [];
  let crossProjectId: string | undefined;

  try {
    const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(project, "The seeded development project is required.");
    const provider = getModelProvider();
    const regionId = await firstSourceRegion(project.id);

    const seeded = await db.insert(knowledgeChunks).values([
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: regionId, documentType: "procedure", content: matchText, contentHash: `hash-syn-match-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() },
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: regionId, documentType: "procedure", content: otherText, contentHash: `hash-syn-other-${tag}`, embedding: await provider.embed(otherText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...seeded.map((row) => row.id));

    // A dedicated throwaway project so the cross-project assertion doesn't
    // depend on unordered leftover rows from other verify scripts.
    const [crossProject] = await db.insert(projects).values({ tenantId: project.tenantId, name: `Synthesis cross-project check ${tag}`, code: `SYN-${tag}`, timezone: "UTC" }).returning();
    crossProjectId = crossProject.id;
    const crossSeeded = await db.insert(knowledgeChunks).values([
      { tenantId: crossProject.tenantId, projectId: crossProject.id, sourceRegionId: regionId, documentType: "procedure", content: matchText, contentHash: `hash-syn-cross-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...crossSeeded.map((row) => row.id));

    // 1. Mock-mode pipeline reproduces pre-existing route output: the exact
    //    match ranks first at ~1.0 similarity, every claim carries region +
    //    document-version + content-hash metadata, and cross-project regions
    //    never leak in.
    const result = await post(base, `/api/projects/${project.id}/knowledge/query`, { query: matchText, documentType: "procedure" });
    assert.ok(Array.isArray(result.claims) && result.claims.length >= 1, "Synthesis must return claims when citations exist.");
    const top = result.claims[0];
    assert.equal(top.content ?? top.text, matchText, "The exact-text query must rank the identical chunk first through synthesis.");
    assert.equal(typeof top.similarity, "number", "Each claim must expose a numeric similarity score.");
    assert.ok(top.similarity > 0.99, `The identical chunk's similarity must be ~1.0 (got ${top.similarity}).`);
    assert.equal(typeof top.sourceRegionId, "string", "Every claim must carry a sourceRegionId.");
    assert.ok("documentVersionId" in top, "Every claim must carry a documentVersionId (revision reference).");
    assert.equal(typeof top.contentHash, "string", "Every claim must carry a contentHash.");
    assert.equal(typeof result.answer, "string", "A non-empty grounded answer must be a string.");
    assert.equal(result.noResults, false, "Grounded claims must not report noResults.");
    assert.ok(!result.claims.some((claim: { contentHash: string }) => claim.contentHash === `hash-syn-cross-${tag}`), "A different project's region must never appear in synthesized claims.");

    console.log(`Slice 3 knowledge synthesis verified via HTTP: nearest-neighbour top similarity ${top.similarity.toFixed(4)}, cross-project isolation held, ${result.claims.length} grounded claim(s) returned.`);

    // 2. All-claims-fabricated (simulated at the unit level above) already
    //    proves droppedCount and empty-survivor behaviour; here we confirm
    //    the "no results in scope" HTTP shape (200, not an error) for a query
    //    that legitimately retrieves nothing.
    const emptyResult = await post(base, `/api/projects/${project.id}/knowledge/query`, { query: `Completely unrelated ${tag} avionics turbine blade metallurgy inspection procedure`, documentType: "rfi" });
    assert.equal(emptyResult.noResults, true, "A query retrieving nothing must report noResults: true.");
    assert.equal(emptyResult.answer, null, "A query retrieving nothing must return a null answer.");
    assert.ok(Array.isArray(emptyResult.claims) && emptyResult.claims.length === 0, "A query retrieving nothing must return zero claims.");

    console.log("No-results-in-scope state verified: HTTP 200 with noResults: true, answer: null, claims: [] — OK");
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (crossProjectId) await db.delete(projects).where(eq(projects.id, crossProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
