import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { projectRoles } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ role: z.enum(projectRoles) });

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; memberId: string }> }) {
  const { projectId, memberId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Role is invalid." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "project:manage");
    const existing = await db.query.projectMembers.findFirst({ where: and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)) });
    if (!existing) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const [member] = await db.update(projectMembers).set({ role: parsed.data.role, updatedAt: new Date() }).where(eq(projectMembers.id, memberId)).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "project.member_role_changed", entityType: "project_member", entityId: member.id, before: { role: existing.role }, after: { role: member.role } });
    return NextResponse.json({ member });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to change role." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
