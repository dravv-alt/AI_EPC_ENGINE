import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { idempotencyRecords } from "@/lib/db/schema";

function requestHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export async function beginIdempotentRequest(scope: string, key: string, request: unknown, ttlHours = 24) {
  const hash = requestHash(request);
  const existing = await db.query.idempotencyRecords.findFirst({ where: and(eq(idempotencyRecords.scope, scope), eq(idempotencyRecords.key, key), gt(idempotencyRecords.expiresAt, new Date())) });
  if (existing) {
    if (existing.requestHash !== hash) throw new Error("An idempotency key cannot be reused with a different request.");
    return { duplicate: true as const, record: existing };
  }
  const [record] = await db.insert(idempotencyRecords).values({ scope, key, requestHash: hash, expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000) }).returning();
  return { duplicate: false as const, record };
}

export async function completeIdempotentRequest(id: string, responseStatus: number, responseBody: Record<string, unknown>) {
  const [record] = await db.update(idempotencyRecords).set({ responseStatus, responseBody, updatedAt: new Date() }).where(eq(idempotencyRecords.id, id)).returning();
  return record;
}
