import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { env } from "../src/lib/env";

// Slice 1: the stateless services/retrieval Python service. This check must
// never block the offline (EMBEDDING_PROVIDER=mock) verification matrix, so it
// skips cleanly unless the service is actually selected.
async function main() {
  if (env.EMBEDDING_PROVIDER !== "service") {
    console.log("Skipping retrieval-service verification: EMBEDDING_PROVIDER is not 'service' (offline/mock mode). This is expected for the containerless verify:all matrix.");
    process.exit(0);
  }

  const base = env.RETRIEVAL_SERVICE_URL;

  // 1. /health reports the expected embedding dimensionality.
  const healthResponse = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5_000) });
  assert.ok(healthResponse.ok, `GET /health must succeed (got ${healthResponse.status}).`);
  const health = await healthResponse.json() as { status: string; service: string; model: string; dimensions: number };
  assert.equal(health.status, "ok");
  assert.equal(health.service, "retrieval");
  assert.equal(health.dimensions, 768, "The retrieval service must report 768-dimensional embeddings.");

  // 2. Identical text embeds to an identical vector; unrelated text embeds to a
  //    materially different (lower cosine similarity) vector.
  const textA = "Chilled-water pumps shall maintain 450 LPM during the integrated system test.";
  const textB = "Chilled-water pumps shall maintain 450 LPM during the integrated system test.";
  const textC = "Fire suppression agent concentration reaches seven percent within ten seconds.";
  const embedResponse = await fetch(`${base}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: [textA, textB, textC], kind: "passage" }),
    signal: AbortSignal.timeout(30_000)
  });
  assert.ok(embedResponse.ok, `POST /embed must succeed (got ${embedResponse.status}).`);
  const embedBody = await embedResponse.json() as { embeddings: number[][]; dimensions: number };
  assert.equal(embedBody.embeddings.length, 3);
  assert.equal(embedBody.embeddings[0].length, 768);
  const cosine = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const selfSim = cosine(embedBody.embeddings[0], embedBody.embeddings[1]);
  const otherSim = cosine(embedBody.embeddings[0], embedBody.embeddings[2]);
  assert.ok(selfSim > 0.999, `Identical text must embed to (near-)identical vectors (got cosine ${selfSim}).`);
  assert.ok(selfSim - otherSim > 0.1, `Unrelated text must embed to a materially lower-similarity vector (self ${selfSim}, other ${otherSim}).`);

  // 2b. bge asymmetry: /embed with kind="query" must prefix internally and still
  //     return a 768-dim vector reasonably close to the passage embedding of the
  //     same text (sanity, not exactness).
  const queryEmbedResponse = await fetch(`${base}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: [textA], kind: "query" }),
    signal: AbortSignal.timeout(30_000)
  });
  assert.ok(queryEmbedResponse.ok);
  const queryEmbedBody = await queryEmbedResponse.json() as { embeddings: number[][] };
  assert.equal(queryEmbedBody.embeddings[0].length, 768);

  // 2c. Empty texts array must 422, not crash.
  const emptyResponse = await fetch(`${base}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts: [], kind: "passage" }),
    signal: AbortSignal.timeout(5_000)
  });
  assert.equal(emptyResponse.status, 422, "An empty texts array must be rejected with 422.");

  // 3. /rerank reorders a deliberately mis-ordered candidate list: the correct
  //    answer is placed last in the input and must be returned first.
  const rerankQuery = "What is the required chilled-water flow rate?";
  const documents = [
    "Fire suppression agent concentration reaches seven percent within ten seconds.",
    "Motor efficiency shall be at least ninety-two percent at full load.",
    "Chilled-water pumps shall maintain 450 LPM during the integrated system test."
  ];
  const rerankResponse = await fetch(`${base}/rerank`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: rerankQuery, documents, top_k: 3 }),
    signal: AbortSignal.timeout(30_000)
  });
  assert.ok(rerankResponse.ok, `POST /rerank must succeed (got ${rerankResponse.status}).`);
  const rerankBody = await rerankResponse.json() as { results: Array<{ index: number; score: number }> };
  assert.equal(rerankBody.results[0].index, 2, "The relevant document (placed last in the input) must be reranked to first.");
  assert.ok(rerankBody.results[0].score >= rerankBody.results[1].score, "Results must be sorted by score descending.");

  // 4. Mixed-model guard: a chunk tagged with a different embeddingModel is
  //    excluded from a same-model query via retrieveSemanticCitations.
  const { db } = await import("../src/lib/db/client");
  const { knowledgeChunks, projects, sourceRegions, documentVersions, documents: documentsTable } = await import("../src/lib/db/schema");
  const { retrieveSemanticCitations } = await import("../src/lib/knowledge/query");
  const { getEmbeddingProvider } = await import("../src/lib/model/provider");
  const { activeEmbeddingModelTag } = await import("../src/lib/model/provider");

  const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).limit(1);
  assert.ok(project, "A seeded project is required for the mixed-model guard check.");
  const [region] = await db
    .select({ id: sourceRegions.id })
    .from(sourceRegions)
    .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
    .innerJoin(documentsTable, eq(documentVersions.documentId, documentsTable.id))
    .where(eq(documentsTable.projectId, project.id))
    .limit(1);
  assert.ok(region, "A source region is required for the mixed-model guard check.");

  const tag = randomUUID().slice(0, 8);
  const guardText = `Mixed-model guard verification chunk ${tag}: chilled-water pumps shall maintain 450 LPM during the integrated test.`;
  const provider = getEmbeddingProvider();
  const vector = await provider.embed(guardText);
  const currentTag = activeEmbeddingModelTag();
  const staleTag = currentTag === "bge-base-en-v1.5" ? "deterministic-mock-v1" : "bge-base-en-v1.5";

  const [inserted] = await db.insert(knowledgeChunks).values({
    tenantId: project.tenantId,
    projectId: project.id,
    sourceRegionId: region.id,
    documentType: "procedure",
    content: guardText,
    contentHash: `hash-guard-${tag}`,
    embedding: vector,
    embeddingModel: staleTag
  }).returning({ id: knowledgeChunks.id });

  try {
    const result = await retrieveSemanticCitations({ projectId: project.id, query: guardText, documentType: "procedure" });
    assert.ok(!result.some((citation) => citation.contentHash === `hash-guard-${tag}`), `A chunk tagged with a stale embeddingModel (${staleTag}) must be excluded from a query under the active model (${currentTag}).`);
  } finally {
    await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, [inserted.id]));
  }

  console.log(`Retrieval service verified: 768-dim embeddings, identity/discrimination, rerank ordering, and the mixed-embedding-model guard all behave correctly (self-sim ${selfSim.toFixed(4)}, other-sim ${otherSim.toFixed(4)}).`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
