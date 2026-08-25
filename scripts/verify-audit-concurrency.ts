import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { verifyAuditChain } from "../src/lib/audit/verify-chain";
import { writeAuditEvent } from "../src/lib/audit/write-event";
import { db } from "../src/lib/db/client";
import { auditEvents, projectMembers, projects } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

async function main() {
  const sourceProject = await db.query.projects.findFirst({
    where: eq(projects.id, developmentProjectId),
  });
  const actor = await db.query.projectMembers.findFirst({
    where: eq(projectMembers.projectId, developmentProjectId),
  });
  assert.ok(sourceProject, "The development project must exist.");
  assert.ok(actor, "The development project must have an audit actor.");

  const token = randomUUID();
  const [project] = await db
    .insert(projects)
    .values({
      tenantId: sourceProject.tenantId,
      name: `Audit concurrency verification ${token.slice(0, 8)}`,
      code: `AUDIT-${token.slice(0, 8)}`,
      timezone: "UTC",
    })
    .returning();

  try {
    const eventCount = 32;
    await Promise.all(
      Array.from({ length: eventCount }, (_, index) =>
        writeAuditEvent({
          projectId: project.id,
          actorId: actor.userId,
          action: "audit.concurrency_verified",
          entityType: "project",
          entityId: project.id,
          after: { index },
        }),
      ),
    );

    const result = await verifyAuditChain(project.id);
    assert.equal(result.valid, true, result.errors.join(" "));
    assert.equal(result.eventCount, eventCount);
    assert.equal(result.verifiedEvents, eventCount);
    assert.equal(result.legacyEvents, 0);
    console.log(
      `Audit concurrency verification passed: ${eventCount} simultaneous writes produced one canonical chain.`,
    );
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.projectId, project.id));
    await db.delete(projects).where(eq(projects.id, project.id));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
