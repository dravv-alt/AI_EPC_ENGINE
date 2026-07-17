import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, systems } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const createSchema = z.object({
  systemId: z.string().uuid(),
  tag: z.string().trim().min(2).max(120),
  assetType: z.string().trim().min(2).max(100),
  vendor: z.string().trim().max(200).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(asc(assets.tag));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load assets." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Asset data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const system = await db.query.systems.findFirst({ where: and(eq(systems.id, parsed.data.systemId), eq(systems.projectId, projectId)) });
    if (!system) return NextResponse.json({ error: "The selected system is outside this project." }, { status: 400 });
    const duplicate = await db.query.assets.findFirst({ where: and(eq(assets.projectId, projectId), eq(assets.tag, parsed.data.tag)) });
    if (duplicate) return NextResponse.json({ error: "An asset with this tag already exists." }, { status: 409 });
    const [asset] = await db.insert(assets).values({ projectId, systemId: system.id, tag: parsed.data.tag, assetType: parsed.data.assetType, vendor: parsed.data.vendor || null }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "asset.created", entityType: "asset", entityId: asset.id, after: asset });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create asset." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
