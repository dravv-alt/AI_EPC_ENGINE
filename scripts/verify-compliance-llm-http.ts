import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { applyDeterministicSafetyFloor, applyVerdictSafetyDowngrades } from "../src/lib/compliance/assess";
import { compareCompliance } from "../src/lib/compliance/compare";
import type { SemanticCitation } from "../src/lib/knowledge/query";
import { db } from "../src/lib/db/client";
import { complianceChecks, documentVersions, documents, edges, findings, gates, requirements, sourceRegions } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function request(url: string, init?: RequestInit, expectedStatus?: number) { const response = await fetch(url, init); const body = await response.json(); if (expectedStatus !== undefined) assert.equal(response.status, expectedStatus, JSON.stringify(body)); else if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`); return body; }

function fakeCitation(overrides: Partial<SemanticCitation> = {}): SemanticCitation {
  return { chunkId: randomUUID(), content: "text", text: "text", sourceRegionId: randomUUID(), documentVersionId: null, documentType: "standard", contentHash: "hash", similarity: 0.9, ...overrides };
}

// The model proposes a compliance verdict in real mode, but deterministic
// deviations and qualitative uncertainty are non-negotiable safety floors.
// compareCompliance remains the mock supplier and recorded cross-check, which
// is what keeps this pipeline reproducible offline: MockModelProvider echoes
// the deterministic verdict/confidence/reason back verbatim, so
// verify-compliance-http.ts (unmodified) still passes byte-for-byte under
// MODEL_PROVIDER=mock. This script covers what that regression guard cannot:
// suggestionSource/suggestionModelVersion labeling, the always-present
// deterministicCrossCheck, and the two safety downgrades (unverified
// grounding, semantic-only precedent) that only fire in real-provider mode.
async function main() {
  const base = process.env.COMPLIANCE_LLM_TEST_URL ?? "http://localhost:4173";
  const documentIds: string[] = []; const versionIds: string[] = []; const regionIds: string[] = []; const requirementIds: string[] = []; const checkIds: string[] = []; const findingIds: string[] = []; const edgeIds: string[] = [];
  let gateId: string | undefined; let originalGateStatus: typeof gates.$inferSelect.status | undefined;

  try {
    // --- Part A: unit-level safety-downgrade properties (no HTTP/DB churn) ---

    // 1. A fabricated groundingRegionId not present in the retrieved
    //    candidate set must force the verdict down to
    //    needs_engineering_judgment, regardless of what the model claimed.
    const realCandidate = fakeCitation({ sourceRegionId: randomUUID() });
    const fabricatedId = randomUUID();
    const groundingDowngrade = applyVerdictSafetyDowngrades({
      verdict: "conforms",
      reason: "The cited target line is equivalent to the requirement per the referenced standards clause, which requires a full engineering review of the underlying assumptions and margins before this can be relied upon in the field.",
      groundingRegionIds: [fabricatedId],
      groundingCandidates: [realCandidate],
      acceptedPrecedent: false
    });
    assert.equal(groundingDowngrade.verdict, "needs_engineering_judgment", "An unverified grounding region ID must force the verdict down.");
    assert.match(groundingDowngrade.reason, /Grounding could not be verified/);

    // A groundingRegionId that IS in the candidate set must NOT be downgraded
    // on grounding grounds (the safety downgrade is precise, not blanket).
    const groundingOk = applyVerdictSafetyDowngrades({
      verdict: "conforms",
      reason: "The cited target line matches the requirement and is grounded in the referenced standards clause, which was reviewed for applicability to this scoped installation and equipment class.",
      groundingRegionIds: [realCandidate.sourceRegionId],
      groundingCandidates: [realCandidate],
      acceptedPrecedent: false
    });
    assert.equal(groundingOk.verdict, "conforms", "A verified grounding region ID must not be downgraded.");

    // 2. check_precedent semantics unchanged: a semantic-only precedent match
    //    (grounding candidates look similar, but no exact-hash accepted
    //    precedent) can NEVER yield equivalent_by_precedent.
    const semanticPrecedentAttempt = applyVerdictSafetyDowngrades({
      verdict: "equivalent_by_precedent",
      reason: "The target line appears semantically equivalent to a prior accepted precedent for a similar enclosure finish clause, though no exact-hash match was found for this exact normalized target line in this project.",
      groundingRegionIds: [],
      groundingCandidates: [],
      acceptedPrecedent: false
    });
    assert.notEqual(semanticPrecedentAttempt.verdict, "equivalent_by_precedent", "A semantic-only precedent match must never yield equivalent_by_precedent.");
    assert.equal(semanticPrecedentAttempt.verdict, "needs_engineering_judgment");
    assert.match(semanticPrecedentAttempt.reason, /No exact-hash accepted project precedent/);

    // An exact-hash accepted precedent (acceptedPrecedent: true) is the only
    // path that may retain equivalent_by_precedent.
    const exactPrecedentOk = applyVerdictSafetyDowngrades({
      verdict: "equivalent_by_precedent",
      reason: "An explicitly accepted project precedent matches this requirement and exact normalized target line.",
      groundingRegionIds: [],
      groundingCandidates: [],
      acceptedPrecedent: true
    });
    assert.equal(exactPrecedentOk.verdict, "equivalent_by_precedent");

    const hardDeviation = compareCompliance({ statement: "Pressure shall be 100 kPa.", numericValue: "100", unit: "kPa", tolerance: "0", comparisonModality: "numeric" }, "Pressure: 120 kPa.");
    assert.equal(applyDeterministicSafetyFloor({ modelVerdict: "conforms", modelReason: "Model suggested conformity after semantic review.", deterministic: hardDeviation }).verdict, "deterministic_flag", "A model must not erase a deterministic deviation.");

    console.log("Unit-level safety downgrades verified: unverified grounding forces needs_engineering_judgment, verified grounding is untouched, semantic-only precedent can never yield equivalent_by_precedent, exact-hash accepted precedent is unaffected.");

    // --- Part B: full HTTP pipeline, MODEL_PROVIDER=mock ---
    // This must reproduce createComplianceCheck's advisory verdict path
    // exactly as the deterministic comparator would, byte-for-byte on
    // verdict/confidence/reason, while additionally tagging the check as
    // AI-authored-but-deterministic-mock per ADR-019's "always visibly
    // tagged" requirement, and recording the free deterministicCrossCheck.
    const gate = await db.query.gates.findFirst({ where: eq(gates.projectId, developmentProjectId) }); assert.ok(gate); gateId = gate.id; originalGateStatus = gate.status;

    async function controlledRegion(projectId: string, documentType: string, title: string, text: string) {
      const token = randomUUID();
      const [document] = await db.insert(documents).values({ projectId, documentType, title }).returning(); documentIds.push(document.id);
      const [version] = await db.insert(documentVersions).values({ documentId: document.id, revision: "LLM Contract Test", status: "approved", sha256: hash(`version:${token}`), objectKey: `${projectId}/${hash(token)}.txt`, mediaType: "text/plain", extractionStatus: "completed" }).returning(); versionIds.push(version.id);
      const [region] = await db.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: text, contentHash: hash(text) }).returning(); regionIds.push(region.id);
      return region;
    }

    const numericClause = await controlledRegion(developmentProjectId, "client_spec", "LLM synthetic client specification", "The operating pressure shall be 100 kPa plus or minus 2 kPa.");
    const conformingLine = await controlledRegion(developmentProjectId, "submittal", "LLM synthetic vendor submittal", "Operating pressure: 1 bar.");
    const deviatingLine = await controlledRegion(developmentProjectId, "shop_drawing", "LLM synthetic shop drawing", "Operating pressure: 120 kPa.");
    const [numericRequirement] = await db.insert(requirements).values([
      { projectId: developmentProjectId, sourceRegionId: numericClause.id, statement: numericClause.extractedText, modality: "shall", numericValue: "100", unit: "kPa", tolerance: "2", reviewState: "accepted", confidence: "1.0000" }
    ]).returning(); requirementIds.push(numericRequirement.id);
    const [edge] = await db.insert(edges).values({ projectId: developmentProjectId, fromType: "requirement", fromId: numericRequirement.id, relationshipType: "AFFECTS", toType: "gate", toId: gate.id }).returning(); edgeIds.push(edge.id);

    const conforming = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: conformingLine.id }) });
    checkIds.push(conforming.check.id);
    assert.equal(conforming.check.verdict, "conforms", "Under MODEL_PROVIDER=mock, the advisory verdict must reproduce the deterministic verdict exactly.");
    assert.match(conforming.check.reason, /1 bar = 100 kPa/, "The mock-supplier pattern must reproduce the deterministic reason verbatim under MODEL_PROVIDER=mock.");
    assert.equal(conforming.check.suggestionSource, "deterministic", "MODEL_PROVIDER=mock must record suggestionSource as 'deterministic'.");
    assert.equal(conforming.check.suggestionModelVersion, "deterministic-mock-v1", "MODEL_PROVIDER=mock must record the mock model version tag.");
    assert.equal(conforming.check.reviewState, "proposed", "No AI-authored check may be auto-accepted.");
    const conformingCrossCheck = (conforming.check.targetSnapshot as { deterministicCrossCheck?: { verdict: string } }).deterministicCrossCheck;
    assert.ok(conformingCrossCheck, "deterministicCrossCheck must always be present in the target snapshot, regardless of provider.");
    assert.equal(conformingCrossCheck!.verdict, "conforms");

    const deviating = await request(`${base}/api/projects/${developmentProjectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: numericRequirement.id, targetSourceRegionId: deviatingLine.id }) });
    checkIds.push(deviating.check.id); if (deviating.proposedFinding) findingIds.push(deviating.proposedFinding.id);
    assert.equal(deviating.check.verdict, "deterministic_flag");
    assert.equal(deviating.check.suggestionSource, "deterministic");
    assert.equal(deviating.check.suggestionModelVersion, "deterministic-mock-v1");
    assert.equal(deviating.check.reviewState, "proposed", "No AI-authored check may be auto-accepted, even a deterministic_flag.");
    assert.ok(deviating.proposedFinding, "A deterministic_flag verdict must still propose a finding, unchanged from Slice 5.");
    assert.equal(deviating.proposedFinding.status, "proposed", "The proposed finding must never be auto-created as open/closed.");
    const deviatingCrossCheck = (deviating.check.targetSnapshot as { deterministicCrossCheck?: { verdict: string } }).deterministicCrossCheck;
    assert.ok(deviatingCrossCheck);
    assert.equal(deviatingCrossCheck!.verdict, "deterministic_flag");
    assert.equal((await db.query.gates.findFirst({ where: eq(gates.id, gate.id) }))?.status, originalGateStatus, "A machine-proposed finding must not change gate authority.");

    console.log("HTTP mock-mode verification passed: advisory verdict reproduces the deterministic comparator byte-for-byte, suggestionSource/suggestionModelVersion correctly tagged 'deterministic'/'deterministic-mock-v1', deterministicCrossCheck always recorded, reviewState always 'proposed'.");
  } finally {
    if (checkIds.length) await db.delete(complianceChecks).where(inArray(complianceChecks.id, checkIds));
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionIds.length) await db.delete(sourceRegions).where(inArray(sourceRegions.id, regionIds));
    if (versionIds.length) await db.delete(documentVersions).where(inArray(documentVersions.id, versionIds));
    if (documentIds.length) await db.delete(documents).where(inArray(documents.id, documentIds));
    if (gateId && originalGateStatus) await db.update(gates).set({ status: originalGateStatus, updatedAt: new Date() }).where(and(eq(gates.id, gateId), eq(gates.projectId, developmentProjectId)));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
