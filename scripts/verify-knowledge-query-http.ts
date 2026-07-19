import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { knowledgeChunks, projects } from "../src/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";

// Slice 7: the /knowledge query must be *semantic*. The query text is embedded,
// a mandatory project + documentType SQL metadata filter runs first, then
// pgvector cosine similarity ranks the surviving chunks and drops anything below
// KNOWLEDGE_SIMILARITY_THRESHOLD. We seed two chunks whose content is known, then
// query with text identical to one of them so the deterministic mock embedding
// makes that chunk the exact nearest neighbour (cosine ~1.0) and the unrelated
// chunk falls under threshold. Expected values come from the seeded literals, not
// from the code under test.
async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function post(base: string, path: string, body: unknown) {
  return request(base, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function main() {
  const base = process.env.KNOWLEDGE_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const matchText = `Semantic verification chunk ${tag}: chilled-water pumps shall maintain 450 LPM during the integrated test.`;
  const otherText = `Unrelated verification chunk ${tag}: fire suppression agent concentration reaches seven percent within ten seconds.`;
  const wrongTypeText = `Standard-scoped chunk ${tag}: motor efficiency shall be at least ninety-two percent at full load.`;
  const chunkIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).limit(1);
    assert.ok(project, "A seeded project is required.");
    const provider = getModelProvider();
    // Seed three chunks directly with populated embeddings so retrieval is
    // exercised without waiting on the backfill worker.
    const seeded = await db.insert(knowledgeChunks).values([
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: (await firstSourceRegion(project.id)), documentType: "procedure", content: matchText, contentHash: `hash-match-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() },
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: (await firstSourceRegion(project.id)), documentType: "procedure", content: otherText, contentHash: `hash-other-${tag}`, embedding: await provider.embed(otherText), embeddingModel: activeEmbeddingModelTag() },
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: (await firstSourceRegion(project.id)), documentType: "standard", content: wrongTypeText, contentHash: `hash-wrong-${tag}`, embedding: await provider.embed(wrongTypeText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...seeded.map((row) => row.id));

    // 1. Semantic retrieval: querying with the exact match text ranks the match
    //    chunk first with similarity ~1.0, and each claim carries a similarity.
    const result = await post(base, `/api/projects/${project.id}/knowledge/query`, { query: matchText, documentType: "procedure" });
    assert.ok(Array.isArray(result.claims) && result.claims.length >= 1, "Semantic query must return claims.");
    const top = result.claims[0];
    assert.equal(top.content ?? top.text, matchText, "The exact-text query must rank the identical chunk first.");
    assert.equal(typeof top.similarity, "number", "Each claim must expose a numeric similarity score.");
    assert.ok(top.similarity > 0.99, `The identical chunk's similarity must be ~1.0 (got ${top.similarity}).`);

    // 2. Metadata-filter-first: the documentType=standard chunk must never appear
    //    in a documentType=procedure query, regardless of similarity.
    assert.ok(!result.claims.some((claim: { contentHash: string }) => claim.contentHash === `hash-wrong-${tag}`), "The documentType filter must run before ranking.");

    // 3. Threshold: an unrelated query returns no low-similarity noise.
    const noise = await post(base, `/api/projects/${project.id}/knowledge/query`, { query: `Completely unrelated ${tag} avionics turbine blade metallurgy inspection procedure`, documentType: "procedure" });
    assert.ok(!noise.claims.some((claim: { contentHash: string }) => chunkIds.length && (claim.contentHash === `hash-match-${tag}` || claim.contentHash === `hash-other-${tag}`) && claim.similarity < 0.2), "Below-threshold chunks must be excluded.");

    console.log(`Slice 7 knowledge semantic query verified: nearest-neighbour top similarity ${top.similarity.toFixed(4)}, metadata filter enforced, threshold applied.`);
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
  }
}

async function firstSourceRegion(projectId: string) {
  const { sourceRegions, documentVersions, documents } = await import("../src/lib/db/schema");
  const [row] = await db.select({ id: sourceRegions.id }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).limit(1);
  assert.ok(row, "A source region is required to anchor a knowledge chunk.");
  return row.id;
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
