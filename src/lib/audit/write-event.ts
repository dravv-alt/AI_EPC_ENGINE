import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
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
  return db.transaction((tx) => writeAuditEventInTransaction(tx, input));
}

type AuditInput = Parameters<typeof writeAuditEvent>[0];
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Authority-bearing workflows can use this helper inside their own mutation
// transaction. That makes the business row and its hash-chain event atomic:
// either both commit or neither does.
export async function writeAuditEventInTransaction(
  tx: DbTx,
  input: AuditInput,
) {
  const project = await tx.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project)
    throw new Error("Cannot write an audit event for a missing project.");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${input.projectId}))`,
  );
  // PostgreSQL's now()/defaultNow() is the transaction start time. Concurrent
  // transactions can therefore acquire this lock in one order while their
  // created_at values sort in another order. The canonical predecessor is the
  // sole unreferenced chain head, never the most recent timestamp.
  const headRows = (await tx.execute(sql`
    select parent.event_hash as "eventHash"
    from audit_events parent
    where parent.project_id = ${input.projectId}
      and not exists (
        select 1
        from audit_events child
        where child.project_id = parent.project_id
          and child.previous_event_hash = parent.event_hash
      )
    order by parent.created_at desc, parent.id desc
    limit 2
  `)) as unknown as Array<{ eventHash: string }>;
  if (headRows.length > 1) {
    throw new Error(
      "Cannot append to a forked audit chain; verify and repair the chain first.",
    );
  }
  const previousEventHash = headRows[0]?.eventHash ?? null;
  const beforeHash = input.before === undefined ? null : hash(input.before);
  const afterHash = input.after === undefined ? null : hash(input.after);
  const eventHash = hash({
    projectId: input.projectId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeHash,
    afterHash,
    previousEventHash,
  });
  const [event] = await tx
    .insert(auditEvents)
    .values({
      tenantId: project.tenantId,
      projectId: input.projectId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeHash,
      afterHash,
      previousEventHash,
      eventHash,
    })
    .returning();
  return event;
}
