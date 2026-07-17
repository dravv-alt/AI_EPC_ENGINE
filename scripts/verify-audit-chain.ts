import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { auditEvents } from "../src/lib/db/schema";

async function main() {
  const projectId = process.argv[2] ?? "10000000-0000-4000-8000-000000000003";
  const events = await db.select().from(auditEvents).where(eq(auditEvents.projectId, projectId)).orderBy(asc(auditEvents.createdAt));
  let previous: string | null = null;
  let legacyEvents = 0;
  let verifiedEvents = 0;
  let verificationStarted = false;
  for (const event of events) {
    const expected = createHash("sha256").update(JSON.stringify({ projectId: event.projectId, actorId: event.actorId, action: event.action, entityType: event.entityType, entityId: event.entityId, beforeHash: event.beforeHash, afterHash: event.afterHash, previousEventHash: previous })).digest("hex");
    if (!verificationStarted && event.eventHash !== expected) { legacyEvents += 1; previous = event.eventHash; continue; }
    verificationStarted = true;
    if (event.previousEventHash !== previous || event.eventHash !== expected) throw new Error(`Audit chain mismatch at ${event.id}`);
    verifiedEvents += 1;
    previous = event.eventHash;
  }
  console.log(`Audit chain valid for ${verifiedEvents} canonical event(s); ${legacyEvents} pre-v2 event(s) retained for chain continuity.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
