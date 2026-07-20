import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { knowledgeChunks, documents, documentVersions, sourceRegions, projects } from "../src/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";
import { developmentProjectId } from "../src/lib/demo";

// Slice 8: entering RFI text must surface "previously resolved similar RFI"
// suggestions via a documentType=rfi-scoped cosine-threshold vector search. We
// seed one resolved RFI chunk and one identically-worded procedure chunk; the
// rfi-similar endpoint must return the resolved RFI (high similarity) and must
// NEVER return the procedure chunk, proving the rfi scope is enforced before
// ranking. Expected values come from the seeded literals.
//
// Slice 9 update (intentional fixture change, not a weakened assertion): the
// endpoint now filters on the owning document's `resolutionState`, so the RFI
// chunk must be anchored to a real documentType="rfi" document that is
// explicitly marked resolutionState="resolved" — previously it reused
// whatever source region happened to belong to the project's first
// (non-rfi) seeded document and relied on the endpoint's old unconditional
// "every rfi-tagged chunk is resolved" behavior. This script now creates and
// tears down its own document/documentVersion/sourceRegion for that purpose.
async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function firstSourceRegion(projectId: string) {
  const [row] = await db.select({ id: sourceRegions.id }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).limit(1);
  assert.ok(row, "A source region is required to anchor a knowledge chunk.");
  return row.id;
}

async function main() {
  const base = process.env.KNOWLEDGE_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const rfiText = `RFI ${tag}: Clarify chilled-water pump flow tolerance acceptance criteria for L4 integrated test.`;
  const procedureText = `Procedure ${tag}: Chilled-water pump flow tolerance acceptance criteria for L4 integrated test.`;
  const chunkIds: string[] = [];
  let rfiDocumentId: string | undefined;
  let rfiDocumentVersionId: string | undefined;
  let rfiSourceRegionId: string | undefined;
  try {
    const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(project, "A seeded project is required.");
    const provider = getModelProvider();

    // Slice 9: a real documentType="rfi" document, explicitly marked
    // resolutionState="resolved" — the endpoint now filters on this, so an
    // rfi-tagged chunk anchored to a document without that state would never
    // surface under "suggestions".
    const [rfiDocument] = await db.insert(documents).values({ projectId: project.id, documentType: "rfi", title: `RFI ${tag}`, resolutionState: "resolved", resolvedAt: new Date() }).returning({ id: documents.id });
    rfiDocumentId = rfiDocument.id;
    const [rfiDocumentVersion] = await db.insert(documentVersions).values({ documentId: rfiDocument.id, revision: "1", sha256: `hash-rfi-doc-${tag}`, objectKey: `rfi/${tag}`, mediaType: "text/plain" }).returning({ id: documentVersions.id });
    rfiDocumentVersionId = rfiDocumentVersion.id;
    const [rfiSourceRegion] = await db.insert(sourceRegions).values({ documentVersionId: rfiDocumentVersion.id, pageNumber: "1", extractedText: rfiText, contentHash: `hash-rfi-region-${tag}` }).returning({ id: sourceRegions.id });
    rfiSourceRegionId = rfiSourceRegion.id;

    const seeded = await db.insert(knowledgeChunks).values([
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: rfiSourceRegion.id, documentType: "rfi", content: rfiText, contentHash: `hash-rfi-${tag}`, embedding: await provider.embed(rfiText), embeddingModel: activeEmbeddingModelTag() },
      { tenantId: project.tenantId, projectId: project.id, sourceRegionId: await firstSourceRegion(project.id), documentType: "procedure", content: procedureText, contentHash: `hash-proc-${tag}`, embedding: await provider.embed(procedureText), embeddingModel: activeEmbeddingModelTag() }
    ]).returning({ id: knowledgeChunks.id });
    chunkIds.push(...seeded.map((row) => row.id));

    // Query the rfi-similar endpoint with text near the resolved RFI.
    const result = await request(base, `/api/projects/${project.id}/knowledge/rfi-similar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: rfiText }) });
    assert.ok(Array.isArray(result.suggestions), "The endpoint must return a suggestions array.");
    assert.ok(result.suggestions.length >= 1, "A similar resolved RFI must be suggested.");
    const top = result.suggestions[0];
    assert.equal(top.content ?? top.text, rfiText, "The resolved RFI must be the top suggestion.");
    assert.equal(top.documentType, "rfi", "Suggestions must be scoped to documentType=rfi.");
    assert.equal(typeof top.similarity, "number", "Each suggestion must expose a similarity score.");
    assert.ok(top.similarity > 0.99, `The identical RFI's similarity must be ~1.0 (got ${top.similarity}).`);
    assert.ok(!result.suggestions.some((item: { contentHash: string }) => item.contentHash === `hash-proc-${tag}`), "Non-rfi chunks must never appear in RFI suggestions.");

    console.log(`Slice 8 RFI similarity verified: resolved RFI suggested at similarity ${top.similarity.toFixed(4)}, rfi scope enforced.`);
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (rfiSourceRegionId) await db.delete(sourceRegions).where(eq(sourceRegions.id, rfiSourceRegionId));
    if (rfiDocumentVersionId) await db.delete(documentVersions).where(eq(documentVersions.id, rfiDocumentVersionId));
    if (rfiDocumentId) await db.delete(documents).where(eq(documents.id, rfiDocumentId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
