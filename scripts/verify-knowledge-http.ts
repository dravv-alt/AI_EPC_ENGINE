import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { documents, documentVersions, knowledgeChunks, projects, sourceRegions } from "../src/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";
import { developmentProjectId } from "../src/lib/demo";

// Slice 16 end-to-end knowledge verification.
//
// Exercises semantic retrieval (Slice 7) and RFI similarity search (Slice 8)
// in a single script so the full knowledge pipeline can be validated in one
// `npm run verify:knowledge-http` invocation.
//
// Strategy:
//   1. Seed three chunks with deterministic mock embeddings:
//        match   — documentType=procedure, content identical to the query
//        noise   — documentType=procedure, unrelated content
//        wrongDT — documentType=standard,  same content as match
//        rfi     — documentType=rfi,        same content as the match-rfi query
//        procDup — documentType=procedure,  same content as the rfi (scope leak check)
//   2. Assert semantic retrieval returns the exact match first (similarity ~1.0)
//      and respects both the documentType filter and the similarity threshold.
//   3. Assert RFI similarity returns the rfi chunk first and never leaks the
//      procedure duplicate (scope enforcement).
//
// Expected values come from the seeded literals, not from anything the routes
// recompute. All rows are torn down in `finally`.

const base = process.env.KNOWLEDGE_TEST_URL ?? "http://localhost:3000";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function post(path: string, body: unknown) {
  return request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function firstSourceRegion(projectId: string): Promise<string> {
  const [row] = await db
    .select({ id: sourceRegions.id })
    .from(sourceRegions)
    .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(eq(documents.projectId, projectId))
    .limit(1);
  assert.ok(row, "A source region is required to anchor a knowledge chunk.");
  return row.id;
}

// ── Part A: semantic knowledge query ─────────────────────────────────────────
async function assertSemanticQuery(projectId: string, tenantId: string, regionId: string, provider: ReturnType<typeof getModelProvider>, tag: string) {
  const matchText = `Semantic E2E ${tag}: chilled-water pumps shall maintain 450 LPM during the integrated commissioning test.`;
  const noiseText = `Unrelated E2E ${tag}: fire suppression agent concentration reaches seven percent within ten seconds.`;
  const wrongDTText = `Standard-scoped E2E ${tag}: motor efficiency shall be at least ninety-two percent at full load.`;

  const seeded = await db.insert(knowledgeChunks).values([
    { tenantId, projectId, sourceRegionId: regionId, documentType: "procedure", content: matchText, contentHash: `e2e-match-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() },
    { tenantId, projectId, sourceRegionId: regionId, documentType: "procedure", content: noiseText, contentHash: `e2e-noise-${tag}`, embedding: await provider.embed(noiseText), embeddingModel: activeEmbeddingModelTag() },
    { tenantId, projectId, sourceRegionId: regionId, documentType: "standard", content: wrongDTText, contentHash: `e2e-wrongdt-${tag}`, embedding: await provider.embed(wrongDTText), embeddingModel: activeEmbeddingModelTag() },
  ]).returning({ id: knowledgeChunks.id });

  const chunkIds = seeded.map((r) => r.id);
  try {
    // 1. Nearest-neighbour retrieval with the identical query text.
    const result = await post(`/api/projects/${projectId}/knowledge/query`, { query: matchText, documentType: "procedure" });
    assert.ok(Array.isArray(result.claims) && result.claims.length >= 1, "Semantic query must return claims.");
    const top = result.claims[0];
    assert.equal(top.content ?? top.text, matchText, "The exact-text query must rank the identical chunk first.");
    assert.equal(typeof top.similarity, "number", "Each claim must expose a numeric similarity score.");
    assert.ok(top.similarity > 0.99, `The identical chunk's similarity must be ~1.0 (got ${top.similarity}).`);

    // 2. Metadata-filter enforcement: wrong documentType must be excluded.
    assert.ok(
      !result.claims.some((c: { contentHash: string }) => c.contentHash === `e2e-wrongdt-${tag}`),
      "The documentType=standard chunk must never appear in a documentType=procedure query.",
    );

    // 3. Threshold enforcement: a totally unrelated query must not surface the seeded chunks.
    const noise = await post(`/api/projects/${projectId}/knowledge/query`, {
      query: `Completely unrelated ${tag} avionics turbine blade metallurgy`,
      documentType: "procedure",
    });
    const leaking = (noise.claims as Array<{ contentHash: string; similarity: number }>).filter(
      (c) => (c.contentHash === `e2e-match-${tag}` || c.contentHash === `e2e-noise-${tag}`) && c.similarity < 0.2,
    );
    assert.equal(leaking.length, 0, "Below-threshold chunks must be excluded from results.");

    console.log(`  [semantic-query] nearest-neighbour similarity ${top.similarity.toFixed(4)}, filter enforced, threshold applied — OK`);
    return top.similarity as number;
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
  }
}

// ── Part B: RFI similarity retrieval ─────────────────────────────────────────
async function assertRfiSimilarity(projectId: string, tenantId: string, regionId: string, provider: ReturnType<typeof getModelProvider>, tag: string) {
  const rfiText = `RFI E2E ${tag}: Clarify chilled-water pump flow tolerance acceptance criteria for L4 integrated test.`;
  const procText = `Procedure E2E ${tag}: Chilled-water pump flow tolerance acceptance criteria for L4 integrated test.`;
  let rfiDocumentId: string | undefined;
  let rfiVersionId: string | undefined;
  let rfiRegionId: string | undefined;
  const chunkIds: string[] = [];
  try {
    // The endpoint must only suggest RFIs that are durably marked resolved on
    // their owning document.  Make this fixture self-contained so its result
    // does not depend on another verifier leaving a compatible row behind.
    const [rfiDocument] = await db.insert(documents).values({
      projectId,
      documentType: "rfi",
      title: `RFI E2E ${tag}`,
      resolutionState: "resolved",
      resolvedAt: new Date(),
    }).returning({ id: documents.id });
    rfiDocumentId = rfiDocument.id;
    const [rfiVersion] = await db.insert(documentVersions).values({
      documentId: rfiDocument.id,
      revision: "1",
      sha256: `e2e-rfi-document-${tag}`,
      objectKey: `verification/rfi/${tag}`,
      mediaType: "text/plain",
    }).returning({ id: documentVersions.id });
    rfiVersionId = rfiVersion.id;
    const [rfiRegion] = await db.insert(sourceRegions).values({
      documentVersionId: rfiVersion.id,
      pageNumber: "1",
      extractedText: rfiText,
      contentHash: `e2e-rfi-region-${tag}`,
    }).returning({ id: sourceRegions.id });
    rfiRegionId = rfiRegion.id;

    const seeded = await db.insert(knowledgeChunks).values([
      { tenantId, projectId, sourceRegionId: rfiRegion.id, documentType: "rfi", content: rfiText, contentHash: `e2e-rfi-${tag}`, embedding: await provider.embed(rfiText), embeddingModel: activeEmbeddingModelTag() },
      { tenantId, projectId, sourceRegionId: regionId, documentType: "procedure", content: procText, contentHash: `e2e-proc-${tag}`, embedding: await provider.embed(procText), embeddingModel: activeEmbeddingModelTag() },
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...seeded.map((row) => row.id));

    const result = await request(`/api/projects/${projectId}/knowledge/rfi-similar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: rfiText }),
    });

    assert.ok(Array.isArray(result.suggestions), "The rfi-similar endpoint must return a suggestions array.");
    assert.ok(result.suggestions.length >= 1, "A similar resolved RFI must be suggested.");
    const top = result.suggestions[0];
    assert.equal(top.content ?? top.text, rfiText, "The resolved RFI must be the top suggestion.");
    assert.equal(top.documentType, "rfi", "Suggestions must be scoped to documentType=rfi.");
    assert.equal(typeof top.similarity, "number", "Each suggestion must expose a similarity score.");
    assert.ok(top.similarity > 0.99, `The identical RFI's similarity must be ~1.0 (got ${top.similarity}).`);
    assert.ok(
      !result.suggestions.some((s: { contentHash: string }) => s.contentHash === `e2e-proc-${tag}`),
      "Non-rfi chunks must never appear in RFI suggestions.",
    );

    console.log(`  [rfi-similarity] resolved RFI suggested at similarity ${top.similarity.toFixed(4)}, rfi scope enforced — OK`);
    return top.similarity as number;
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (rfiRegionId) await db.delete(sourceRegions).where(eq(sourceRegions.id, rfiRegionId));
    if (rfiVersionId) await db.delete(documentVersions).where(eq(documentVersions.id, rfiVersionId));
    if (rfiDocumentId) await db.delete(documents).where(eq(documents.id, rfiDocumentId));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\nSlice 16 — End-to-end knowledge pipeline verification");
  console.log("=====================================================");

  const tag = randomUUID().slice(0, 8);
  const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
  assert.ok(project, "A seeded project is required.");

  const regionId = await firstSourceRegion(project.id);
  const provider = getModelProvider();

  const semSimilarity = await assertSemanticQuery(project.id, project.tenantId, regionId, provider, tag);
  const rfiSimilarity = await assertRfiSimilarity(project.id, project.tenantId, regionId, provider, tag);

  console.log(`\nAll knowledge end-to-end assertions passed: semantic retrieval (similarity ${semSimilarity.toFixed(4)}), RFI similarity (${rfiSimilarity.toFixed(4)}).`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
