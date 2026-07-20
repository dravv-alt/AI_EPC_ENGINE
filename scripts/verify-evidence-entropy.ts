import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { authSessions, documentVersions, documents, durableJobs, edges, evidence, gates, projectMembers, projects, requirements, sourceRegions, systems, tenants, users } from "../src/lib/db/schema";
import { getGateReadinessDetail } from "../src/lib/readiness/project-readiness";

// Slice 7 (CanonicalBuildPlan Feature 21): the evidence-entropy / weak-evidence
// score must be transparent (per-signal contributions, not just a total),
// honest about what it can't compute (unavailable + reason, never a silent
// zero), and strictly advisory — never able to move a computeReadiness
// verdict. This script proves all three against the real HTTP endpoint.
//
// Fixture, seeded directly (the endpoint itself is read-only over existing
// tables — there is no "create entropy signal" API):
//   - One evidence row PROVES 4 requirements (over the reuse threshold of 3)
//     -> evidenceOverReuse must fire with that evidence id as the outlier.
//   - One evidence row is validityState="stale"
//     -> staleOrUnsignedRecords must fire and list that id.
//   - Zero decisions are created for this project
//     -> overloadedApprover must report "unavailable" with a reason, not a
//        silent 0 contribution.

async function main() {
  const base = process.env.CREDENTIALS_TEST_URL ?? "http://localhost:4185";
  const email = `entropy-http-${Date.now()}@pramana.test`;
  const password = "FoundationPass2026";
  let userId: string | undefined; let projectId: string | undefined; let tenantId: string | undefined;
  let systemId: string | undefined; let documentId: string | undefined; let versionId: string | undefined; let regionId: string | undefined;
  const requirementIds: string[] = [];
  let overReuseEvidenceId: string | undefined; let staleEvidenceId: string | undefined;
  let gateId: string | undefined;

  const post = async (path: string, body: unknown, cookie: string) => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
    return data;
  };

  try {
    const register = await fetch(`${base}/api/auth/register`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, displayName: "Entropy Verifier", organizationName: "Entropy Isolated", projectName: "Entropy Contract Project", projectCode: `ENT-${Date.now()}`, timezone: "Asia/Kolkata" })
    });
    const registration = await register.json() as { user: { id: string }; project: { id: string; tenantId: string } };
    assert.equal(register.status, 201);
    userId = registration.user.id; projectId = registration.project.id; tenantId = registration.project.tenantId;
    const cookie = (register.headers.get("set-cookie") ?? "").split(";")[0];

    const enroll = await post("/api/auth/totp/enroll", { password }, cookie);
    const authenticator = new OTPAuth.TOTP({ issuer: "Pramana CX", label: email, secret: OTPAuth.Secret.fromBase32(enroll.secret), algorithm: "SHA1", digits: 6, period: 30 });
    await post("/api/auth/totp/verify", { token: authenticator.generate() }, cookie);

    [({ id: systemId } = (await db.insert(systems).values({ projectId, name: "Entropy verification system", systemType: "test" }).returning())[0])];
    [({ id: documentId } = (await db.insert(documents).values({ projectId, documentType: "procedure", title: "Entropy verification procedure" }).returning())[0])];
    [({ id: versionId } = (await db.insert(documentVersions).values({ documentId, revision: "V1", status: "approved", sha256: randomUUID().replaceAll("-", "").padEnd(64, "a"), objectKey: `verification/${randomUUID()}.pdf`, mediaType: "application/pdf", extractionStatus: "completed" }).returning())[0])];
    [({ id: regionId } = (await db.insert(sourceRegions).values({ documentVersionId: versionId, pageNumber: "1", extractedText: "The entropy verification system shall pass its controlled functional test.", contentHash: randomUUID().replaceAll("-", "").padEnd(64, "b") }).returning())[0])];

    // Four requirements, all to be over-proved by one evidence row.
    for (let index = 0; index < 4; index += 1) {
      const [row] = await db.insert(requirements).values({
        projectId, sourceRegionId: regionId, statement: `Entropy fixture requirement ${index} shall be satisfied.`, modality: "shall"
      }).returning({ id: requirements.id });
      requirementIds.push(row.id);
    }

    // Over-reused evidence: PROVES all four requirements (threshold is 3).
    const [overReuse] = await db.insert(evidence).values({
      projectId, systemId, evidenceType: "inspection", validityState: "accepted", capturedBy: userId, capturedAt: new Date()
    }).returning({ id: evidence.id });
    overReuseEvidenceId = overReuse.id;
    await db.insert(edges).values(requirementIds.map((requirementId) => ({
      projectId, fromType: "evidence", fromId: overReuse.id, relationshipType: "PROVES", toType: "requirement", toId: requirementId
    })));

    // Stale evidence record, unrelated to the reuse fixture above.
    const [stale] = await db.insert(evidence).values({
      projectId, systemId, evidenceType: "test_record", validityState: "stale", capturedBy: userId, capturedAt: new Date()
    }).returning({ id: evidence.id });
    staleEvidenceId = stale.id;

    // A gate, to prove the readiness-separation invariant below. Deliberately
    // NOT linked to any accepted requirement via AFFECTS, so readiness for it
    // resolves to the trivial "no accepted requirement" case either way —
    // what matters is that it is IDENTICAL before and after entropy runs.
    const [gate] = await db.insert(gates).values({ projectId, systemId, name: "Entropy readiness-separation gate", sequenceNumber: "1" }).returning({ id: gates.id });
    gateId = gate.id;

    function readinessSnapshot(readiness: NonNullable<Awaited<ReturnType<typeof getGateReadinessDetail>>>) {
      return JSON.stringify({
        state: readiness.state, acceptedRequirements: readiness.acceptedRequirements, requiredEvidence: readiness.requiredEvidence,
        acceptedEvidence: readiness.acceptedEvidence, missingEvidence: readiness.missingEvidence, unapprovedEvidence: readiness.unapprovedEvidence,
        staleEvidence: readiness.staleEvidence, failedEvidence: readiness.failedEvidence, blockingFindings: readiness.blockingFindings,
        unmetPrerequisites: readiness.unmetPrerequisites, proofDetails: readiness.proofDetails, blockingFindingDetails: readiness.blockingFindingDetails,
        prerequisiteDetails: readiness.prerequisiteDetails
      });
    }

    const before = await getGateReadinessDetail(projectId, gateId);
    assert.ok(before, "Readiness detail must resolve for the seeded gate before the entropy score is computed.");
    const beforeSnapshot = readinessSnapshot(before);

    // --- The seam: the HTTP endpoint's JSON response. ---
    const response = await fetch(`${base}/api/projects/${projectId}/entropy`, { headers: { cookie } });
    assert.equal(response.status, 200, "The entropy endpoint must return 200 for a project member.");
    const result = await response.json() as {
      total: number; maxPossible: number;
      signals: Array<{ key: string; mode: string; severity: number | null; contribution: number | null; reason: string; detail: Record<string, unknown> }>;
    };

    assert.equal(result.signals.length, 6, "All six Feature-21 signals must always be itemized, computed or not.");

    const overReuseSignal = result.signals.find((item) => item.key === "evidenceOverReuse");
    assert.ok(overReuseSignal, "evidenceOverReuse signal must be present.");
    assert.equal(overReuseSignal.mode, "computed");
    assert.ok(typeof overReuseSignal.contribution === "number" && overReuseSignal.contribution > 0, "An evidence row proving 4 requirements (over the threshold of 3) must contribute a positive score.");
    const outliers = overReuseSignal.detail.outliers as Array<{ evidenceId: string; provesCount: number }>;
    const outlierMatch = outliers.find((item) => item.evidenceId === overReuseEvidenceId);
    assert.ok(outlierMatch, "The over-reused evidence id must be named in the signal's detail.");
    assert.equal(outlierMatch.provesCount, 4, "The outlier's PROVES count must reflect all four seeded requirements.");

    const staleSignal = result.signals.find((item) => item.key === "staleOrUnsignedRecords");
    assert.ok(staleSignal);
    assert.equal(staleSignal.mode, "computed");
    assert.ok(typeof staleSignal.contribution === "number" && staleSignal.contribution > 0, "A stale evidence record must contribute a positive score.");
    assert.ok((staleSignal.detail.staleIds as string[]).includes(staleEvidenceId!), "The stale evidence id must be named in the signal's detail.");

    const approverSignal = result.signals.find((item) => item.key === "overloadedApprover");
    assert.ok(approverSignal, "overloadedApprover signal must be present.");
    assert.equal(approverSignal.mode, "unavailable", "With zero decisions recorded, the approver-concentration signal cannot be honestly scored and must report unavailable.");
    assert.equal(approverSignal.contribution, null, "An unavailable signal must never silently report a 0 contribution.");
    assert.ok(approverSignal.reason.length > 0, "An unavailable signal must always carry a human-readable reason.");
    assert.notEqual(approverSignal.severity, 0, "An unavailable signal's severity must be null, never a scored zero.");

    const computedTotal = Math.round(result.signals.reduce((sum, item) => sum + (item.contribution ?? 0), 0) * 100) / 100;
    assert.equal(result.total, computedTotal, "The returned total must equal the sum of the itemized per-signal contributions (drill-down must actually explain the total).");
    const computedCount = result.signals.filter((item) => item.mode === "computed").length;
    assert.ok(result.maxPossible >= computedTotal, "maxPossible must reflect only the signals that were actually computed.");
    assert.ok(computedCount < 6, "This fixture must produce at least one unavailable signal — proving unavailable is a real, reachable state, not just a code path.");

    // --- The separation invariant. ---
    const after = await getGateReadinessDetail(projectId, gateId);
    assert.ok(after);
    const afterSnapshot = readinessSnapshot(after);
    assert.equal(afterSnapshot, beforeSnapshot, "computeReadiness's output (via getGateReadinessDetail) must be byte-identical before and after the entropy score is computed — the score must never feed readiness.");

    console.log(`Slice 7 evidence-entropy verified: over-reuse (4 PROVES on evidence ${overReuseEvidenceId!.slice(0, 8)}) and stale-record signals fired with positive contributions, overloadedApprover correctly reported unavailable (not 0) with zero decisions, total=${result.total} matched the sum of itemized contributions, and gate readiness stayed byte-identical before/after computing the score.`);
  } finally {
    if (gateId) await db.delete(gates).where(eq(gates.id, gateId));
    if (projectId) await db.delete(edges).where(eq(edges.projectId, projectId));
    const evidenceIds = [overReuseEvidenceId, staleEvidenceId].filter((id): id is string => Boolean(id));
    if (evidenceIds.length) await db.delete(evidence).where(inArray(evidence.id, evidenceIds));
    if (requirementIds.length) await db.delete(requirements).where(inArray(requirements.id, requirementIds));
    if (regionId) await db.delete(sourceRegions).where(eq(sourceRegions.id, regionId));
    if (versionId) await db.delete(documentVersions).where(eq(documentVersions.id, versionId));
    if (documentId) await db.delete(documents).where(eq(documents.id, documentId));
    if (systemId) await db.delete(systems).where(eq(systems.id, systemId));
    if (userId) await db.delete(authSessions).where(eq(authSessions.userId, userId));
    if (projectId) await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    if (projectId) await db.delete(durableJobs).where(eq(durableJobs.projectId, projectId));
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
