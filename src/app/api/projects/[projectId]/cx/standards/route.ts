import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { documents, documentVersions, projects, sourceRegions, storageObjects } from "@/lib/db/schema";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { extractDocument } from "@/lib/jobs/worker";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { objectStorage } from "@/lib/storage/service";

export const runtime = "nodejs";
const metadataSchema = z.object({ title: z.string().trim().min(3).max(300), revision: z.string().trim().min(1).max(80), standardSet: z.string().trim().min(2).max(120), documentType: z.enum(["standard", "procedure"]) });
const maxBytes = 20 * 1024 * 1024;

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const rows = await db.select({ document: documents, version: documentVersions }).from(documents).innerJoin(documentVersions, eq(documentVersions.documentId, documents.id)).where(and(eq(documents.projectId, projectId), inArray(documents.documentType, ["standard", "procedure"]))).orderBy(desc(documentVersions.createdAt));
    const regionCounts = rows.length ? await db.select({ documentVersionId: sourceRegions.documentVersionId, id: sourceRegions.id }).from(sourceRegions).where(inArray(sourceRegions.documentVersionId, rows.map((row) => row.version.id))) : [];
    return NextResponse.json({ items: rows.map((row) => ({ ...row.document, version: row.version, regionCount: regionCounts.filter((region) => region.documentVersionId === row.version.id).length, usableForGeneration: row.version.extractionStatus === "completed" && regionCounts.some((region) => region.documentVersionId === row.version.id) })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Cx standards." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "source:upload");
    const form = await request.formData();
    const metadata = metadataSchema.safeParse({ title: form.get("title"), revision: form.get("revision"), standardSet: form.get("standardSet"), documentType: form.get("documentType") });
    const file = form.get("file");
    if (!metadata.success) return NextResponse.json({ error: "Standard metadata is invalid.", details: metadata.error.flatten() }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "A standards PDF is required." }, { status: 400 });
    if (!file.size || file.size > maxBytes) return NextResponse.json({ error: "Standards PDF must be between 1 byte and 20 MB." }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "Only a valid PDF can enter the controlled Cx standards corpus." }, { status: 415 });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes, mediaType: "application/pdf", fileName: file.name || "standard.pdf" });
    const duplicate = await db.query.documentVersions.findFirst({ where: eq(documentVersions.sha256, stored.sha256) });
    if (duplicate) return NextResponse.json({ error: "This exact controlled content already exists.", documentVersionId: duplicate.id }, { status: 409 });
    const { document, version } = await db.transaction(async (tx) => {
      const [document] = await tx.insert(documents).values({ projectId, documentType: metadata.data.documentType, standardSet: metadata.data.standardSet, title: metadata.data.title }).returning();
      const [version] = await tx.insert(documentVersions).values({ documentId: document.id, revision: metadata.data.revision, sha256: stored.sha256, objectKey: stored.objectKey, mediaType: stored.mediaType, extractionStatus: "processing" }).returning();
      await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId });
      return { document, version };
    });
    const queued = await enqueueDurableJob({ queue: "core", name: "document.extract", tenantId: project.tenantId, projectId, idempotencyKey: `cx-standard-extract:${version.id}:${stored.sha256}`, payload: { documentVersionId: version.id, objectKey: stored.objectKey } });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "cx.standard.stored", entityType: "document_version", entityId: version.id, after: { standardSet: metadata.data.standardSet, documentType: metadata.data.documentType, sha256: stored.sha256, jobId: queued.job.id } });
    if (queued.queuedInRedis) return NextResponse.json({ document, version, ingestJobId: queued.job.id, extractionStatus: "processing" }, { status: 202 });
    try {
      const extracted = await extractDocument({ documentVersionId: version.id, objectKey: stored.objectKey });
      return NextResponse.json({ document, version: { ...version, extractionStatus: "completed" }, ingestJobId: queued.job.id, ...extracted, infrastructure: "inline-degraded" }, { status: 201 });
    } catch (error) {
      await db.update(documentVersions).set({ extractionStatus: "failed", extractionError: error instanceof Error ? error.message : "Extraction failed.", updatedAt: new Date() }).where(eq(documentVersions.id, version.id));
      return NextResponse.json({ error: "The standard is controlled but extraction failed and can be retried.", ingestJobId: queued.job.id, documentVersionId: version.id }, { status: 502 });
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to ingest Cx standard." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
