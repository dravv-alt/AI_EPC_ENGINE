import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { systems } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  systemType: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9 _-]+$/)
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select().from(systems).where(eq(systems.projectId, projectId)).orderBy(asc(systems.name));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load systems." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "System data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const duplicate = await db.query.systems.findFirst({ where: and(eq(systems.projectId, projectId), eq(systems.name, parsed.data.name)) });
    if (duplicate) return NextResponse.json({ error: "A system with this name already exists." }, { status: 409 });
    const [system] = await db.insert(systems).values({ projectId, ...parsed.data }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "system.created", entityType: "system", entityId: system.id, after: system });
    return NextResponse.json({ system }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create system." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
