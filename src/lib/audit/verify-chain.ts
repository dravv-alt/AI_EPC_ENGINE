import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

function expectedHash(event: typeof auditEvents.$inferSelect) {
  return createHash("sha256").update(JSON.stringify({
    projectId: event.projectId,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    beforeHash: event.beforeHash,
    afterHash: event.afterHash,
    previousEventHash: event.previousEventHash
  })).digest("hex");
}

export async function verifyAuditChain(projectId: string) {
  const events = await db.select().from(auditEvents).where(eq(auditEvents.projectId, projectId));
  if (!events.length) return { valid: true, eventCount: 0, verifiedEvents: 0, legacyEvents: 0, headHash: null, errors: [] as string[] };

  const errors: string[] = [];
  const byHash = new Map(events.map((event) => [event.eventHash, event]));
  const referenced = new Map<string, number>();
  for (const event of events) {
    if (event.previousEventHash) {
      referenced.set(event.previousEventHash, (referenced.get(event.previousEventHash) ?? 0) + 1);
      if (!byHash.has(event.previousEventHash)) errors.push(`Event ${event.id} points to a missing predecessor.`);
    }
  }
  for (const [hash, count] of referenced) if (count > 1) errors.push(`Audit chain forks after ${hash.slice(0, 12)}.`);
  const heads = events.filter((event) => !referenced.has(event.eventHash));
  if (heads.length !== 1) errors.push(`Expected one audit head, found ${heads.length}.`);

  const visited = new Set<string>();
  let cursor: typeof events[number] | undefined = heads[0];
  while (cursor && !visited.has(cursor.eventHash)) {
    visited.add(cursor.eventHash);
    cursor = cursor.previousEventHash ? byHash.get(cursor.previousEventHash) : undefined;
  }
  if (cursor) errors.push(`Audit chain contains a cycle at ${cursor.eventHash.slice(0, 12)}.`);
  if (visited.size !== events.length) errors.push(`${events.length - visited.size} audit event(s) are disconnected from the chain head.`);

  let verifiedEvents = 0;
  let legacyEvents = 0;
  for (const event of events) {
    if (event.eventHash === expectedHash(event)) verifiedEvents += 1;
    else legacyEvents += 1;
  }
  return { valid: errors.length === 0, eventCount: events.length, verifiedEvents, legacyEvents, headHash: heads.length === 1 ? heads[0].eventHash : null, errors };
}
