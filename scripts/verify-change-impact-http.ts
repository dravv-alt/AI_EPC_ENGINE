import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  documentVersions,
  documents,
  edges,
  evidence,
  findings,
  gates,
  projects,
  requirements,
  sourceRegions,
  systems
} from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

// Slice 14: assessing a document revision must return the FULL blast-radius
// traversal as an impact list, not just direct neighbours. We seed an isolated
// multi-hop path — a document with an OLD version (superseded) whose changed
// source region carries a requirement, that requirement PROVES-linked to a piece
// of evidence and AFFECTS-linked to a gate — then POST the assess-change endpoint
// for the NEW version and assert the returned `impact` list contains BOTH the
// directly-changed requirement (distance 1 from the changed region) AND the
// transitively-reached evidence + gate (distance 2), proving traversal depth > 1.
// A second document whose changed region has no downstream requirement must yield
// an empty impact list. Everything seeded here is torn down in `finally`.

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.CHANGE_IMPACT_TEST_URL ?? "http://localhost:4302";
  const tag = randomUUID().slice(0, 8);
  const findingTitleNeedle = `Reassess source revision Rev-NEW-${tag}`;

  const documentIds: string[] = [];
  const versionIds: string[] = [];
  const regionIds: string[] = [];
  const requirementIds: string[] = [];
  const evidenceIds: string[] = [];
  const edgeIds: string[] = [];
  const gateIds: string[] = [];
  const systemIds: string[] = [];

  try {
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(project, "A seeded project is required.");

    // A dedicated system to anchor the gate + evidence (avoids touching seed rows).
    const [system] = await db.insert(systems).values({ projectId: project.id, name: `Impact system ${tag}`, systemType: "cooling" }).returning({ id: systems.id });
    systemIds.push(system.id);

    // A gate the changed requirement AFFECTS. Seeded `approved` so the route's
    // reopen-and-flag path runs end to end.
    const [gate] = await db.insert(gates).values({ projectId: project.id, systemId: system.id, name: `Impact gate ${tag}`, sequenceNumber: "9", status: "approved" }).returning({ id: gates.id });
    gateIds.push(gate.id);

    // ── Scenario A: a full multi-hop blast radius ───────────────────────────
    const [docA] = await db.insert(documents).values({ projectId: project.id, documentType: "procedure", title: `Impact doc A ${tag}` }).returning({ id: documents.id });
    documentIds.push(docA.id);

    const [oldVersion] = await db.insert(documentVersions).values({
      documentId: docA.id, revision: `Rev-OLD-${tag}`, status: "approved",
      sha256: sha256(`old-${tag}`), objectKey: `verify/impact-old-${tag}.pdf`, mediaType: "application/pdf", extractionStatus: "completed"
    }).returning({ id: documentVersions.id });
    versionIds.push(oldVersion.id);

    // Force the new version to sort after the old one so the route resolves the
    // old version as the superseded `previous`.
    const [newVersion] = await db.insert(documentVersions).values({
      documentId: docA.id, revision: `Rev-NEW-${tag}`, status: "approved",
      sha256: sha256(`new-${tag}`), objectKey: `verify/impact-new-${tag}.pdf`, mediaType: "application/pdf", extractionStatus: "completed",
      createdAt: new Date(Date.now() + 1000)
    }).returning({ id: documentVersions.id });
    versionIds.push(newVersion.id);

    // The old version carries a region whose content hash does NOT appear in the
    // new version — this is the "changed" region the traversal starts from.
    const [changedRegion] = await db.insert(sourceRegions).values({
      documentVersionId: oldVersion.id, pageNumber: "1", extractedText: `Changed clause ${tag}`, contentHash: sha256(`changed-${tag}`)
    }).returning({ id: sourceRegions.id });
    regionIds.push(changedRegion.id);
    // The new version's region has a different hash (so the old one counts as changed).
    const [newRegion] = await db.insert(sourceRegions).values({
      documentVersionId: newVersion.id, pageNumber: "1", extractedText: `Amended clause ${tag}`, contentHash: sha256(`amended-${tag}`)
    }).returning({ id: sourceRegions.id });
    regionIds.push(newRegion.id);

    // A requirement rooted in the changed region — the DIRECT (distance 1) impact.
    const [requirement] = await db.insert(requirements).values({
      projectId: project.id, sourceRegionId: changedRegion.id, statement: `Impacted requirement ${tag}`, modality: "shall", reviewState: "accepted"
    }).returning({ id: requirements.id });
    requirementIds.push(requirement.id);

    // Evidence PROVES the requirement — the TRANSITIVE (distance 2) impact.
    const [proof] = await db.insert(evidence).values({
      projectId: project.id, systemId: system.id, evidenceType: "measurement", validityState: "accepted",
      contentHash: sha256(`proof-${tag}`), notes: `Impacted evidence ${tag}`, capturedAt: new Date(), clientCaptureId: `impact-cap-${tag}`
    }).returning({ id: evidence.id });
    evidenceIds.push(proof.id);

    const seededEdges = await db.insert(edges).values([
      { projectId: project.id, fromType: "evidence", fromId: proof.id, relationshipType: "PROVES", toType: "requirement", toId: requirement.id },
      { projectId: project.id, fromType: "requirement", fromId: requirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gate.id }
    ]).returning({ id: edges.id });
    edgeIds.push(...seededEdges.map((row) => row.id));

    // ── Scenario B: a changed region with NO downstream requirement ─────────
    const [docB] = await db.insert(documents).values({ projectId: project.id, documentType: "procedure", title: `Impact doc B ${tag}` }).returning({ id: documents.id });
    documentIds.push(docB.id);
    const [oldVersionB] = await db.insert(documentVersions).values({
      documentId: docB.id, revision: `Rev-OLD-B-${tag}`, status: "approved",
      sha256: sha256(`old-b-${tag}`), objectKey: `verify/impact-old-b-${tag}.pdf`, mediaType: "application/pdf", extractionStatus: "completed"
    }).returning({ id: documentVersions.id });
    versionIds.push(oldVersionB.id);
    const [newVersionB] = await db.insert(documentVersions).values({
      documentId: docB.id, revision: `Rev-NEW-B-${tag}`, status: "approved",
      sha256: sha256(`new-b-${tag}`), objectKey: `verify/impact-new-b-${tag}.pdf`, mediaType: "application/pdf", extractionStatus: "completed",
      createdAt: new Date(Date.now() + 1000)
    }).returning({ id: documentVersions.id });
    versionIds.push(newVersionB.id);
    const [changedRegionB] = await db.insert(sourceRegions).values({
      documentVersionId: oldVersionB.id, pageNumber: "1", extractedText: `Lonely clause ${tag}`, contentHash: sha256(`lonely-${tag}`)
    }).returning({ id: sourceRegions.id });
    regionIds.push(changedRegionB.id);
    const [newRegionB] = await db.insert(sourceRegions).values({
      documentVersionId: newVersionB.id, pageNumber: "1", extractedText: `Lonely amended ${tag}`, contentHash: sha256(`lonely-amended-${tag}`)
    }).returning({ id: sourceRegions.id });
    regionIds.push(newRegionB.id);

    // ── Assess scenario A ───────────────────────────────────────────────────
    const result = await request(base, `/api/document-versions/${newVersion.id}/assess-change`, { method: "POST" });

    assert.equal(result.previousVersionId, oldVersion.id, "The superseded previous version must be resolved.");
    assert.ok(Array.isArray(result.impact), "assess-change must return an `impact` blast-radius list.");

    const byId = new Map(result.impact.map((entry: { id: string; type: string; label: string; state: string; distance: number }) => [entry.id, entry]));

    // Direct impact: the requirement rooted in the changed region.
    const reqEntry = byId.get(requirement.id) as { type: string; label: string; distance: number } | undefined;
    assert.ok(reqEntry, "The directly-changed requirement must appear in the impact list.");
    assert.equal(reqEntry.type, "requirement", "The requirement entry must carry its type.");
    assert.equal(reqEntry.label, `Impacted requirement ${tag}`, "The requirement entry must carry its statement as label.");

    // Transitive impact (depth > 1): the evidence reached via requirement.
    const evEntry = byId.get(proof.id) as { type: string; state: string; distance: number } | undefined;
    assert.ok(evEntry, "The transitively-affected evidence must appear in the impact list.");
    assert.equal(evEntry.type, "evidence", "The evidence entry must carry its type.");
    assert.equal(evEntry.state, "stale", "The reached evidence must report its post-assessment stale state.");
    assert.ok(evEntry.distance > reqEntry.distance, "The evidence must sit further along the traversal than the requirement (proving depth > 1).");
    assert.ok(evEntry.distance >= 2, "The evidence must be at least two hops from the changed region.");

    // Transitive impact: the gate the requirement AFFECTS.
    const gateEntry = byId.get(gate.id) as { type: string } | undefined;
    assert.ok(gateEntry, "The affected gate must appear in the impact list.");
    assert.equal(gateEntry.type, "gate", "The gate entry must carry its type.");

    // The legacy id buckets must still agree with the impact list.
    assert.ok(result.staleEvidenceIds.includes(proof.id), "staleEvidenceIds must still include the reached evidence.");
    assert.ok(result.affectedRequirementIds.includes(requirement.id), "affectedRequirementIds must still include the changed requirement.");

    // ── Assess scenario B: no downstream edges ──────────────────────────────
    const emptyResult = await request(base, `/api/document-versions/${newVersionB.id}/assess-change`, { method: "POST" });
    assert.ok(Array.isArray(emptyResult.impact), "The no-downstream case must still return an impact array.");
    assert.equal(emptyResult.impact.length, 0, "A changed region with no downstream requirement must yield an empty impact list.");

    console.log(`Slice 14 change blast-radius verified: impact list traversed requirement -> evidence (distance ${evEntry.distance}) + gate across ${result.impact.length} records; no-downstream revision returned an empty impact list.`);
  } finally {
    // The route inserts a reassessment finding keyed by the new revision title.
    await db.delete(findings).where(like(findings.title, `%${findingTitleNeedle}%`));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (evidenceIds.length) await db.delete(evidence).where(inArray(evidence.id, evidenceIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (gateIds.length) await db.delete(gates).where(inArray(gates.id, gateIds));
    if (systemIds.length) await db.delete(systems).where(inArray(systems.id, systemIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
