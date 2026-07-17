import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, evidence, projects, storageObjects, systems } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { detectAllowedCaptureMediaType } from "@/lib/storage/magic";
import { objectStorage } from "@/lib/storage/service";

export const runtime = "nodejs";
const maxArtifactBytes = 20 * 1024 * 1024;
const schema = z.object({
  clientCaptureId: z.string().uuid(),
  systemId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  evidenceType: z.enum(["photo", "measurement", "observation", "test_reading", "inspection", "document"]),
  notes: z.string().trim().min(2).max(5000),
  capturedAt: z.string().datetime()
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select().from(evidence).where(eq(evidence.projectId, projectId)).orderBy(desc(evidence.capturedAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load field captures." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const form = await request.formData();
    const parsed = schema.safeParse({
      clientCaptureId: form.get("clientCaptureId"), systemId: form.get("systemId"), assetId: form.get("assetId") || undefined,
      evidenceType: form.get("evidenceType"), notes: form.get("notes"), capturedAt: form.get("capturedAt")
    });
    if (!parsed.success) return NextResponse.json({ error: "Field capture data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
    const existing = await db.query.evidence.findFirst({ where: and(eq(evidence.projectId, projectId), eq(evidence.clientCaptureId, parsed.data.clientCaptureId)) });
    if (existing) return NextResponse.json({ evidence: existing, duplicate: true, syncState: existing.validityState === "pending" ? "needs_review" : existing.validityState });

    const [project, system] = await Promise.all([
      db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
      db.query.systems.findFirst({ where: and(eq(systems.id, parsed.data.systemId), eq(systems.projectId, projectId)) })
    ]);
    if (!project || !system) return NextResponse.json({ error: "The selected project or system does not exist." }, { status: 400 });
    if (parsed.data.assetId) {
      const asset = await db.query.assets.findFirst({ where: and(eq(assets.id, parsed.data.assetId), eq(assets.projectId, projectId), eq(assets.systemId, system.id)) });
      if (!asset) return NextResponse.json({ error: "The selected asset is outside this system." }, { status: 400 });
    }

    const artifact = form.get("artifact");
    let stored: Awaited<ReturnType<typeof objectStorage.put>> | null = null;
    if (artifact instanceof File && artifact.size > 0) {
      if (artifact.size > maxArtifactBytes) return NextResponse.json({ error: "Field artifacts must be 20 MB or smaller." }, { status: 413 });
      const bytes = new Uint8Array(await artifact.arrayBuffer());
      const mediaType = detectAllowedCaptureMediaType(bytes, artifact.type);
      if (!mediaType) return NextResponse.json({ error: "Only validated JPEG, PNG, PDF, CSV, and text artifacts are accepted." }, { status: 415 });
      stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes, mediaType, fileName: artifact.name || "field-artifact" });
    }
    const contentHash = stored?.sha256 ?? createHash("sha256").update(JSON.stringify({ evidenceType: parsed.data.evidenceType, notes: parsed.data.notes, capturedAt: parsed.data.capturedAt, systemId: parsed.data.systemId, assetId: parsed.data.assetId ?? null })).digest("hex");
    const record = await db.transaction(async (tx) => {
      let objectId: string | null = null;
      if (stored) {
        const [object] = await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId }).returning();
        objectId = object.id;
      }
      const [record] = await tx.insert(evidence).values({ projectId, systemId: system.id, assetId: parsed.data.assetId ?? null, storageObjectId: objectId, evidenceType: parsed.data.evidenceType, validityState: "pending", contentHash, clientCaptureId: parsed.data.clientCaptureId, notes: parsed.data.notes, capturedBy: actor.userId, capturedAt: new Date(parsed.data.capturedAt) }).returning();
      return record;
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "field_capture.synced", entityType: "evidence", entityId: record.id, after: { clientCaptureId: record.clientCaptureId, contentHash, storageObjectId: record.storageObjectId, authority: "pending_review" } });
    return NextResponse.json({ evidence: record, duplicate: false, syncState: "needs_review", authority: "pending_review" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to synchronize field capture." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
