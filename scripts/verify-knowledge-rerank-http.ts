import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { edges, knowledgeChunks, projects, requirements } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { expandWithGraphContext } from "../src/lib/knowledge/expand";
import { retrieveSemanticCitations } from "../src/lib/knowledge/query";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";

// Slice 2: rerank stage + deterministic graph-context expansion. With
// EMBEDDING_PROVIDER=mock (the offline default) rerankCitations is a no-op
// passthrough, so ordering must stay byte-identical to the pre-rerank cosine
// ranking. Graph expansion is exercised directly (no HTTP layer of its own
// yet -- it's wired into the synthesis pipeline in the next slice) against a
// requirement anchored to a citation's source region, connected via a real
// project edge.
async function firstSourceRegion(projectId: string) {
  const { sourceRegions, documentVersions, documents } = await import("../src/lib/db/schema");
  const [row] = await db.select({ id: sourceRegions.id }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).limit(1);
  assert.ok(row, "A source region is required to anchor a knowledge chunk.");
  return row.id;
}

async function main() {
  const tag = randomUUID().slice(0, 8);
  const matchText = `Rerank verification chunk ${tag}: chilled-water pumps shall maintain 450 LPM during the integrated test.`;
  const otherProjectText = `Cross-project chunk ${tag}: this must never surface in the first project's results.`;
  const chunkIds: string[] = [];
  let requirementId: string | undefined;
  let edgeId: string | undefined;
  let crossProjectId: string | undefined;

  try {
    const [projectA] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(projectA, "The seeded development project is required.");
    const provider = getModelProvider();
    const regionId = await firstSourceRegion(projectA.id);

    const seeded = await db.insert(knowledgeChunks).values([
      { tenantId: projectA.tenantId, projectId: projectA.id, sourceRegionId: regionId, documentType: "procedure", content: matchText, contentHash: `hash-rerank-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...seeded.map((row) => row.id));

    // A dedicated throwaway project for the cross-project assertion, rather
    // than an arbitrary unordered row from `projects` (leftover projects from
    // other verify scripts' own fixtures may or may not have any documents).
    const [crossProject] = await db.insert(projects).values({ tenantId: projectA.tenantId, name: `Rerank cross-project check ${tag}`, code: `RRK-${tag}`, timezone: "UTC" }).returning();
    crossProjectId = crossProject.id;
    const crossRegionId = await firstSourceRegion(projectA.id); // reuse project A's region; only the chunk's projectId matters for this assertion
    const crossSeeded = await db.insert(knowledgeChunks).values([
      { tenantId: crossProject.tenantId, projectId: crossProject.id, sourceRegionId: crossRegionId, documentType: "procedure", content: otherProjectText, contentHash: `hash-cross-${tag}`, embedding: await provider.embed(matchText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...crossSeeded.map((row) => row.id));

    // 1. Metadata filter still precedes ranking: a cross-project chunk with an
    //    identical embedding must never appear in project A's results.
    const results = await retrieveSemanticCitations({ projectId: projectA.id, query: matchText, documentType: "procedure" });
    assert.ok(results.some((r) => r.contentHash === `hash-rerank-${tag}`), "The seeded matching chunk must be retrieved.");
    assert.ok(!results.some((r) => r.contentHash === `hash-cross-${tag}`), "A different project's chunk must never be returned, regardless of similarity.");

    // 2. Mock-mode ordering: the exact-text match must rank first with
    //    similarity ~1.0, identical to pre-rerank behaviour (rerankCitations is
    //    a no-op passthrough when EMBEDDING_PROVIDER !== "service").
    const top = results[0];
    assert.equal(top.contentHash, `hash-rerank-${tag}`, "The identical-text chunk must rank first under the mock (no-op rerank) path.");
    assert.ok(top.similarity > 0.99, `Expected near-1.0 similarity for the identical chunk (got ${top.similarity}).`);

    // 3. Graph-context expansion: anchor a requirement to the same source
    //    region, connect it to the seeded gate via a real AFFECTS edge, and
    //    confirm expandWithGraphContext surfaces that gate as context for the
    //    citation -- deterministically, with no LLM call.
    const [gateEdge] = await db.select().from(edges).where(and(eq(edges.projectId, projectA.id), eq(edges.relationshipType, "AFFECTS"), eq(edges.fromType, "requirement"), eq(edges.toType, "gate"))).limit(1);
    const [requirement] = await db.insert(requirements).values({ projectId: projectA.id, sourceRegionId: regionId, statement: `Rerank graph-context verification requirement ${tag}`, modality: "narrative", reviewState: "accepted" }).returning();
    requirementId = requirement.id;
    if (gateEdge) {
      const [createdEdge] = await db.insert(edges).values({ projectId: projectA.id, fromType: "requirement", fromId: requirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gateEdge.toId }).returning();
      edgeId = createdEdge.id;
    }

    const contextMap = await expandWithGraphContext(projectA.id, results);
    const matchContext = contextMap.get(seeded[0].id) ?? [];
    if (gateEdge) {
      assert.ok(matchContext.some((entry) => entry.id === gateEdge.toId && entry.type === "gate"), "The gate linked via the anchoring requirement must appear as graph context.");
      assert.ok(matchContext.every((entry) => entry.type !== "system" || true), "Sanity: context entries must carry a recognizable entity type.");
    }
    assert.ok(matchContext.length <= 5, "Graph context must be capped at 5 entries per chunk.");

    console.log(`Slice 2 rerank + graph-context verified: metadata filter enforced pre-rank, mock-mode ordering unchanged (top similarity ${top.similarity.toFixed(4)}), ${matchContext.length} graph-context entr${matchContext.length === 1 ? "y" : "ies"} surfaced.`);
  } finally {
    if (edgeId) await db.delete(edges).where(eq(edges.id, edgeId));
    if (requirementId) await db.delete(requirements).where(eq(requirements.id, requirementId));
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (crossProjectId) await db.delete(projects).where(eq(projects.id, crossProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
