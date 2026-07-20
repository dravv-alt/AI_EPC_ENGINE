import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { findings, gates, projectMembers, projects, systems } from "../src/lib/db/schema";
import { getGateReadinessDetail } from "../src/lib/readiness/project-readiness";

// Slice 5 (PRD US-05): an overdue finding must be visible in its gate's blocker
// view at ANY severity, flagged distinctly from severity-driven blockers, while
// the gate's readiness verdict (computeReadiness's output, reached through
// getGateReadinessDetail) must stay byte-identical to what it was before the
// overdue finding existed — overdue is a visibility concern, not a new
// readiness-blocking condition.
//
// Sequence on one freshly-seeded gate:
//   1. Snapshot readiness with NO findings at all ("before").
//   2. Insert one HIGH-severity, in-date (future dueAt) OPEN finding only.
//      Snapshot readiness again ("severity-only") — this is the behavior that
//      existed before this slice and must not move.
//   3. Insert one LOW-severity, OVERDUE (past dueAt) OPEN finding alongside it.
//      Snapshot readiness a third time ("severity+overdue").
// Assert: "severity-only" and "severity+overdue" are byte-identical on every
// computeReadiness input and the resulting state — proving the overdue finding
// changed visibility (blockingFindingDetails) but not the verdict. Also assert
// both findings surface in blockingFindingDetails with the correct `reasons`.

function readinessSnapshot(readiness: NonNullable<Awaited<ReturnType<typeof getGateReadinessDetail>>>) {
  return JSON.stringify({
    state: readiness.state,
    acceptedRequirements: readiness.acceptedRequirements,
    requiredEvidence: readiness.requiredEvidence,
    acceptedEvidence: readiness.acceptedEvidence,
    missingEvidence: readiness.missingEvidence,
    unapprovedEvidence: readiness.unapprovedEvidence,
    staleEvidence: readiness.staleEvidence,
    failedEvidence: readiness.failedEvidence,
    blockingFindings: readiness.blockingFindings,
    unmetPrerequisites: readiness.unmetPrerequisites
  });
}

async function main() {
  const tag = randomUUID().slice(0, 8);
  const gateIds: string[] = [];
  const findingIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
    assert.ok(project, "A seeded project is required.");
    const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.projectId, project.id)).limit(1);
    assert.ok(system, "A seeded system is required to anchor a gate.");
    const [member] = await db.select({ id: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, project.id)).limit(1);
    assert.ok(member, "A seeded project member is required to own findings.");

    const [gate] = await db.insert(gates).values({
      projectId: project.id, systemId: system.id, name: `Overdue verification gate ${tag}`, sequenceNumber: "9101"
    }).returning({ id: gates.id });
    gateIds.push(gate.id);

    // 1. Baseline: no findings at all.
    const before = await getGateReadinessDetail(project.id, gate.id);
    assert.ok(before, "Readiness detail must resolve for the seeded gate.");
    assert.equal(before.blockingFindingDetails.length, 0, "A freshly-seeded gate must start with no blocking finding details.");

    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 2. Only the high-severity, in-date finding — the pre-existing severity-driven behavior.
    const [highInDate] = await db.insert(findings).values({
      projectId: project.id, gateId: gate.id, title: `High-severity in-date finding ${tag}`,
      severity: "high", status: "open", ownerId: member.id, dueAt: future
    }).returning({ id: findings.id });
    findingIds.push(highInDate.id);
    const severityOnly = await getGateReadinessDetail(project.id, gate.id);
    assert.ok(severityOnly);
    const severityDetail = severityOnly.blockingFindingDetails.find((item) => item.id === highInDate.id);
    assert.ok(severityDetail, "A high-severity open finding must appear in blockingFindingDetails.");
    assert.equal(severityDetail.isOverdue, false, "A finding due in the future must not be flagged overdue.");
    assert.deepEqual(severityDetail.reasons, ["severity"], "A high-severity in-date finding must be flagged for the severity reason only.");
    assert.equal(severityOnly.blockingFindings, 1, "The single high-severity open finding must count as one severity-driven blocker.");

    // 3. Add the low-severity, overdue finding alongside it.
    const [lowOverdue] = await db.insert(findings).values({
      projectId: project.id, gateId: gate.id, title: `Low-severity overdue finding ${tag}`,
      severity: "low", status: "open", ownerId: member.id, dueAt: past
    }).returning({ id: findings.id });
    findingIds.push(lowOverdue.id);
    const severityAndOverdue = await getGateReadinessDetail(project.id, gate.id);
    assert.ok(severityAndOverdue);

    const overdueDetail = severityAndOverdue.blockingFindingDetails.find((item) => item.id === lowOverdue.id);
    assert.ok(overdueDetail, "A low-severity overdue finding must appear in blockingFindingDetails regardless of severity.");
    assert.equal(overdueDetail.isOverdue, true, "The past-due finding must be flagged isOverdue.");
    assert.deepEqual(overdueDetail.reasons, ["overdue"], "A low-severity overdue finding must be flagged for the overdue reason only, not severity.");
    assert.equal(overdueDetail.severity, "low");

    // The pre-existing high-severity finding's own entry must be unaffected by the new arrival.
    const severityDetailAfter = severityAndOverdue.blockingFindingDetails.find((item) => item.id === highInDate.id);
    assert.ok(severityDetailAfter);
    assert.deepEqual(severityDetailAfter.reasons, ["severity"]);

    // 4. The readiness verdict — and every computeReadiness input, including
    // blockingFindings — must be byte-identical before and after the overdue
    // finding exists.
    assert.equal(readinessSnapshot(severityAndOverdue), readinessSnapshot(severityOnly), "Adding a low-severity overdue finding must not change computeReadiness's inputs or verdict.");
    assert.equal(severityAndOverdue.blockingFindings, 1, "blockingFindings must stay severity-driven only; the overdue finding must not inflate it.");
    assert.equal(severityAndOverdue.blockingFindingDetails.length, 2, "The blocker view must list both the severity blocker and the overdue finding.");

    console.log(`Slice 5 overdue findings verified: gate ${gate.id.slice(0, 8)} surfaces low-severity overdue (reasons=[overdue]) and high-severity in-date (reasons=[severity]) blockers in the detail view; computeReadiness's verdict and every input stayed byte-identical after the overdue finding was added.`);
  } finally {
    if (findingIds.length) await db.delete(findings).where(inArray(findings.id, findingIds));
    if (gateIds.length) await db.delete(gates).where(inArray(gates.id, gateIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
