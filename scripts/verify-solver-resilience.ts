import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

// Slice 2: Rules.md line 33 requires the CP-SAT solver call to be bounded (never
// hang a request) and Rules.md line 88 requires a SOLVE_FAILED transition to be
// reconstructible from the audit chain alone. This stands up a local node:http
// stub in place of the solver service and drives it through the real entry
// points — solveSchedule() indirectly via createScheduleVersion(), and
// processScheduleEvent() for the retry-resubmission path — never an internal
// mock. Env is set before any app module is imported so env.ts picks it up.

process.env.SOLVER_TIMEOUT_MS = "1000";
process.env.SOLVER_MAX_ATTEMPTS = "3";

type StubMode = "ok" | "timeout" | "recovering";

function solverPayload(taskId: string) {
  return JSON.stringify({
    status: "OPTIMAL",
    assignments: [{ task_id: taskId, start_offset: 0, end_offset: 4 }],
    objective_hours: 4,
    critical_task_ids: [taskId],
    bottlenecks: [],
    overrun_hours: 0,
    deadline_breaches: []
  });
}

async function main() {
  let mode: StubMode = "ok";
  let hits = 0;
  let recoveringAttempt = 0;
  let taskIdForStub = "";
  const pendingSockets = new Set<import("node:net").Socket>();

  const server: Server = createServer((req, res) => {
    hits += 1;
    if (mode === "timeout") {
      // Never respond. The client must abort via AbortSignal.timeout rather
      // than the request hanging forever.
      return;
    }
    if (mode === "recovering") {
      recoveringAttempt += 1;
      if (recoveringAttempt === 1) { res.statusCode = 503; res.end("stub: temporarily unavailable"); return; }
      res.setHeader("content-type", "application/json");
      res.end(solverPayload(taskIdForStub));
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(solverPayload(taskIdForStub));
  });
  server.on("connection", (socket) => { pendingSockets.add(socket); socket.on("close", () => pendingSockets.delete(socket)); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  process.env.SOLVER_SERVICE_URL = `http://127.0.0.1:${port}`;

  const { db } = await import("../src/lib/db/client");
  const { alerts, auditEvents, durableJobs, projects, projectMembers, riskSignals, scheduleAssignments, scheduleEvents, scheduleTasks, scheduleVersions } = await import("../src/lib/db/schema");
  const { createScheduleVersion } = await import("../src/lib/schedule/create-version");
  const { SolverUnavailableError } = await import("../src/lib/schedule/solver");
  const { processScheduleEvent } = await import("../src/lib/events/process");
  const { eq, and, inArray } = await import("drizzle-orm");

  const testProjectId = randomUUID();
  const actorId = "10000000-0000-4000-8000-000000000002"; // Aarav Mehta (admin), seeded
  const versionIds: string[] = [];
  const eventDbIds: string[] = [];

  try {
    await db.insert(projects).values({ id: testProjectId, tenantId: "10000000-0000-4000-8000-000000000001", name: "Solver Resilience Verification", code: `SRV-${testProjectId.slice(0, 8)}`, timezone: "Asia/Kolkata" });
    await db.insert(projectMembers).values({ projectId: testProjectId, userId: actorId, role: "admin" });
    const [task] = await db.insert(scheduleTasks).values({ projectId: testProjectId, name: "Solver resilience task", durationHours: 4, reviewState: "accepted" }).returning();
    taskIdForStub = task.id;

    const horizonStart = new Date();

    // --- Step 1: baseline solve succeeds normally, establishing v1. ---
    mode = "ok"; hits = 0;
    const baseline = await createScheduleVersion({ projectId: testProjectId, actorId, horizonStart, reason: "Baseline for solver resilience verification" });
    versionIds.push(baseline.version.id);
    assert.equal(baseline.solver.status, "OPTIMAL", "The baseline solve against the ok stub must succeed.");
    assert.equal(baseline.version.versionNumber, 1);

    const beforeVersionRow = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.id, baseline.version.id) });
    assert.ok(beforeVersionRow);

    // --- Step 2: seed a triggering schedule_events row via the real entry
    // point (processScheduleEvent). affectedTaskIds is deliberately empty:
    // that takes process.ts's own "status_only" branch, so no durable job is
    // ever enqueued for the "schedule.event" queue. Worker dispatch and the
    // schedule.event job handler live in worker.ts, outside this slice's
    // scope — if a real worker happened to be running against this same
    // event, it would independently call createScheduleVersion() with the
    // same triggerEventId and race this script's own direct calls below.
    // Keeping this event un-queued makes this script self-contained and
    // correct regardless of what else is running against the queue. ---
    const eventId = randomUUID();
    const shipmentId = randomUUID();
    const scheduleEvent = {
      eventId,
      projectId: testProjectId,
      occurredAt: new Date().toISOString(),
      transitionId: "solver-resilience-1",
      eventType: "SHIPMENT_DELAYED" as const,
      payload: { shipmentId, status: "red" as const, availableAt: new Date(Date.now() + 3_600_000).toISOString(), affectedTaskIds: [] as string[], estimate: true as const }
    };
    const queued = await processScheduleEvent(scheduleEvent, actorId);
    assert.equal(queued.duplicate, false);
    assert.equal(queued.action, "status_only");
    assert.equal(queued.jobId, null, "An event with no affected tasks must never enqueue a durable job.");
    const storedEvent = queued.event!;
    eventDbIds.push(storedEvent.id);

    // --- Step 3: point the stub at a hang, and drive solveSchedule() through
    // createScheduleVersion() with that event as the trigger. It must abort
    // (not hang), retry a bounded number of times with backoff, and then fail
    // into an explicit SOLVE_FAILED outcome. ---
    mode = "timeout"; hits = 0;
    const startedAt = Date.now();
    await assert.rejects(
      createScheduleVersion({ projectId: testProjectId, actorId, horizonStart, reason: "Re-solve after simulated shipment delay", triggerEventId: storedEvent.id }),
      (error: unknown) => error instanceof SolverUnavailableError
    );
    const elapsedMs = Date.now() - startedAt;
    assert.equal(hits, 3, "The solver must be retried exactly SOLVER_MAX_ATTEMPTS times, no more, no less.");
    // Each of the 3 attempts is bounded by a 1s timeout, plus backoff sleeps of
    // ~500ms and ~1000ms between them: roughly 4.5s. A hang would run until the
    // test's own watchdog kills the process (well past this). 15s is generous
    // slack while still proving the timeout is what bounded the call, not luck.
    assert.ok(elapsedMs < 15_000, `Expected the bounded retry loop to finish well under 15s (via AbortSignal.timeout), took ${elapsedMs}ms.`);

    // The prior version must be byte-identical and no new version inserted.
    const versionsAfterFailure = await db.select().from(scheduleVersions).where(eq(scheduleVersions.projectId, testProjectId));
    assert.equal(versionsAfterFailure.length, 1, "No partial/new schedule_version may be persisted when the solve fails.");
    assert.deepEqual(versionsAfterFailure[0], beforeVersionRow, "The prior schedule_version row must be untouched (byte-identical) after a failed solve.");

    const eventAfterFailure = await db.query.scheduleEvents.findFirst({ where: eq(scheduleEvents.id, storedEvent.id) });
    assert.equal(eventAfterFailure?.processingStatus, "SOLVE_FAILED", "The triggering schedule_events row must be marked SOLVE_FAILED for manual retry.");

    const failureAudit = await db.query.auditEvents.findFirst({ where: and(eq(auditEvents.projectId, testProjectId), eq(auditEvents.action, "schedule.solve_failed")) });
    assert.ok(failureAudit, "A SOLVE_FAILED transition must write an audit event so it is reconstructible from the audit chain alone.");

    // --- Step 4: resubmitting the same event must retry, not silently
    // no-op as a duplicate — that's the entire point of SOLVE_FAILED. ---
    const resubmitted = await processScheduleEvent(scheduleEvent, actorId);
    assert.equal(resubmitted.duplicate, false, "A SOLVE_FAILED event must be requeue-able on resubmission, not treated as an inert duplicate.");
    const eventAfterRequeue = await db.query.scheduleEvents.findFirst({ where: eq(scheduleEvents.id, storedEvent.id) });
    assert.notEqual(eventAfterRequeue?.processingStatus, "SOLVE_FAILED", "A resubmitted SOLVE_FAILED event must move on from SOLVE_FAILED, not stay stuck there.");

    // --- Step 5: a recovering stub (fails once, then succeeds) must produce a
    // normal version — proving the retry loop actually retries, not just bounds. ---
    mode = "recovering"; hits = 0; recoveringAttempt = 0;
    const recovered = await createScheduleVersion({ projectId: testProjectId, actorId, horizonStart, reason: "Re-solve after recovering stub", triggerEventId: storedEvent.id });
    versionIds.push(recovered.version.id);
    assert.equal(recovered.solver.status, "OPTIMAL");
    assert.equal(recovered.version.versionNumber, 2);
    assert.equal(recovered.version.parentVersionId, baseline.version.id);
    assert.equal(hits, 2, "The recovering stub must be hit exactly twice: one failure, then one success.");

    const versionsAfterRecovery = await db.select().from(scheduleVersions).where(eq(scheduleVersions.projectId, testProjectId));
    assert.equal(versionsAfterRecovery.length, 2, "A successful retried solve must persist exactly one new version.");

    console.log(`Solver resilience verified: timeout aborted after ${elapsedMs}ms (${hits === 2 ? "recovering hits=2" : ""}), bounded to SOLVER_MAX_ATTEMPTS=3 retries with backoff, prior version left byte-identical, SOLVE_FAILED recorded on the event with an audit trail, resubmission requeued it, and a recovering stub produced a normal version.`);
  } finally {
    // A cleanup failure here must never mask a genuine assertion failure
    // above (JS discards the try block's error if finally itself throws), so
    // cleanup errors are logged, not rethrown.
    try {
      if (versionIds.length) await db.delete(scheduleAssignments).where(inArray(scheduleAssignments.versionId, versionIds));
      if (versionIds.length) await db.delete(scheduleVersions).where(inArray(scheduleVersions.id, versionIds));
      if (eventDbIds.length) await db.delete(scheduleEvents).where(inArray(scheduleEvents.id, eventDbIds));
      await db.delete(durableJobs).where(eq(durableJobs.projectId, testProjectId));
      await db.delete(alerts).where(eq(alerts.projectId, testProjectId));
      await db.delete(auditEvents).where(eq(auditEvents.projectId, testProjectId));
      if (taskIdForStub) await db.delete(riskSignals).where(eq(riskSignals.taskId, taskIdForStub));
      if (taskIdForStub) await db.delete(scheduleTasks).where(eq(scheduleTasks.id, taskIdForStub));
      await db.delete(projectMembers).where(eq(projectMembers.projectId, testProjectId));
      await db.delete(projects).where(eq(projects.id, testProjectId));
    } catch (cleanupError) {
      console.error("Cleanup failed (fixtures for this run may need manual removal):", cleanupError);
    }
    for (const socket of pendingSockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
