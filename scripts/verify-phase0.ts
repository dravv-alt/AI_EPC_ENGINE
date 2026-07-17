import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { RedisMemoryServer } from "redis-memory-server";

async function main() {
  const redisServer = await RedisMemoryServer.create();
  process.env.REDIS_URL = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;
  process.env.AUTH_ENCRYPTION_KEY = "phase0-verification-key-is-at-least-32-characters";
  process.env.LOCAL_UPLOAD_DIR = `/tmp/pramana-phase0-${randomUUID()}`;
  process.env.OBJECT_STORAGE_DRIVER = "local";
  process.env.MODEL_PROVIDER = "mock";

  const [{ redisHealth, getRedis }, { checkRateLimit }, { scheduleEventSchema, eventDedupKey }, { createTotp, verifyTotp }, { encryptSecret, decryptSecret }, { getModelProvider }, { localStorage }, { enqueueDurableJob, closeQueues }, { db }, { durableJobs }] = await Promise.all([
    import("../src/lib/redis/client"), import("../src/lib/redis/rate-limit"), import("../src/lib/events/contract"), import("../src/lib/auth/totp"), import("../src/lib/auth/crypto"), import("../src/lib/model/provider"), import("../src/lib/storage/service"), import("../src/lib/jobs/queue"), import("../src/lib/db/client"), import("../src/lib/db/schema")
  ]);

  assert.equal((await redisHealth()).status, "ok");
  assert.equal((await checkRateLimit("phase0", 2)).allowed, true);
  assert.equal((await checkRateLimit("phase0", 2)).backend, "redis");
  assert.equal((await checkRateLimit("phase0", 2)).allowed, false);

  const totp = createTotp("verify@pramana.local");
  assert.equal(verifyTotp("verify@pramana.local", totp.secret.base32, totp.generate()), true);
  const ciphertext = encryptSecret(totp.secret.base32);
  assert.notEqual(ciphertext, totp.secret.base32);
  assert.equal(decryptSecret(ciphertext), totp.secret.base32);

  const event = scheduleEventSchema.parse({ eventId: randomUUID(), projectId: "10000000-0000-4000-8000-000000000003", occurredAt: new Date().toISOString(), transitionId: "transition-1", eventType: "SHIPMENT_DELAYED", payload: { shipmentId: randomUUID(), status: "amber", availableAt: new Date(Date.now() + 3_600_000).toISOString(), affectedTaskIds: [], estimate: true } });
  assert.match(eventDedupKey(event), /^SHIPMENT_DELAYED:/);
  assert.equal(scheduleEventSchema.safeParse({ ...event, payload: { ...event.payload, estimate: false } }).success, false);

  const modelResult = await getModelProvider().generateStructured({ system: "Return the supplied value.", prompt: "foundation", schema: (await import("zod")).z.object({ value: (await import("zod")).z.string() }), mock: { value: "deterministic" } });
  assert.deepEqual(modelResult.data, { value: "deterministic" });
  assert.equal(modelResult.provider, "mock");

  const object = await localStorage.put({ tenantId: randomUUID(), projectId: randomUUID(), bytes: Buffer.from("controlled artifact"), mediaType: "text/plain", fileName: "artifact.txt" });
  assert.equal((await localStorage.read(object.objectKey)).toString(), "controlled artifact");
  const url = new URL(await localStorage.signedReadUrl(object.objectKey, 60));
  assert.equal(localStorage.verify(object.objectKey, Number(url.searchParams.get("expires")), url.searchParams.get("token") ?? ""), true);
  await localStorage.remove(object.objectKey);

  const idempotencyKey = `phase0:${randomUUID()}`;
  const first = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: "10000000-0000-4000-8000-000000000003", idempotencyKey, payload: { scheduleEventId: randomUUID() } });
  const second = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: "10000000-0000-4000-8000-000000000003", idempotencyKey, payload: { scheduleEventId: randomUUID() } });
  assert.equal(first.queuedInRedis, true); assert.equal(second.duplicate, true); assert.equal(first.job.id, second.job.id);
  await db.delete(durableJobs).where((await import("drizzle-orm")).eq(durableJobs.id, first.job.id));

  await closeQueues(); await getRedis().quit(); await redisServer.stop();
  console.log("Phase 0 contract verification passed: Redis limit, durable queue idempotency, TOTP encryption, event schema, model provider, and signed local storage.");
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
