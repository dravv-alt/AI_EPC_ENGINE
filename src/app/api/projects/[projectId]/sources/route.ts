import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { documents, documentVersions, projects, storageObjects } from "@/lib/db/schema";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { extractDocument } from "@/lib/jobs/worker";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { objectStorage } from "@/lib/storage/service";

export const runtime = "nodejs";

const metadataSchema = z.object({ title: z.string().trim().min(3).max(300), revision: z.string().trim().min(1).max(80), documentType: z.string().trim().min(2).max(40).default("procedure") });
const maxPdfBytes = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "source:upload");
    const form = await request.formData();
    const metadata = metadataSchema.safeParse({ title: form.get("title"), revision: form.get("revision"), documentType: form.get("documentType") ?? "procedure" });
    const file = form.get("file");
    if (!metadata.success) return NextResponse.json({ error: "Invalid source metadata", details: metadata.error.flatten() }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
    if (file.size === 0 || file.size > maxPdfBytes) return NextResponse.json({ error: "PDF must be between 1 byte and 20 MB." }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "Only valid PDF uploads are accepted in this foundation release." }, { status: 415 });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes, mediaType: "application/pdf", fileName: file.name || "source.pdf" });
    const existing = await db.query.documentVersions.findFirst({ where: eq(documentVersions.sha256, stored.sha256) });
    if (existing) return NextResponse.json({ error: "This exact source version is already controlled.", documentVersionId: existing.id }, { status: 409 });
    const { document, version } = await db.transaction(async (tx) => {
      const [document] = await tx.insert(documents).values({ projectId, documentType: metadata.data.documentType, title: metadata.data.title }).returning();
      const [version] = await tx.insert(documentVersions).values({ documentId: document.id, revision: metadata.data.revision, sha256: stored.sha256, objectKey: stored.objectKey, mediaType: stored.mediaType, extractionStatus: "processing" }).returning();
      await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId });
      return { document, version };
    });
    const queued = await enqueueDurableJob({ queue: "core", name: "document.extract", tenantId: project.tenantId, projectId, idempotencyKey: `document-extract:${version.id}:${stored.sha256}`, payload: { documentVersionId: version.id, objectKey: stored.objectKey } });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "source.stored", entityType: "document_version", entityId: version.id, after: { sha256: stored.sha256, objectKey: stored.objectKey, jobId: queued.job.id } });
    if (queued.queuedInRedis) return NextResponse.json({ document, version, jobId: queued.job.id, extractionStatus: "processing" }, { status: 202 });
    try {
      const result = await extractDocument({ documentVersionId: version.id, objectKey: stored.objectKey });
      return NextResponse.json({ document, version: { ...version, extractionStatus: "completed" }, jobId: queued.job.id, ...result, infrastructure: "inline-degraded" }, { status: 201 });
    } catch (error) {
      await db.update(documentVersions).set({ extractionStatus: "failed", extractionError: error instanceof Error ? error.message : "Unknown parsing error", updatedAt: new Date() }).where(eq(documentVersions.id, version.id));
      return NextResponse.json({ error: "Source is controlled but extraction failed and can be retried.", documentVersionId: version.id, jobId: queued.job.id }, { status: 502 });
    }
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to ingest source" }, { status });
  }
}
