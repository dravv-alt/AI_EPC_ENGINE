import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, evidence, sourceRegions, systems } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ systemId: z.string().uuid(), assetId: z.string().uuid().optional(), sourceRegionId: z.string().uuid().optional(), evidenceType: z.string().trim().min(2).max(40), capturedAt: z.string().datetime(), contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ items: await db.select().from(evidence).where(eq(evidence.projectId, projectId)) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load evidence." }, { status: error instanceof AccessError ? error.status : 500 }); } }

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Evidence data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const system = await db.query.systems.findFirst({ where: eq(systems.id, parsed.data.systemId) }); if (!system || system.projectId !== projectId) return NextResponse.json({ error: "System is outside the project scope." }, { status: 400 });
    if (parsed.data.assetId) { const asset = await db.query.assets.findFirst({ where: eq(assets.id, parsed.data.assetId) }); if (!asset || asset.projectId !== projectId || asset.systemId !== system.id) return NextResponse.json({ error: "Asset is outside the system scope." }, { status: 400 }); }
    if (parsed.data.sourceRegionId) { const [region] = await db.select({ id: sourceRegions.id }).from(sourceRegions).where(eq(sourceRegions.id, parsed.data.sourceRegionId)); if (!region) return NextResponse.json({ error: "Source region does not exist." }, { status: 400 }); }
    const [record] = await db.insert(evidence).values({ projectId, systemId: system.id, assetId: parsed.data.assetId ?? null, sourceRegionId: parsed.data.sourceRegionId ?? null, evidenceType: parsed.data.evidenceType, validityState: "pending", contentHash: parsed.data.contentHash ?? null, capturedAt: new Date(parsed.data.capturedAt) }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "evidence.captured", entityType: "evidence", entityId: record.id, after: { validityState: "pending", evidenceType: record.evidenceType, contentHash: record.contentHash } });
    return NextResponse.json({ evidence: record, authority: "pending_review" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to capture evidence." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
