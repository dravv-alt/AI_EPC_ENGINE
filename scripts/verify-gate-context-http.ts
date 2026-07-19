import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { edges, gates, projects, scheduleTasks, systems } from "../src/lib/db/schema";

// Slice 13: on the readiness/gate view a schedule task that has an AFFECTS edge to
// a gate must surface as READ-ONLY context so a reviewer sees schedule impact when
// deciding the gate. We seed a fresh gate, a fresh schedule task, and an AFFECTS
// edge (task AFFECTS gate), then GET the gate readiness endpoint and assert the
// response carries the seeded task in an `affectingTasks` context array with its
// id + name and no mutation affordance. A second freshly-seeded gate with no
// AFFECTS edge must return an empty context array. Expected values come from the
// rows we seed, not from anything the endpoint recomputes. All rows are removed in
// the finally block.

async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.GATE_CONTEXT_TEST_URL ?? "http://localhost:4301";
  const tag = randomUUID().slice(0, 8);
  const gateIds: string[] = [];
  const taskIds: string[] = [];
  const edgeIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
    assert.ok(project, "A seeded project is required.");
    const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.projectId, project.id)).limit(1);
    assert.ok(system, "A seeded system is required to anchor a gate.");

    // Seed two fresh gates: one that a task AFFECTS, one with no AFFECTS edge.
    const seededGates = await db.insert(gates).values([
      { projectId: project.id, systemId: system.id, name: `Affected gate ${tag}`, sequenceNumber: "9001" },
      { projectId: project.id, systemId: system.id, name: `Unaffected gate ${tag}`, sequenceNumber: "9002" }
    ]).returning({ id: gates.id });
    gateIds.push(...seededGates.map((row) => row.id));
    const [affectedGateId, unaffectedGateId] = gateIds;

    // Seed a schedule task and an AFFECTS edge: the task AFFECTS the affected gate.
    const [task] = await db.insert(scheduleTasks).values({
      projectId: project.id, name: `Long-lead switchgear ${tag}`, durationHours: 72
    }).returning({ id: scheduleTasks.id, name: scheduleTasks.name });
    taskIds.push(task.id);
    const seededEdge = await db.insert(edges).values({
      projectId: project.id, fromType: "schedule_task", fromId: task.id,
      relationshipType: "AFFECTS", toType: "gate", toId: affectedGateId
    }).returning({ id: edges.id });
    edgeIds.push(...seededEdge.map((row) => row.id));

    // The affected gate must surface the AFFECTS task as read-only context.
    const affected = await request(base, `/api/projects/${project.id}/gates/${affectedGateId}/readiness`);
    assert.ok(Array.isArray(affected.affectingTasks), "Readiness must expose an affectingTasks context array.");
    const surfaced = affected.affectingTasks.find((entry: { id: string; name: string }) => entry.id === task.id);
    assert.ok(surfaced, "The AFFECTS-edge task must appear in affectingTasks.");
    assert.equal(surfaced.name, task.name, "The affecting task must carry its seeded name for the reviewer.");
    assert.equal(surfaced.relationshipType, "AFFECTS", "The context entry must expose its AFFECTS relationship.");
    // Read-only: the context entry must not carry any mutation affordance.
    for (const key of Object.keys(surfaced)) assert.ok(!/^(href|action|editable|mutate)/i.test(key), `affectingTasks entries must be read-only context (unexpected key ${key}).`);

    // A gate with no AFFECTS edge must return an empty context array.
    const unaffected = await request(base, `/api/projects/${project.id}/gates/${unaffectedGateId}/readiness`);
    assert.ok(Array.isArray(unaffected.affectingTasks), "Readiness must expose an affectingTasks array even when empty.");
    assert.equal(unaffected.affectingTasks.length, 0, "A gate with no AFFECTS edge must return an empty affectingTasks array.");

    console.log(`Slice 13 gate context verified: gate ${affectedGateId.slice(0, 8)} surfaces AFFECTS task ${task.id.slice(0, 8)} as read-only context; unaffected gate returns empty.`);
  } finally {
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
    if (taskIds.length) await db.delete(scheduleTasks).where(inArray(scheduleTasks.id, taskIds));
    if (gateIds.length) await db.delete(gates).where(and(inArray(gates.id, gateIds)));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
