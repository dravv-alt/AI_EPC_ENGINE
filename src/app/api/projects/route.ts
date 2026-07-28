import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { db } from "@/lib/db/client";
import { projectMembers, projects } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

const schema = z.object({ name: z.string().trim().min(2).max(200), code: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/), timezone: z.string().trim().min(3).max(64) });

export async function GET() {
  try { const { identity, user } = await getPersistedCurrentUser(); const rows = await db.select({ id: projects.id, name: projects.name, code: projects.code, status: projects.status, timezone: projects.timezone, role: projectMembers.role }).from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id)); return NextResponse.json({ projects: rows, activeProjectId: await getActiveProjectId(), identity, dataSource: "postgres" }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load projects." }, { status: 401 }); }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Project data is invalid." }, { status: 400 });
  try {
    const { user } = await getPersistedCurrentUser();
    const memberships = await db.select({ role: projectMembers.role, tenantId: projects.tenantId }).from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id));
    const admin = memberships.find((item) => item.role === "admin"); if (!admin) return NextResponse.json({ error: "An administrator membership is required to create a project." }, { status: 403 });
    const result = await db.transaction(async (tx) => { const [project] = await tx.insert(projects).values({ tenantId: admin.tenantId, ...parsed.data }).returning(); await tx.insert(projectMembers).values({ projectId: project.id, userId: user.id, role: "admin" }); return project; });
    await writeAuditEvent({ projectId: result.id, actorId: user.id, action: "project.created", entityType: "project", entityId: result.id, after: { name: result.name, code: result.code, timezone: result.timezone } });
    return NextResponse.json({ project: result }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create project." }, { status: 409 }); }
}
