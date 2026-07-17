import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { findings, projectMembers } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";

const schema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "closed"]).optional(),
  ownerId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
  resolutionNote: z.string().trim().max(5000).optional()
}).superRefine((value, context) => {
  if (value.status === "closed" && (!value.resolutionNote || value.resolutionNote.length < 5)) {
    context.addIssue({ code: "custom", message: "Closing a finding requires a resolution note.", path: ["resolutionNote"] });
  }
});

export async function PATCH(request: Request, { params }: { params: Promise<{ findingId: string }> }) {
  const { findingId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Finding update is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  const existing = await db.query.findings.findFirst({ where: eq(findings.id, findingId) });
  if (!existing) return NextResponse.json({ error: "Finding not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(existing.projectId, "finding:manage");
    if (parsed.data.ownerId) {
      const owner = await db.query.projectMembers.findFirst({ where: and(eq(projectMembers.projectId, existing.projectId), eq(projectMembers.userId, parsed.data.ownerId)) });
      if (!owner) return NextResponse.json({ error: "The owner must be a member of this project." }, { status: 400 });
    }
    const closing = parsed.data.status === "closed";
    const reopening = parsed.data.status && parsed.data.status !== "closed";
    const [updated] = await db.update(findings).set({
      status: parsed.data.status ?? existing.status,
      ownerId: parsed.data.ownerId ?? existing.ownerId,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : existing.dueAt,
      resolutionNote: closing ? parsed.data.resolutionNote : reopening ? null : existing.resolutionNote,
      resolvedBy: closing ? actor.userId : reopening ? null : existing.resolvedBy,
      resolvedAt: closing ? new Date() : reopening ? null : existing.resolvedAt,
      version: sql`${findings.version} + 1`,
      updatedAt: new Date()
    }).where(and(eq(findings.id, findingId), eq(findings.version, parsed.data.expectedVersion))).returning();
    if (!updated) return NextResponse.json({ error: "This finding changed after you opened it. Reload before saving." }, { status: 409 });
    await writeAuditEvent({ projectId: existing.projectId, actorId: actor.userId, action: `finding.${closing ? "closed" : reopening ? "reopened" : "updated"}`, entityType: "finding", entityId: findingId, before: existing, after: updated });
    const readiness = await persistProjectGateReadiness(existing.projectId);
    return NextResponse.json({ finding: updated, readiness });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update finding." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
