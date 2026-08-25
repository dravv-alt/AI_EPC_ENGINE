import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { developmentProjectId } from "../src/lib/demo";

async function resolveRedisUrl() {
  const candidate = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const probe = new Redis(candidate, {
    connectTimeout: 1_500,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });

  try {
    await probe.connect();
    await probe.ping();
    await probe.quit();
    return { url: candidate, memoryServer: null };
  } catch {
    probe.disconnect();
    const memoryServer = await RedisMemoryServer.create();
    return {
      url: `redis://${await memoryServer.getHost()}:${await memoryServer.getPort()}`,
      memoryServer,
    };
  }
}

async function main() {
  const { url: redisUrl, memoryServer } = await resolveRedisUrl();
  process.env.REDIS_URL = redisUrl;
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

  const [project] = await db.select().from(await import("../src/lib/db/schema").then(m => m.projects)).limit(1);
  const testProjectId = project ? project.id : developmentProjectId;

  const event = scheduleEventSchema.parse({ eventId: randomUUID(), projectId: testProjectId, occurredAt: new Date().toISOString(), transitionId: "transition-1", eventType: "SHIPMENT_DELAYED", payload: { shipmentId: randomUUID(), status: "amber", availableAt: new Date(Date.now() + 3_600_000).toISOString(), affectedTaskIds: [], estimate: true } });
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
  const first = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: testProjectId, idempotencyKey, payload: { scheduleEventId: randomUUID() } });
  const second = await enqueueDurableJob({ queue: "core", name: "schedule.event", projectId: testProjectId, idempotencyKey, payload: { scheduleEventId: randomUUID() } });
  assert.equal(first.queuedInRedis, true); assert.equal(second.duplicate, true); assert.equal(first.job.id, second.job.id);
  await db.delete(durableJobs).where((await import("drizzle-orm")).eq(durableJobs.id, first.job.id));

  await closeQueues();
  await getRedis().quit();
  if (memoryServer) await memoryServer.stop();
  console.log("Phase 0 contract verification passed: Redis limit, durable queue idempotency, TOTP encryption, event schema, model provider, and signed local storage.");
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
