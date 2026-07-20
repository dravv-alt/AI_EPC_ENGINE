import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { auditEvents, authSessions, decisions, documents, durableJobs, gates, projectMembers, projects, scheduleAssignments, scheduleTasks, scheduleVersions, storageObjects, systems, tenants, turnoverPacks, users } from "../src/lib/db/schema";
import { objectStorage } from "../src/lib/storage/service";
import { canonicalJson } from "../src/lib/crypto/canonical-json";

// This script's raison d'etre: the turnover manifest carries no schedule
// snapshot at all, so the TRD's "CP-SAT solver version and Gemini model
// version" requirement has nothing to attach to. It asserts three things
// about `scheduleSnapshot` on the turnover-packs HTTP route response:
//   1. it appears with the correct solver/model provenance and its
//      assignments/criticalTaskIds sorted deterministically;
//   2. that determinism holds across two independent generation calls
//      (the manifest is canonical-JSON hashed, so unsorted arrays would make
//      `manifestHash` unstable across runs);
//   3. it is omitted cleanly (no null-filled stub) for a schedule-less
//      project.

async function main() {
  const base = process.env.TURNOVER_SCHEDULE_PROVENANCE_TEST_URL ?? "http://localhost:4185";
  const email = `turnover-schedule-provenance-http-${Date.now()}@pramana.test`;
  const password = "FoundationPass2026";

  const cleanup: Array<() => Promise<void>> = [];

  async function registerProject(suffix: string) {
    const register = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `${suffix}-${email}`,
        password,
        displayName: "Turnover Schedule Provenance Verifier",
        organizationName: `Turnover Schedule Provenance Isolated ${suffix}`,
        projectName: `Turnover Schedule Provenance Contract Project ${suffix}`,
        projectCode: `TSP-${suffix}-${Date.now()}`,
        timezone: "Asia/Kolkata"
      })
    });
    const registration = (await register.json()) as { user: { id: string }; project: { id: string; tenantId: string } };
    assert.equal(register.status, 201);
    const cookie = (register.headers.get("set-cookie") ?? "").split(";")[0];
    const userId = registration.user.id;
    const projectId = registration.project.id;
    const tenantId = registration.project.tenantId;

    const post = async (path: string, body: unknown) => {
      const response = await fetch(`${base}${path}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
      return data;
    };

    const enroll = await post("/api/auth/totp/enroll", { password });
    const authenticator = new OTPAuth.TOTP({ issuer: "Pramana CX", label: `${suffix}-${email}`, secret: OTPAuth.Secret.fromBase32(enroll.secret), algorithm: "SHA1", digits: 6, period: 30 });
    await post("/api/auth/totp/verify", { token: authenticator.generate() });

    cleanup.push(async () => {
      await db.delete(authSessions).where(eq(authSessions.userId, userId));
      await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
      await db.delete(durableJobs).where(eq(durableJobs.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    });

    return { cookie, userId, projectId, tenantId, post };
  }

  async function approveGate(fixture: Awaited<ReturnType<typeof registerProject>>) {
    const { projectId, cookie, post } = fixture;
    const [system] = await db.insert(systems).values({ projectId, name: "Verification system", systemType: "test" }).returning();
    const [gate] = await db.insert(gates).values({ projectId, systemId: system.id, name: "Verification gate", sequenceNumber: "1", status: "in_review" }).returning();
    const [document] = await db.insert(documents).values({ projectId, documentType: "procedure", title: "Verification procedure" }).returning();
    const decision = await post(`/api/gates/${gate.id}/decisions`, { decision: "waive", reason: "No accepted requirements are outstanding against this verification gate; waived for isolated contract testing." });
    assert.equal(decision.gateStatus, "approved");

    cleanup.push(async () => {
      await db.delete(auditEvents).where(eq(auditEvents.projectId, projectId));
      await db.delete(decisions).where(eq(decisions.id, decision.decision.id));
      await db.delete(documents).where(eq(documents.id, document.id));
      await db.delete(gates).where(eq(gates.id, gate.id));
      await db.delete(systems).where(eq(systems.id, system.id));
    });

    return { gateId: gate.id as string };
  }

  async function generateTurnoverPack(fixture: Awaited<ReturnType<typeof registerProject>>, gateId: string) {
    const turnover = await fixture.post(`/api/projects/${fixture.projectId}/turnover-packs`, { gateId });
    assert.equal(turnover.verified, true);
    const [stored] = await db.select().from(storageObjects).where(eq(storageObjects.objectKey, turnover.pack.objectKey));
    cleanup.push(async () => {
      await db.delete(turnoverPacks).where(eq(turnoverPacks.id, turnover.pack.id));
      if (stored) await db.delete(storageObjects).where(eq(storageObjects.id, stored.id));
      await objectStorage.remove(turnover.pack.objectKey);
    });
    return turnover;
  }

  // Hashes a manifest with fields normalized out that legitimately change
  // between two separate HTTP calls for reasons unrelated to this slice:
  // `generatedAt` is wall-clock generation metadata, and `auditChainHead`
  // legitimately advances because generating a turnover pack itself appends
  // a "turnover.generated" audit event, so the second call's chain head
  // reflects the first call's event. What must be stable across two calls
  // (the actual sort-determinism claim under test) is everything else
  // derived from the DB rows — sources, evidence, edges, and this slice's
  // scheduleSnapshot.
  function normalizedManifestHash(manifest: Record<string, unknown>) {
    const normalized = { ...manifest, generatedAt: "NORMALIZED", auditChainHead: "NORMALIZED" };
    return createHash("sha256").update(canonicalJson(normalized)).digest("hex");
  }

  try {
    // --- Fixture A: a project with a solved schedule version. ---
    const withSchedule = await registerProject("with-schedule");
    const [taskB, taskA] = await db
      .insert(scheduleTasks)
      .values([
        { projectId: withSchedule.projectId, name: "Task B", durationHours: 4, reviewState: "accepted" },
        { projectId: withSchedule.projectId, name: "Task A", durationHours: 6, reviewState: "accepted" }
      ])
      .returning();
    // Inserted deliberately out of task-id order, and with a scrambled
    // criticalTaskIds array, so the "sorted deterministically" requirement
    // actually has something to prove.
    const [scheduleVersion] = await db
      .insert(scheduleVersions)
      .values({
        projectId: withSchedule.projectId,
        versionNumber: 1,
        reason: "Isolated schedule provenance contract verification",
        solverStatus: "OPTIMAL",
        solverVersion: "ortools-cp-sat-v-provenance-test",
        inputHash: randomUUID().replaceAll("-", "").padEnd(64, "c"),
        objectiveHours: 10,
        criticalTaskIds: [taskA.id, taskB.id].sort().reverse(),
        explanationModelVersion: "gemini-schedule-provenance-test-v1",
        createdBy: withSchedule.userId
      })
      .returning();
    await db.insert(scheduleAssignments).values([
      { versionId: scheduleVersion.id, taskId: taskB.id, startAt: new Date("2026-01-01T00:00:00Z"), endAt: new Date("2026-01-01T04:00:00Z"), isCritical: false },
      { versionId: scheduleVersion.id, taskId: taskA.id, startAt: new Date("2026-01-01T04:00:00Z"), endAt: new Date("2026-01-01T10:00:00Z"), isCritical: true }
    ]);
    cleanup.push(async () => {
      await db.delete(scheduleAssignments).where(eq(scheduleAssignments.versionId, scheduleVersion.id));
      await db.delete(scheduleVersions).where(eq(scheduleVersions.id, scheduleVersion.id));
      await db.delete(scheduleTasks).where(eq(scheduleTasks.projectId, withSchedule.projectId));
    });

    const gateWithSchedule = await approveGate(withSchedule);
    const firstGeneration = await generateTurnoverPack(withSchedule, gateWithSchedule.gateId);
    const firstManifest = firstGeneration.pack.manifest as Record<string, unknown>;

    const snapshot = firstManifest.scheduleSnapshot as {
      versionNumber: number;
      solverStatus: string;
      solverVersion: string;
      objectiveHours: number;
      inputHash: string;
      criticalTaskIds: string[];
      explanationModelVersion: string;
      assignments: Array<{ taskId: string; startAt: string; endAt: string; isCritical: boolean }>;
    };
    assert.ok(snapshot, "manifest.scheduleSnapshot must be present for a project with a schedule version");
    assert.equal(snapshot.versionNumber, 1, "scheduleSnapshot.versionNumber must match the schedule_versions row");
    assert.equal(snapshot.solverStatus, "OPTIMAL", "scheduleSnapshot.solverStatus must match the schedule_versions row");
    assert.equal(snapshot.solverVersion, "ortools-cp-sat-v-provenance-test", "scheduleSnapshot.solverVersion must carry the CP-SAT solver version");
    assert.equal(snapshot.objectiveHours, 10, "scheduleSnapshot.objectiveHours must match the schedule_versions row");
    assert.equal(snapshot.inputHash, scheduleVersion.inputHash, "scheduleSnapshot.inputHash must match the schedule_versions row");
    assert.equal(snapshot.explanationModelVersion, "gemini-schedule-provenance-test-v1", "scheduleSnapshot.explanationModelVersion must carry the Gemini model version");
    assert.deepEqual(snapshot.criticalTaskIds, [taskA.id, taskB.id].sort(), "scheduleSnapshot.criticalTaskIds must be sorted deterministically");
    assert.equal(snapshot.assignments.length, 2, "scheduleSnapshot.assignments must include every assignment on the version");
    assert.deepEqual(
      snapshot.assignments.map((item) => item.taskId),
      [taskA.id, taskB.id].sort(),
      "scheduleSnapshot.assignments must be sorted deterministically by taskId, independent of insertion/select order"
    );
    const criticalAssignment = snapshot.assignments.find((item) => item.taskId === taskA.id);
    assert.equal(criticalAssignment?.isCritical, true, "assignment fields must reflect the underlying schedule_assignments row");

    // --- Cycle 2: manifestHash stability across two independent generations. ---
    const secondGeneration = await generateTurnoverPack(withSchedule, gateWithSchedule.gateId);
    const secondManifest = secondGeneration.pack.manifest as Record<string, unknown>;
    assert.notEqual(firstGeneration.pack.manifestHash, secondGeneration.pack.manifestHash, "two live generations legitimately differ only by generatedAt, so raw manifestHash is NOT expected to collide");
    assert.deepEqual(secondManifest.scheduleSnapshot, firstManifest.scheduleSnapshot, "scheduleSnapshot must be byte-identical across two independent generation calls (sort determinism)");
    assert.equal(
      normalizedManifestHash(firstManifest),
      normalizedManifestHash(secondManifest),
      "manifestHash computed over the generatedAt-normalized manifest must be stable across two generations of identical underlying input"
    );

    // --- Fixture B: a project with no schedule version at all. ---
    const withoutSchedule = await registerProject("without-schedule");
    const gateWithoutSchedule = await approveGate(withoutSchedule);
    const noScheduleGeneration = await generateTurnoverPack(withoutSchedule, gateWithoutSchedule.gateId);
    const noScheduleManifest = noScheduleGeneration.pack.manifest as Record<string, unknown>;
    assert.equal("scheduleSnapshot" in noScheduleManifest, false, "manifest must omit scheduleSnapshot entirely (no null-filled stub) for a project with no schedule version");

    console.log("Turnover schedule provenance HTTP verification passed: scheduleSnapshot carries the CP-SAT solver version and Gemini explanation model version with deterministically sorted arrays, is stable across two independent generations, and is cleanly omitted when no schedule version exists.");
  } finally {
    for (const teardown of cleanup.reverse()) await teardown().catch((error) => console.error("cleanup step failed", error));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
