import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { projectRoles } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { projectMembers, users } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), displayName: z.string().trim().min(2).max(200), role: z.enum(projectRoles) });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select({ id: projectMembers.id, userId: users.id, email: users.email, displayName: users.displayName, role: projectMembers.role, createdAt: projectMembers.createdAt }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId));
    return NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load members." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Member data is invalid." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "project:manage");
    let user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
    if (!user) [user] = await db.insert(users).values({ email: parsed.data.email, displayName: parsed.data.displayName }).returning();
    const existing = await db.query.projectMembers.findFirst({ where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)) });
    if (existing) return NextResponse.json({ error: "This user is already a project member." }, { status: 409 });
    const [member] = await db.insert(projectMembers).values({ projectId, userId: user.id, role: parsed.data.role }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "project.member_added", entityType: "project_member", entityId: member.id, after: { userId: user.id, role: member.role } });
    return NextResponse.json({ member: { ...member, email: user.email, displayName: user.displayName } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add member." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
