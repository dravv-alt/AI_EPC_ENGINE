import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, cxChecklistSteps, cxChecklists, cxClauseCitations, documentVersions, documents, gates, sourceRegions, systems, projects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ systemId: z.string().uuid(), gateId: z.string().uuid(), assetId: z.string().uuid(), title: z.string().min(3).max(250) });

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checklist request", details: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const [system, gate, asset, region] = await Promise.all([
      db.query.systems.findFirst({ where: eq(systems.id, parsed.data.systemId) }), db.query.gates.findFirst({ where: eq(gates.id, parsed.data.gateId) }), db.query.assets.findFirst({ where: eq(assets.id, parsed.data.assetId) }), db.select({ region: sourceRegions }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).limit(1).then((rows) => rows[0]?.region)
    ]);
    if (!system || !gate || !asset || system.projectId !== projectId || gate.projectId !== projectId || asset.projectId !== projectId) return NextResponse.json({ error: "Checklist references must belong to this project." }, { status: 422 });
    const project = await db.query.projects.findFirst({ where: (projects, { eq }) => eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const [checklist] = await db.insert(cxChecklists).values({ tenantId: project.tenantId, projectId, systemId: system.id, gateId: gate.id, assetId: asset.id, title: parsed.data.title, createdBy: actor.userId }).returning();
    const [numeric, booleanStep, narrative] = await db.insert(cxChecklistSteps).values([
      { checklistId: checklist.id, sequenceNumber: "1", instruction: "Measure design flow at the tested asset.", modality: "numeric", parameter: "Flow", nominalValue: "100", unit: "L/s", tolerance: "5" },
      { checklistId: checklist.id, sequenceNumber: "2", instruction: "Verify the standby interlock is present.", modality: "boolean", expectedBoolean: true },
      { checklistId: checklist.id, sequenceNumber: "3", instruction: "Record observed workmanship and operational observations.", modality: "narrative", narrativeCriterion: "No abnormal vibration, leakage, or unsafe condition." }
    ]).returning();
    if (region) await db.insert(cxClauseCitations).values({ checklistId: checklist.id, stepId: numeric.id, clauseReference: "Controlled source region", sourceRegionId: region.id, verificationStatus: "verified" });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "cx.checklist.created", entityType: "cx_checklist", entityId: checklist.id, after: { checklistId: checklist.id } });
    return NextResponse.json({ checklist, steps: [numeric, booleanStep, narrative], citationVerified: Boolean(region) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create checklist" }, { status: error instanceof AccessError ? error.status : 500 }); }
}
