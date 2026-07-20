import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { auditEvents, edges, projects } from "../src/lib/db/schema";
import { getProjectGraph } from "../src/lib/graph/entities";
import { developmentProjectId } from "../src/lib/demo";

// Slice 9: clicking a node on /graph must call a node-expansion endpoint that
// returns its linked entities so the evidence graph can be traversed. We seed a
// couple of `edges` rows connecting one existing seeded node (the centre) to two
// other existing seeded nodes, plus an audit event whose entityId is the centre
// node, then GET the expansion endpoint and assert it returns exactly those
// neighbours (with their type + label) and that audit entry. Expected values come
// from the rows we seeded, not from anything the endpoint recomputes.
async function request(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const base = process.env.GRAPH_TEST_URL ?? "http://localhost:4291";
  const edgeIds: string[] = [];
  const auditIds: string[] = [];
  try {
    const [project] = await db.select({ id: projects.id, tenantId: projects.tenantId }).from(projects).where(eq(projects.id, developmentProjectId)).limit(1);
    assert.ok(project, "A seeded project is required.");

    // Resolve three distinct existing nodes from the live graph: a centre node
    // and two neighbours to connect it to.
    const { nodes } = await getProjectGraph(project.id);
    assert.ok(nodes.length >= 3, "At least three seeded graph nodes are required.");
    const [centre, neighbourA, neighbourB] = nodes;

    // Seed two typed edges: one where the centre is the `from` side and one where
    // it is the `to` side, so both traversal directions are exercised.
    const seededEdges = await db.insert(edges).values([
      { projectId: project.id, fromType: centre.type, fromId: centre.id, relationshipType: "AFFECTS", toType: neighbourA.type, toId: neighbourA.id },
      { projectId: project.id, fromType: neighbourB.type, fromId: neighbourB.id, relationshipType: "PROVES", toType: centre.type, toId: centre.id }
    ]).returning({ id: edges.id });
    edgeIds.push(...seededEdges.map((row) => row.id));

    // Seed an audit event anchored to the centre node.
    const auditAction = `graph.expansion.verify.${randomUUID().slice(0, 8)}`;
    const seededAudit = await db.insert(auditEvents).values({
      tenantId: project.tenantId, projectId: project.id, action: auditAction,
      entityType: centre.type, entityId: centre.id, eventHash: randomUUID().replace(/-/g, "")
    }).returning({ id: auditEvents.id });
    auditIds.push(...seededAudit.map((row) => row.id));

    // Expand the centre node.
    const result = await request(base, `/api/projects/${project.id}/graph/nodes/${centre.id}`);

    // The endpoint echoes the requested node with its type + label.
    assert.equal(result.node.id, centre.id, "Expansion must return the requested node.");
    assert.equal(result.node.type, centre.type, "The returned node must carry its type.");
    assert.equal(result.node.label, centre.label, "The returned node must carry its label.");

    // Both seeded neighbours must appear, each with its type + label, regardless
    // of traversal direction.
    assert.ok(Array.isArray(result.neighbors), "Expansion must return a neighbors array.");
    const neighbourById = new Map(result.neighbors.map((entry: { node: { id: string; type: string; label: string }; edge: { id: string; relationshipType: string } }) => [entry.node.id, entry]));
    const a = neighbourById.get(neighbourA.id);
    const b = neighbourById.get(neighbourB.id);
    assert.ok(a, "The AFFECTS neighbour must be returned.");
    assert.ok(b, "The PROVES neighbour must be returned.");
    assert.equal(a.node.type, neighbourA.type, "Neighbour A must carry its type.");
    assert.equal(a.node.label, neighbourA.label, "Neighbour A must carry its label.");
    assert.equal(a.edge.relationshipType, "AFFECTS", "Neighbour A must expose the seeded relationship type.");
    assert.equal(a.edge.id, edgeIds[0], "Neighbour A must expose the seeded edge id.");
    assert.equal(b.node.type, neighbourB.type, "Neighbour B must carry its type.");
    assert.equal(b.node.label, neighbourB.label, "Neighbour B must carry its label.");
    assert.equal(b.edge.relationshipType, "PROVES", "Neighbour B must expose the seeded relationship type.");

    // The endpoint must surface separate document / supply / audit buckets.
    assert.ok(Array.isArray(result.documents), "Expansion must return a documents array.");
    assert.ok(Array.isArray(result.supply), "Expansion must return a supply array.");
    assert.ok(Array.isArray(result.audits), "Expansion must return an audits array.");
    assert.ok(result.audits.some((entry: { id: string; action: string }) => entry.id === auditIds[0] && entry.action === auditAction), "The seeded audit entry for the node must be returned.");

    console.log(`Slice 9 graph expansion verified: node ${centre.type}:${centre.id.slice(0, 8)} expanded to ${result.neighbors.length} neighbours and ${result.audits.length} audit entries.`);
  } finally {
    if (auditIds.length) await db.delete(auditEvents).where(inArray(auditEvents.id, auditIds));
    if (edgeIds.length) await db.delete(edges).where(inArray(edges.id, edgeIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
