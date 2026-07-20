import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { edges, requirements } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";
import { captureTeachbackNote } from "@/lib/teachback/capture";
import { surfaceTeachbackAdvisory } from "@/lib/teachback/surface";

// Slice 8: advisory-only teach-back context for a similar past requirement
// correction. Never mutates the requirement — read-only lookup a review UI
// can call before rendering the review form.
export async function GET(request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  const requirement = await db.query.requirements.findFirst({ where: eq(requirements.id, requirementId) });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  try {
    await requireProjectPermission(requirement.projectId, "requirement:review");
    const advisory = await surfaceTeachbackAdvisory({ projectId: requirement.projectId, subjectType: "requirement", queryText: requirement.statement });
    return NextResponse.json({ advisory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load advisory context" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

const supportedUnits = new Set(["A", "V", "kV", "W", "kW", "MW", "Hz", "bar", "kPa", "Pa", "psi", "°C", "C", "%", "l/s", "L/s", "m3/h", "m³/h", "rpm", "mm", "cm", "m", "ms", "s", "min", "h", "day", "days"]);
const reviewSchema = z.object({
  action: z.enum(["accept", "reject", "edit", "duplicate"]),
  statement: z.string().trim().min(8).max(10000).optional(),
  numericValue: z.coerce.number().finite().optional(),
  unit: z.string().trim().max(40).optional(),
  tolerance: z.coerce.number().finite().nonnegative().optional(),
  duplicateOfRequirementId: z.string().uuid().optional(),
  note: z.string().trim().max(2000).optional()
}).superRefine((value, context) => {
  if (value.action === "edit" && !value.statement) context.addIssue({ code: "custom", message: "An edited requirement needs a statement.", path: ["statement"] });
  if (value.action === "duplicate" && !value.duplicateOfRequirementId) context.addIssue({ code: "custom", message: "Select the authoritative duplicate target.", path: ["duplicateOfRequirementId"] });
  if (value.numericValue !== undefined && !value.unit) context.addIssue({ code: "custom", message: "Numeric requirements require a normalized unit.", path: ["unit"] });
  if (value.unit && !supportedUnits.has(value.unit)) context.addIssue({ code: "custom", message: "Unit is not in the controlled unit vocabulary.", path: ["unit"] });
});

export async function PATCH(request: Request, { params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review request", details: parsed.error.flatten(), supportedUnits: [...supportedUnits] }, { status: 400 });
  const requirement = await db.query.requirements.findFirst({ where: eq(requirements.id, requirementId) });
  if (!requirement) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  try {
    const actor = await requireProjectPermission(requirement.projectId, "requirement:review");
    if (!['proposed', 'edited'].includes(requirement.reviewState)) return NextResponse.json({ error: "Only proposed or edited requirements can be reviewed." }, { status: 409 });
    let duplicateTarget: typeof requirement | undefined;
    if (parsed.data.action === "duplicate") {
      duplicateTarget = await db.query.requirements.findFirst({ where: and(eq(requirements.id, parsed.data.duplicateOfRequirementId!), eq(requirements.projectId, requirement.projectId), eq(requirements.reviewState, "accepted")) });
      if (!duplicateTarget || duplicateTarget.id === requirement.id) return NextResponse.json({ error: "Duplicate target must be another accepted requirement in this project." }, { status: 409 });
    }
    const reviewState = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "edit" ? "edited" : "rejected";
    const updated = await db.transaction(async (tx) => {
      const [updated] = await tx.update(requirements).set({
        reviewState,
        statement: parsed.data.statement ?? requirement.statement,
        numericValue: parsed.data.numericValue !== undefined ? String(parsed.data.numericValue) : requirement.numericValue,
        unit: parsed.data.unit ?? requirement.unit,
        tolerance: parsed.data.tolerance !== undefined ? String(parsed.data.tolerance) : requirement.tolerance,
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.action === "duplicate" ? `Duplicate of ${duplicateTarget!.id}. ${parsed.data.note ?? ""}`.trim() : parsed.data.note ?? null,
        updatedAt: new Date()
      }).where(eq(requirements.id, requirementId)).returning();
      if (duplicateTarget) await tx.insert(edges).values({ projectId: requirement.projectId, fromType: "requirement", fromId: requirement.id, relationshipType: "DUPLICATE_OF", toType: "requirement", toId: duplicateTarget.id });
      if ((parsed.data.action === "edit" || parsed.data.action === "reject") && parsed.data.note) {
        await captureTeachbackNote(tx, {
          projectId: requirement.projectId,
          subjectType: "requirement",
          subjectId: requirement.id,
          correctedFrom: { statement: requirement.statement, numericValue: requirement.numericValue, unit: requirement.unit, tolerance: requirement.tolerance },
          correctedTo: parsed.data.action === "edit" ? { statement: updated!.statement, numericValue: updated!.numericValue, unit: updated!.unit, tolerance: updated!.tolerance } : null,
          rationale: parsed.data.note,
          sourceRegionId: requirement.sourceRegionId,
          createdBy: actor.userId,
          disposition: parsed.data.action === "edit" ? "edited" : "rejected",
          embedText: requirement.statement
        });
      }
      return updated;
    });
    const readiness = await persistProjectGateReadiness(requirement.projectId);
    await writeAuditEvent({ projectId: requirement.projectId, actorId: actor.userId, action: `requirement.${parsed.data.action}`, entityType: "requirement", entityId: requirementId, before: requirement, after: updated });
    return NextResponse.json({ requirement: updated, readiness, duplicateOfRequirementId: duplicateTarget?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review requirement" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
