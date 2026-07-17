import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditEvents, projects } from "@/lib/db/schema";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function writeAuditEvent(input: {
  projectId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
  if (!project) throw new Error("Cannot write an audit event for a missing project.");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.projectId}))`);
    const [previous] = await tx.select().from(auditEvents).where(eq(auditEvents.projectId, input.projectId)).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(1);
    const beforeHash = input.before === undefined ? null : hash(input.before);
    const afterHash = input.after === undefined ? null : hash(input.after);
    const eventHash = hash({ projectId: input.projectId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, beforeHash, afterHash, previousEventHash: previous?.eventHash ?? null });
    const [event] = await tx.insert(auditEvents).values({ tenantId: project.tenantId, projectId: input.projectId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, beforeHash, afterHash, previousEventHash: previous?.eventHash ?? null, eventHash }).returning();
    return event;
  });
}
