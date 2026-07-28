import { loadEnvConfig } from "@next/env";
import { basename, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";

loadEnvConfig(process.cwd());

function argument(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

async function main() {
  const filePath = resolve(argument("file"));
  const title = argument("title");
  const revision = argument("revision");
  const projectCode = argument("project", "MDC-07");
  const actorEmail = argument("actor");
  const documentType = argument("type", "standard");

  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile() || fileInfo.size < 5 || fileInfo.size > 20 * 1024 * 1024) {
    throw new Error("Source PDF must be a file between 5 bytes and 20 MB.");
  }
  const bytes = await readFile(filePath);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Source does not have valid PDF magic bytes.");

  const [{ and, eq }, { db }, schema, { can }, { objectStorage }, { extractDocument, embedPendingKnowledgeChunks }, { writeAuditEvent }] = await Promise.all([
    import("drizzle-orm"),
    import("../src/lib/db/client"),
    import("../src/lib/db/schema"),
    import("../src/lib/auth/roles"),
    import("../src/lib/storage/service"),
    import("../src/lib/jobs/worker"),
    import("../src/lib/audit/write-event")
  ]);
  const { documents, documentVersions, projectMembers, projects, sourceRegions, storageObjects, users } = schema;

  const [authority] = await db
    .select({ project: projects, actor: users, membership: projectMembers })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(and(eq(projects.code, projectCode), eq(users.email, actorEmail.toLowerCase())))
    .limit(1);
  if (!authority) throw new Error(`No ${projectCode} membership exists for ${actorEmail}.`);
  if (!can(authority.membership.role, "source:upload")) throw new Error(`${actorEmail} does not have source:upload permission.`);

  const stored = await objectStorage.put({
    tenantId: authority.project.tenantId,
    projectId: authority.project.id,
    bytes,
    mediaType: "application/pdf",
    fileName: basename(filePath)
  });

  let version = await db.query.documentVersions.findFirst({ where: eq(documentVersions.sha256, stored.sha256) });
  let document = version ? await db.query.documents.findFirst({ where: eq(documents.id, version.documentId) }) : null;
  let created = false;
  if (version && document?.projectId !== authority.project.id) throw new Error("This content hash is already controlled by another project.");

  if (!version || !document) {
    ({ document, version } = await db.transaction(async (tx) => {
      const [createdDocument] = await tx.insert(documents).values({
        projectId: authority.project.id,
        documentType,
        title
      }).returning();
      const [createdVersion] = await tx.insert(documentVersions).values({
        documentId: createdDocument.id,
        revision,
        sha256: stored.sha256,
        objectKey: stored.objectKey,
        mediaType: stored.mediaType,
        extractionStatus: "processing"
      }).returning();
      await tx.insert(storageObjects).values({
        tenantId: authority.project.tenantId,
        projectId: authority.project.id,
        objectKey: stored.objectKey,
        mediaType: stored.mediaType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        createdBy: authority.actor.id
      }).onConflictDoNothing();
      return { document: createdDocument, version: createdVersion };
    }));
    created = true;
    await writeAuditEvent({
      projectId: authority.project.id,
      actorId: authority.actor.id,
      action: "source.terminal_imported",
      entityType: "document_version",
      entityId: version.id,
      after: { sha256: stored.sha256, objectKey: stored.objectKey, title, revision }
    });
  }

  const extraction = await extractDocument({ documentVersionId: version.id, objectKey: version.objectKey });
  const regions = await db.select({ id: sourceRegions.id }).from(sourceRegions).where(eq(sourceRegions.documentVersionId, version.id));
  const embedding = await embedPendingKnowledgeChunks({
    projectId: authority.project.id,
    sourceRegionIds: regions.map((region) => region.id)
  });

  console.log(JSON.stringify({
    created,
    projectCode,
    documentId: document.id,
    documentVersionId: version.id,
    title: document.title,
    revision: version.revision,
    sha256: version.sha256,
    regionCount: extraction.regionCount,
    embeddedChunks: embedding.embedded,
    embeddingModel: embedding.modelTag,
    extractionStatus: "completed"
  }, null, 2));
  const [{ closeQueues }, { getRedis }] = await Promise.all([
    import("../src/lib/jobs/queue"),
    import("../src/lib/redis/client")
  ]);
  await closeQueues();
  getRedis().disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
