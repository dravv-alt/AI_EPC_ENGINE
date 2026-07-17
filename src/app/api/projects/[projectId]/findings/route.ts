import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { findings, gates, projectMembers, users } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";

const schema = z.object({
  title: z.string().trim().min(3).max(250),
  description: z.string().trim().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  gateId: z.string().uuid().optional(),
  ownerId: z.string().uuid(),
  dueAt: z.string().datetime()
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select({
      id: findings.id,
      gateId: findings.gateId,
      title: findings.title,
      description: findings.description,
      severity: findings.severity,
      status: findings.status,
      ownerId: findings.ownerId,
      ownerName: users.displayName,
      dueAt: findings.dueAt,
      resolutionNote: findings.resolutionNote,
      resolvedAt: findings.resolvedAt,
      version: findings.version,
      createdAt: findings.createdAt,
      updatedAt: findings.updatedAt
    }).from(findings).leftJoin(users, eq(findings.ownerId, users.id)).where(and(eq(findings.projectId, projectId), inArray(findings.status, ["open", "in_progress", "closed"]))).orderBy(desc(findings.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load findings." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Finding data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "finding:manage");
    const owner = await db.query.projectMembers.findFirst({ where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parsed.data.ownerId)) });
    if (!owner) return NextResponse.json({ error: "The owner must be a member of this project." }, { status: 400 });
    if (parsed.data.gateId) {
      const gate = await db.query.gates.findFirst({ where: and(eq(gates.id, parsed.data.gateId), eq(gates.projectId, projectId)) });
      if (!gate) return NextResponse.json({ error: "The selected gate is outside this project." }, { status: 400 });
    }
    const [finding] = await db.insert(findings).values({
      projectId,
      gateId: parsed.data.gateId ?? null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      severity: parsed.data.severity,
      ownerId: parsed.data.ownerId,
      dueAt: new Date(parsed.data.dueAt)
    }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "finding.created", entityType: "finding", entityId: finding.id, after: finding });
    await persistProjectGateReadiness(projectId);
    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create finding." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
