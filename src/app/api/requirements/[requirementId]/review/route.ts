import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { requirements } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";

const reviewSchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  statement: z.string().trim().min(8).max(10000).optional(),
  note: z.string().trim().max(2000).optional()
}).superRefine((value, context) => {
  if (value.action === "edit" && !value.statement) context.addIssue({ code: "custom", message: "An edited requirement needs a statement.", path: ["statement"] });
});

export async function PATCH(request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review request", details: parsed.error.flatten() }, { status: 400 });

  const requirement = await db.query.requirements.findFirst({ where: eq(requirements.id, requirementId) });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  try {
    const actor = await requireProjectPermission(requirement.projectId, "requirement:review");
    const reviewState = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "reject" ? "rejected" : "edited";
    const [updated] = await db.update(requirements).set({
      reviewState,
      statement: parsed.data.statement ?? requirement.statement,
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
      updatedAt: new Date()
    }).where(eq(requirements.id, requirementId)).returning();
    const readiness = await persistProjectGateReadiness(requirement.projectId);
    await writeAuditEvent({ projectId: requirement.projectId, actorId: actor.userId, action: `requirement.${parsed.data.action}`, entityType: "requirement", entityId: requirementId, before: requirement, after: updated });
    return NextResponse.json({ requirement: updated, readiness });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review requirement" }, { status });
  }
}
