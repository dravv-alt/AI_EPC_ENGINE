import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { assets, auditEvents, authSessions, decisions, documentVersions, documents, edges, evidence, gates, projectMembers, projects, requirements, sourceRegions, storageObjects, systems, tenants, turnoverPacks, users, durableJobs } from "../src/lib/db/schema";
import { objectStorage } from "../src/lib/storage/service";
import { READINESS_RULE_VERSION } from "../src/lib/readiness/project-readiness";

async function main() {
  const base = process.env.TURNOVER_PROVENANCE_TEST_URL ?? "http://localhost:4185"; const email = `turnover-provenance-http-${Date.now()}@pramana.test`; const password = "FoundationPass2026"; let userId: string | undefined; let projectId: string | undefined; let tenantId: string | undefined; let systemId: string | undefined; let gateId: string | undefined; let documentId: string | undefined; let versionId: string | undefined; let regionId: string | undefined; let requirementId: string | undefined; let evidenceId: string | undefined; let decisionId: string | undefined; let packId: string | undefined; let objectId: string | undefined; let objectKey: string | undefined;
  const post = async (path: string, body: unknown, cookie: string) => { const response = await fetch(`${base}${path}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`); return data; };
  try {
    const register = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, displayName: "Turnover Provenance Verifier", organizationName: "Turnover Provenance Isolated", projectName: "Turnover Provenance Contract Project", projectCode: `TP-${Date.now()}`, timezone: "Asia/Kolkata" }) }); const registration = await register.json() as { user: { id: string }; project: { id: string; tenantId: string } }; assert.equal(register.status, 201); userId = registration.user.id; projectId = registration.project.id; tenantId = registration.project.tenantId; const cookie = (register.headers.get("set-cookie") ?? "").split(";")[0];
    const enroll = await post("/api/auth/totp/enroll", { password }, cookie); const authenticator = new OTPAuth.TOTP({ issuer: "Pramana CX", label: email, secret: OTPAuth.Secret.fromBase32(enroll.secret), algorithm: "SHA1", digits: 6, period: 30 }); await post("/api/auth/totp/verify", { token: authenticator.generate() }, cookie);
    [({ id: systemId } = (await db.insert(systems).values({ projectId, name: "Verification system", systemType: "test" }).returning())[0])];
    [({ id: gateId } = (await db.insert(gates).values({ projectId, systemId, name: "Verification gate", sequenceNumber: "1", status: "in_review" }).returning())[0])];
    [({ id: documentId } = (await db.insert(documents).values({ projectId, documentType: "procedure", title: "Verification procedure" }).returning())[0])];
    // extractionModel/extractionProvider seeded directly to known values, as
    // the prompt allows, to assert the manifest carries EXACTLY what is
    // stored on the documentVersions row rather than some other value.
    [({ id: versionId } = (await db.insert(documentVersions).values({ documentId, revision: "V1", status: "approved", sha256: randomUUID().replaceAll("-", "").padEnd(64, "a"), objectKey: `verification/${randomUUID()}.pdf`, mediaType: "application/pdf", extractionStatus: "completed", extractionModel: "deterministic-mock-v1", extractionProvider: "mock" }).returning())[0])];
    [({ id: regionId } = (await db.insert(sourceRegions).values({ documentVersionId: versionId, pageNumber: "1", extractedText: "The verification system shall pass its controlled functional test.", contentHash: randomUUID().replaceAll("-", "").padEnd(64, "b") }).returning())[0])];
    [({ id: requirementId } = (await db.insert(requirements).values({ projectId, sourceRegionId: regionId, statement: "The verification system shall pass its controlled functional test.", modality: "shall", reviewState: "accepted", reviewedBy: userId, reviewedAt: new Date() }).returning())[0])];
    await db.insert(edges).values({ projectId, fromType: "requirement", fromId: requirementId, relationshipType: "AFFECTS", toType: "gate", toId: gateId });
    const captured = await post(`/api/projects/${projectId}/evidence`, { systemId, evidenceType: "functional_test", capturedAt: new Date().toISOString(), contentHash: "c".repeat(64) }, cookie); evidenceId = captured.evidence.id; assert.equal(captured.evidence.validityState, "pending");
    const reviewed = await post(`/api/evidence/${evidenceId}/review`, { decision: "accept", requirementIds: [requirementId], note: "Controlled test artifact reviewed against the accepted requirement" }, cookie); assert.equal(reviewed.evidence.validityState, "accepted");
    const decision = await post(`/api/gates/${gateId}/decisions`, { decision: "approve", reason: "The accepted immutable test artifact directly proves the sole accepted gate requirement." }, cookie); decisionId = decision.decision.id; assert.equal(decision.gateStatus, "approved");
    const turnover = await post(`/api/projects/${projectId}/turnover-packs`, { gateId }, cookie); packId = turnover.pack.id; objectKey = turnover.pack.objectKey; decisionId = turnover.pack.decisionId; assert.equal(turnover.verified, true);

    const manifest = turnover.pack.manifest;
    assert.equal(typeof manifest.readinessRuleVersion, "string", "manifest.readinessRuleVersion must be a string");
    assert.ok(manifest.readinessRuleVersion.length > 0, "manifest.readinessRuleVersion must be non-empty");
    assert.equal(manifest.readinessRuleVersion, READINESS_RULE_VERSION, "manifest.readinessRuleVersion must match the fixed readiness rule constant");

    assert.ok(Array.isArray(manifest.sources), "manifest.sources must be an array");
    const sourceEntry = manifest.sources.find((source: { id: string }) => source.id === versionId);
    assert.ok(sourceEntry, "the seeded document version must be listed in manifest.sources");
    assert.equal(sourceEntry.extractionModel, "deterministic-mock-v1", "manifest source entry must carry the extractionModel actually stored on documentVersions");
    assert.equal(sourceEntry.extractionProvider, "mock", "manifest source entry must carry the extractionProvider actually stored on documentVersions");

    const [stored] = await db.select().from(storageObjects).where(eq(storageObjects.objectKey, objectKey)); objectId = stored.id;
    const verification = await fetch(`${base}/api/turnover-packs/${packId}/verify`, { headers: { cookie } }).then((response) => response.json()); assert.equal(verification.verified, true);
    console.log("Turnover provenance HTTP verification passed: manifest carries a non-empty readinessRuleVersion and each source entry carries the exact extractionModel/extractionProvider stored on its documentVersions row.");
  } finally {
    if (packId) await db.delete(turnoverPacks).where(eq(turnoverPacks.id, packId)); if (objectId) await db.delete(storageObjects).where(eq(storageObjects.id, objectId)); if (objectKey) await objectStorage.remove(objectKey); if (decisionId) await db.delete(decisions).where(eq(decisions.id, decisionId)); if (projectId) await db.delete(auditEvents).where(eq(auditEvents.projectId, projectId)); if (projectId) await db.delete(edges).where(eq(edges.projectId, projectId)); if (evidenceId) await db.delete(evidence).where(eq(evidence.id, evidenceId)); if (requirementId) await db.delete(requirements).where(eq(requirements.id, requirementId)); if (regionId) await db.delete(sourceRegions).where(eq(sourceRegions.id, regionId)); if (versionId) await db.delete(documentVersions).where(eq(documentVersions.id, versionId)); if (documentId) await db.delete(documents).where(eq(documents.id, documentId)); if (gateId) await db.delete(gates).where(eq(gates.id, gateId)); if (systemId) await db.delete(systems).where(eq(systems.id, systemId)); if (userId) await db.delete(authSessions).where(eq(authSessions.userId, userId)); if (projectId) await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId)); if (projectId) await db.delete(durableJobs).where(eq(durableJobs.projectId, projectId)); if (projectId) await db.delete(projects).where(eq(projects.id, projectId)); if (userId) await db.delete(users).where(eq(users.id, userId)); if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
