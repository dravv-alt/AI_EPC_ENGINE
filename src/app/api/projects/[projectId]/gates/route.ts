import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { projectRoles } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { gates, systems } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const createSchema = z.object({
  systemId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  sequenceNumber: z.coerce.number().int().min(0).max(9999),
  approvalRole: z.enum(projectRoles).default("approver")
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select().from(gates).where(eq(gates.projectId, projectId)).orderBy(asc(gates.sequenceNumber));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load gates." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Gate data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const system = await db.query.systems.findFirst({ where: and(eq(systems.id, parsed.data.systemId), eq(systems.projectId, projectId)) });
    if (!system) return NextResponse.json({ error: "The selected system is outside this project." }, { status: 400 });
    const duplicate = await db.query.gates.findFirst({ where: and(eq(gates.projectId, projectId), eq(gates.systemId, system.id), eq(gates.name, parsed.data.name)) });
    if (duplicate) return NextResponse.json({ error: "This gate already exists for the selected system." }, { status: 409 });
    const [gate] = await db.insert(gates).values({ projectId, systemId: system.id, name: parsed.data.name, sequenceNumber: String(parsed.data.sequenceNumber), approvalRole: parsed.data.approvalRole }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "gate.created", entityType: "gate", entityId: gate.id, after: gate });
    return NextResponse.json({ gate }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create gate." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
