import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { evidence, projects, systems } from "../src/lib/db/schema";
import { env } from "../src/lib/env";
import { objectStorage } from "../src/lib/storage/service";

// Slice 15 — rate limits and offline/storage hardening. Three independent
// behaviours, each asserted against the real running stack (Postgres, Redis,
// MinIO). The dev server this drives must be started with a deliberately low
// AI_RATE_LIMIT so the 429 is deterministically reachable, and with
// OBJECT_STORAGE_DRIVER=s3 so the storage round-trip exercises MinIO.

async function json(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function verifyRateLimit(base: string, projectId: string) {
  // RED before enforceAiRateLimit was wired: every request returns 200/4xx from
  // the handler, never 429. GREEN: the (limit+1)th request is rejected by the
  // shared middleware. AI_RATE_LIMIT is read from env so the test can drive it low.
  const limit = env.AI_RATE_LIMIT;
  assert.ok(limit <= 20, `Run this section with a low AI_RATE_LIMIT (got ${limit}); a high limit makes the 429 impractical to reach.`);
  let sawTooMany = false;
  let acceptedBeforeLimit = 0;
  for (let i = 0; i < limit + 1; i += 1) {
    const { status } = await json(base, `/api/projects/${projectId}/knowledge/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: `rate-limit probe ${i} zzz`, documentType: "procedure" })
    });
    if (status === 429) { sawTooMany = true; break; }
    assert.ok(status === 200, `Requests within the budget must be served (request ${i} returned ${status}).`);
    acceptedBeforeLimit += 1;
  }
  assert.ok(sawTooMany, `The knowledge query route must return 429 once the AI rate limit (${limit}) is exhausted.`);
  assert.equal(acceptedBeforeLimit, limit, `Exactly ${limit} requests should pass before the limit trips (saw ${acceptedBeforeLimit}).`);
  console.log(`  rate-limit: ${acceptedBeforeLimit} served then HTTP 429 at request ${limit + 1} (limit=${limit}).`);
}

async function verifyOfflineReconcile(base: string, projectId: string) {
  // RED expectation (had reconciliation been missing): a re-posted queued
  // capture would create a second row. GREEN: the server keys on the
  // client-generated clientCaptureId and replies duplicate:true idempotently.
  const clientCaptureId = randomUUID();
  const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.projectId, projectId)).limit(1);
  assert.ok(system, "A seeded system is required to reconcile a field capture.");
  const capturedAt = new Date().toISOString();
  const form = () => {
    const f = new FormData();
    f.set("clientCaptureId", clientCaptureId);
    f.set("systemId", system.id);
    f.set("evidenceType", "observation");
    f.set("notes", `Offline reconcile probe ${clientCaptureId}`);
    f.set("capturedAt", capturedAt);
    return f;
  };
  const first = await json(base, `/api/projects/${projectId}/field-captures`, { method: "POST", body: form() });
  assert.equal(first.status, 201, `A queued capture must be accepted by the server (got ${first.status}: ${JSON.stringify(first.body)}).`);
  assert.equal(first.body.duplicate, false, "The first sync of a client capture must not be a duplicate.");
  assert.equal(first.body.syncState, "needs_review", "A newly reconciled capture must land in needs_review.");
  const serverId = first.body.evidence.id as string;

  const second = await json(base, `/api/projects/${projectId}/field-captures`, { method: "POST", body: form() });
  assert.equal(second.status, 200, `A duplicate re-post must be idempotent (got ${second.status}).`);
  assert.equal(second.body.duplicate, true, "Re-posting the same clientCaptureId must be reported as a duplicate.");
  assert.equal(second.body.evidence.id, serverId, "The idempotent re-post must return the same server row.");

  const rows = await db.select({ id: evidence.id }).from(evidence).where(and(eq(evidence.projectId, projectId), eq(evidence.clientCaptureId, clientCaptureId)));
  assert.equal(rows.length, 1, `Reconciliation must persist exactly one row per client capture (found ${rows.length}).`);
  console.log(`  offline reconcile: queued->accepted then idempotent re-post (server row ${serverId}).`);
  return serverId;
}

async function verifyS3RoundTrip(projectId: string) {
  // The storage service selects its driver from OBJECT_STORAGE_DRIVER at import.
  // This section must run with OBJECT_STORAGE_DRIVER=s3 so we exercise the real
  // MinIO path: put bytes, read them back, assert identity, then clean up.
  assert.equal(env.OBJECT_STORAGE_DRIVER, "s3", "Run the S3 section with OBJECT_STORAGE_DRIVER=s3 to exercise MinIO.");
  const health = await objectStorage.health();
  assert.equal(health.status, "ok", `MinIO/S3 must be reachable (health: ${JSON.stringify(health)}).`);
  assert.equal(health.driver, "s3", "The active storage driver must be s3 for this round-trip.");
  const [project] = await db.select({ tenantId: projects.tenantId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  const payload = new TextEncoder().encode(`slice-15 s3 round-trip ${randomUUID()} :: bytes must survive a MinIO put/get.`);
  let objectKey: string | undefined;
  try {
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes: payload, mediaType: "text/plain", fileName: "roundtrip.txt" });
    objectKey = stored.objectKey;
    assert.equal(stored.byteSize, payload.byteLength, "The stored byte size must match the input.");
    const readBack = await objectStorage.read(stored.objectKey);
    assert.equal(Buffer.from(readBack).equals(Buffer.from(payload)), true, "The bytes read back from MinIO must be identical to the bytes written.");
    console.log(`  s3 round-trip: put/get identical ${payload.byteLength} bytes via MinIO (${stored.objectKey}).`);
  } finally {
    if (objectKey) await objectStorage.remove(objectKey).catch(() => undefined);
  }
}

async function main() {
  const base = process.env.HARDENING_TEST_URL ?? "http://localhost:3000";
  const [project] = await db.select({ id: projects.id }).from(projects).limit(1);
  assert.ok(project, "A seeded project is required.");
  let createdEvidenceId: string | undefined;
  try {
    console.log("Slice 15 hardening verification:");
    await verifyRateLimit(base, project.id);
    createdEvidenceId = await verifyOfflineReconcile(base, project.id);
    await verifyS3RoundTrip(project.id);
    console.log("Slice 15 hardening verified: AI routes rate-limited (real 429), offline captures reconcile idempotently, S3 driver round-trips against MinIO.");
  } finally {
    if (createdEvidenceId) await db.delete(evidence).where(inArray(evidence.id, [createdEvidenceId]));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
