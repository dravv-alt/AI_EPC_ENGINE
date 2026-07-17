import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  timezone: z.string().trim().min(3).max(64),
  retentionDays: z.coerce.number().int().min(30).max(3650)
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.status, "active")) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ project, role: actor.role });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load project." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Project settings are invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "project:manage");
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!existing) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const [project] = await db.update(projects).set({ ...parsed.data, updatedAt: new Date() }).where(eq(projects.id, projectId)).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "project.settings_updated", entityType: "project", entityId: projectId, before: existing, after: project });
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update project." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
