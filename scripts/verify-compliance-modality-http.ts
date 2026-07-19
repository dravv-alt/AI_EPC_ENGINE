import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { compareCompliance } from "../src/lib/compliance/compare";
import { proposeDocumentRecords } from "../src/lib/ingestion/proposals";
import { db } from "../src/lib/db/client";
import { documentVersions, documents, knowledgeChunks, requirements, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

async function main() {
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = []; const requirementIds: string[] = [];
  try {
    // --- Part 1: a newly-extracted requirement (mock-mode ingestion path)
    // gets a stored comparisonModality matching the mock heuristic's
    // classification of a known numeric clause. ---
    const member = await db.query.projectMembers.findFirst({ where: (table, { eq }) => eq(table.projectId, developmentProjectId) });
    if (!member) throw new Error("The development project needs at least one project member to attribute the audit trail to.");
    const actorId = member.userId;

    const token = randomUUID();
    const [document] = await db.insert(documents).values({ projectId: developmentProjectId, documentType: "client_spec", title: "Synthetic modality-tag specification" }).returning(); documentIds.push(document.id);
    const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "Modality Test", status: "approved", sha256: hash(`version:${token}`), objectKey: `${developmentProjectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
    const numericText = "The operating pressure shall be 100 kPa plus or minus 2 kPa.";
    const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: numericText, contentHash: hash(numericText) }).returning(); regionIds.push(region.id);

    const proposeResult = await proposeDocumentRecords(version.id, actorId);
    assert.equal(proposeResult.kind, "requirements");
    assert.ok(proposeResult.proposed >= 1, "expected at least one requirement to be proposed from the numeric clause");

    const inserted = await db.query.requirements.findFirst({ where: (table, { eq, and }) => and(eq(table.projectId, developmentProjectId), eq(table.sourceRegionId, region.id)) });
    assert.ok(inserted, "the proposed requirement must have been persisted");
    requirementIds.push(inserted!.id);
    assert.equal(inserted!.comparisonModality, "numeric", "a measurable-value-and-unit clause must be tagged numeric by the mock extraction heuristic");

    const [refetchedVersion] = await db.select().from(documentVersions).where(inArray(documentVersions.id, [version.id]));
    assert.equal(refetchedVersion.extractionModel, "deterministic-mock-v1", "sanity: mock provider model string should have been recorded on the version too");

    // --- Part 2: compareCompliance with a stored comparisonModality: "numeric"
    // tag and NO numericValue/unit set still routes into (attempts) the
    // numeric branch, rather than falling through to categorical/narrative —
    // proving the tag drives the decision rather than merely correlating
    // with it. The target text below deliberately contains an explicit
    // categorical callout ("type: stainless") so the untagged/legacy
    // heuristic would have routed to categorical instead. ---
    const taggedNumeric = compareCompliance(
      { statement: "The enclosure material shall be type: stainless.", numericValue: null, unit: null, tolerance: null, comparisonModality: "numeric" },
      "Material provided: type: stainless."
    );
    assert.equal(taggedNumeric.comparisonType, "numeric", "the stored numeric tag must force the numeric branch even without an explicit numeric value/unit on the requirement");
    assert.equal(taggedNumeric.verdict, "needs_engineering_judgment");

    // Prove disagreement: the exact same inputs, untagged, take the
    // categorical branch under the legacy heuristic.
    const untaggedSameInputs = compareCompliance(
      { statement: "The enclosure material shall be type: stainless.", numericValue: null, unit: null, tolerance: null, comparisonModality: null },
      "Material provided: type: stainless."
    );
    assert.equal(untaggedSameInputs.comparisonType, "categorical", "sanity: the untagged legacy heuristic must have chosen a different branch than the tag did, proving the tag is not just correlating with the heuristic");

    // --- Part 3: a requirement with comparisonModality: null (a simulated
    // pre-existing row) falls back to the exact current regex-based routing.
    // The strongest guard for this is that verify:compliance-http — which
    // never sets comparisonModality on any requirement it inserts — still
    // passes completely unmodified. Exercise that explicitly here too. ---
    const fallbackNumeric = compareCompliance(
      { statement: "The operating pressure shall be 100 kPa plus or minus 2 kPa.", numericValue: "100", unit: "kPa", tolerance: "2", comparisonModality: null },
      "Operating pressure: 1 bar."
    );
    assert.equal(fallbackNumeric.comparisonType, "numeric");
    assert.equal(fallbackNumeric.verdict, "conforms");

    console.log("Compliance modality-tiering HTTP verification passed: mock-extraction comparisonModality tagging, stored-tag-driven routing that overrides the naive heuristic, and null-tag fallback to the exact legacy regex routing.");
  } finally {
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(knowledgeChunks).where(inArray(knowledgeChunks.sourceRegionId, regionIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
