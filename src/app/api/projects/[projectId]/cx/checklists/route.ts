import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { generateChecklistDraft } from "@/lib/cx/generation";
import { db } from "@/lib/db/client";
import { assets, cxChecklists, documentVersions, documents, gates, projects, sourceRegions, systems } from "@/lib/db/schema";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ systemId: z.string().uuid(), gateId: z.string().uuid(), assetId: z.string().uuid(), title: z.string().trim().min(3).max(250), standardVersionIds: z.array(z.string().uuid()).min(1).max(20) });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ items: await db.select().from(cxChecklists).where(eq(cxChecklists.projectId, projectId)).orderBy(desc(cxChecklists.createdAt)) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Cx checklists." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Checklist scope and at least one completed standard are required.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const [system, gate, asset, project, standardRows] = await Promise.all([
      db.query.systems.findFirst({ where: and(eq(systems.id, parsed.data.systemId), eq(systems.projectId, projectId)) }),
      db.query.gates.findFirst({ where: and(eq(gates.id, parsed.data.gateId), eq(gates.projectId, projectId)) }),
      db.query.assets.findFirst({ where: and(eq(assets.id, parsed.data.assetId), eq(assets.projectId, projectId)) }),
      db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
      db.select({ version: documentVersions, document: documents }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(and(eq(documents.projectId, projectId), inArray(documents.documentType, ["standard", "procedure"]), inArray(documentVersions.id, parsed.data.standardVersionIds), eq(documentVersions.extractionStatus, "completed")))
    ]);
    if (!system || !gate || !asset || !project) return NextResponse.json({ error: "Checklist scope must belong to this project." }, { status: 422 });
    if (gate.systemId !== system.id || asset.systemId !== system.id) return NextResponse.json({ error: "The selected gate and asset must belong to the selected system." }, { status: 422 });
    if (standardRows.length !== new Set(parsed.data.standardVersionIds).size) return NextResponse.json({ error: "Every selected standard must be project-scoped and fully extracted." }, { status: 409 });
    const regions = await db.select({ id: sourceRegions.id }).from(sourceRegions).where(inArray(sourceRegions.documentVersionId, parsed.data.standardVersionIds));
    if (!regions.length) return NextResponse.json({ error: "Selected standards do not yet contain extracted citation regions." }, { status: 409 });
    const [checklist] = await db.insert(cxChecklists).values({ tenantId: project.tenantId, projectId, systemId: system.id, gateId: gate.id, assetId: asset.id, title: parsed.data.title, standardVersionIds: parsed.data.standardVersionIds, generationStatus: "queued", generationModelVersion: "pending", createdBy: actor.userId }).returning();
    const queued = await enqueueDurableJob({ queue: "core", name: "cx.checklist.generate", tenantId: project.tenantId, projectId, idempotencyKey: `cx-checklist-generate:${checklist.id}`, payload: { checklistId: checklist.id, actorId: actor.userId } });
    await db.update(cxChecklists).set({ generationJobId: queued.job.id, generationStatus: queued.queuedInRedis ? "queued" : "running", updatedAt: new Date() }).where(eq(cxChecklists.id, checklist.id));
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "cx.checklist.generation_requested", entityType: "cx_checklist", entityId: checklist.id, after: { jobId: queued.job.id, standardVersionIds: parsed.data.standardVersionIds, advisory: true } });
    if (queued.queuedInRedis) return NextResponse.json({ checklist: { ...checklist, generationJobId: queued.job.id }, checklistJobId: queued.job.id, status: "queued" }, { status: 202 });
    const result = await generateChecklistDraft(checklist.id, actor.userId);
    return NextResponse.json({ checklist: { ...checklist, generationJobId: queued.job.id, generationStatus: "completed" }, checklistJobId: queued.job.id, result, infrastructure: "inline-degraded" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to request checklist generation." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
