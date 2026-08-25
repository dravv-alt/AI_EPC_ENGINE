import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, asc, eq, sql } from "drizzle-orm";
import { verifyAuditChain } from "../src/lib/audit/verify-chain";
import { db } from "../src/lib/db/client";
import { auditEvents, projects } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";

function canonicalHash(event: typeof auditEvents.$inferSelect) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        projectId: event.projectId,
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        beforeHash: event.beforeHash,
        afterHash: event.afterHash,
        previousEventHash: event.previousEventHash,
      }),
    )
    .digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Audit-chain repair is forbidden in production.");
  }
  if (!process.argv.includes("--confirm-development-repair")) {
    throw new Error(
      "Refusing to modify audit history without --confirm-development-repair.",
    );
  }

  const projectId = process.argv.find((argument) =>
    argument.startsWith("--project="),
  )?.slice("--project=".length) ?? developmentProjectId;
  if (projectId !== developmentProjectId) {
    throw new Error("This guarded utility may repair only the development project.");
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("Development project not found.");

  const before = await verifyAuditChain(projectId);
  if (before.valid) {
    console.log("Audit chain is already valid; no rows were changed.");
    return;
  }

  const original = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.projectId, projectId))
    .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

  const outputDir = resolve("output/evaluation");
  await mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = resolve(
    outputDir,
    `audit-chain-backup-${projectId}-${timestamp}.json`,
  );
  const backup = {
    schemaVersion: "1.0",
    purpose: "development-only audit-chain recovery backup",
    exportedAt: new Date().toISOString(),
    project: { id: project.id, code: project.code, name: project.name },
    verificationBefore: before,
    eventCount: original.length,
    events: original,
  };
  const backupJson = `${JSON.stringify(backup, null, 2)}\n`;
  await writeFile(backupPath, backupJson, { encoding: "utf8", flag: "wx" });
  const backupSha256 = createHash("sha256").update(backupJson).digest("hex");

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${projectId}))`,
    );

    let previousEventHash: string | null = null;
    for (const event of original) {
      const nextEvent = { ...event, previousEventHash };
      const eventHash = canonicalHash(nextEvent);
      await tx
        .update(auditEvents)
        .set({ previousEventHash, eventHash })
        .where(
          and(
            eq(auditEvents.id, event.id),
            eq(auditEvents.projectId, projectId),
          ),
        );
      previousEventHash = eventHash;
    }
  });

  const after = await verifyAuditChain(projectId);
  if (!after.valid) {
    throw new Error(
      `Repaired chain did not verify: ${after.errors.join(" ")} Backup: ${backupPath}`,
    );
  }

  console.log(
    `Development audit chain repaired without deleting events: ${after.eventCount} events; backup ${backupPath}; sha256 ${backupSha256}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
