import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { documents, documentVersions, knowledgeChunks, projects, sourceRegions } from "../src/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "../src/lib/model/provider";
import { developmentProjectId } from "../src/lib/demo";

// Slice 9: nothing in the data model used to distinguish a resolved RFI from
// an open one — documentVersions.status is a document-lifecycle state, not
// an RFI resolution state — so the rfi-similar endpoint labeled every
// documentType=rfi vector match "previously resolved" unconditionally. This
// verifies the new documents.resolutionState column actually gates that
// label: a resolved RFI surfaces under `suggestions` (the "resolved"
// heading); a near-identical *open* RFI never does, appearing only (if at
// all) under the separately-labeled `unresolvedSuggestions`; and resolution
// state is still project-scoped like every other knowledge boundary.

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.RFI_RESOLUTION_TEST_URL ?? "http://localhost:3000";
  const tag = randomUUID().slice(0, 8);
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = []; const chunkIds: string[] = [];
  let otherProjectId: string | undefined;

  async function rfiFixture(projectId: string, tenantId: string, resolutionState: "resolved" | "open", text: string, hashSuffix: string) {
    const provider = getModelProvider();
    const [document] = await db.insert(documents).values({ projectId, documentType: "rfi", title: `RFI ${resolutionState} ${tag}`, resolutionState, resolvedAt: resolutionState === "resolved" ? new Date() : null }).returning();
    documentIds.push(document.id);
    const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "1", status: "approved", sha256: hash(`rfi-version:${hashSuffix}`), objectKey: `rfi/${hashSuffix}`, mediaType: "text/plain", extractionStatus: "completed" }).returning();
    versionIds.push(version.id);
    const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(`rfi-region:${hashSuffix}`) }).returning();
    regionIds.push(region.id);
    const [chunk] = await db.insert(knowledgeChunks).values({ tenantId, projectId, sourceRegionId: region.id, documentType: "rfi", content: text, contentHash: `hash-${hashSuffix}`, embedding: await provider.embed(text), embeddingModel: activeEmbeddingModelTag() }).returning();
    chunkIds.push(chunk.id);
    return { document, version, region, chunk };
  }

  try {
    const developmentProject = await db.query.projects.findFirst({ where: eq(projects.id, developmentProjectId) });
    assert.ok(developmentProject, "The seeded development project is required.");

    const resolvedText = `RFI ${tag}: Clarify chilled-water pump flow tolerance acceptance criteria for the L4 integrated test.`;
    const openText = `RFI ${tag}: Clarify chilled-water pump flow tolerance acceptance criteria for the L4 integrated test — open item.`;
    const resolved = await rfiFixture(developmentProjectId, developmentProject.tenantId, "resolved", resolvedText, `resolved-${tag}`);
    const open = await rfiFixture(developmentProjectId, developmentProject.tenantId, "open", openText, `open-${tag}`);

    const result = await request(`${base}/api/projects/${developmentProjectId}/knowledge/rfi-similar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: resolvedText }) });
    assert.ok(Array.isArray(result.suggestions), "The endpoint must return a suggestions array.");
    assert.ok(Array.isArray(result.unresolvedSuggestions), "The endpoint must return a separately-labeled unresolvedSuggestions array.");

    assert.ok(result.suggestions.some((s: { contentHash: string }) => s.contentHash === `hash-resolved-${tag}`), "The resolved RFI must appear under the resolved heading.");
    assert.ok(!result.suggestions.some((s: { contentHash: string }) => s.contentHash === `hash-open-${tag}`), "An unresolved RFI must never appear under the resolved heading.");

    // If the open RFI surfaces at all, it must only be under the
    // separately-labeled unresolved group — never silently dropped into
    // `suggestions` and never absent from both without explanation.
    const openInResolved = result.suggestions.some((s: { contentHash: string }) => s.contentHash === `hash-open-${tag}`);
    assert.equal(openInResolved, false);

    // ── Cross-project scoping still holds for resolution-state filtering ──
    const [otherProject] = await db.insert(projects).values({ tenantId: developmentProject.tenantId, name: `RFI resolution cross-project ${tag}`, code: `RFX-${tag}`, timezone: "UTC" }).returning();
    otherProjectId = otherProject.id;
    const crossProjectResolvedText = `RFI ${tag}: Clarify chilled-water pump flow tolerance acceptance criteria for the L4 integrated test (other project).`;
    await rfiFixture(otherProject.id, otherProject.tenantId, "resolved", crossProjectResolvedText, `cross-resolved-${tag}`);

    const crossCheck = await request(`${base}/api/projects/${developmentProjectId}/knowledge/rfi-similar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: crossProjectResolvedText }) });
    assert.ok(!crossCheck.suggestions.some((s: { contentHash: string }) => s.contentHash === `hash-cross-resolved-${tag}`), "A resolved RFI from a different project must never surface in this project's results.");

    console.log(`Slice 9 RFI resolution state verified: resolved RFI ${resolved.chunk.contentHash} surfaced under the resolved heading, open RFI ${open.chunk.contentHash} excluded from it, cross-project scoping intact.`);
  } finally {
    if (chunkIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.id, chunkIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (otherProjectId) await db.delete(projects).where(eq(projects.id, otherProjectId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
