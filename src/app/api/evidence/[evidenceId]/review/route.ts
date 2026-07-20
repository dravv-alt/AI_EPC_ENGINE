import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { edges, evidence, requirements } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { captureTeachbackNote } from "@/lib/teachback/capture";
import { surfaceTeachbackAdvisory } from "@/lib/teachback/surface";

const schema = z.object({ decision: z.enum(["accept", "reject"]), requirementIds: z.array(z.string().uuid()).max(100).default([]), note: z.string().trim().min(3).max(2000) });

// Slice 8: advisory-only teach-back context for a similar past evidence
// rejection. Read-only — never mutates the evidence record.
export async function GET(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const record = await db.query.evidence.findFirst({ where: eq(evidence.id, evidenceId) });
  if (!record) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  try {
    await requireProjectPermission(record.projectId, "requirement:review");
    const advisory = await surfaceTeachbackAdvisory({ projectId: record.projectId, subjectType: "evidence", queryText: record.notes ?? record.evidenceType });
    return NextResponse.json({ advisory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load advisory context" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Review data is invalid." }, { status: 400 });
  const record = await db.query.evidence.findFirst({ where: eq(evidence.id, evidenceId) }); if (!record) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(record.projectId, "requirement:review"); if (record.validityState !== "pending") return NextResponse.json({ error: "Only pending evidence can be reviewed." }, { status: 409 });
    if (parsed.data.decision === "accept" && !record.contentHash) return NextResponse.json({ error: "Accepted evidence requires an immutable content hash." }, { status: 409 });
    const linked = parsed.data.requirementIds.length ? await db.select().from(requirements).where(and(eq(requirements.projectId, record.projectId), eq(requirements.reviewState, "accepted"), inArray(requirements.id, parsed.data.requirementIds))) : [];
    if (linked.length !== parsed.data.requirementIds.length) return NextResponse.json({ error: "Every linked requirement must be accepted and project-scoped." }, { status: 409 });
    const next = parsed.data.decision === "accept" ? "accepted" : "rejected";
    await db.transaction(async (tx) => {
      await tx.update(evidence).set({ validityState: next, updatedAt: new Date() }).where(eq(evidence.id, evidenceId));
      if (next === "accepted" && linked.length) await tx.insert(edges).values(linked.map((requirement) => ({ projectId: record.projectId, fromType: "evidence", fromId: record.id, relationshipType: "PROVES", toType: "requirement", toId: requirement.id })));
      // Evidence review has no "edit" action, only accept/reject — so the
      // only correction to teach from is a rejection (accepting teaches
      // nothing).
      if (next === "rejected") {
        await captureTeachbackNote(tx, {
          projectId: record.projectId,
          subjectType: "evidence",
          subjectId: record.id,
          correctedFrom: { validityState: record.validityState, evidenceType: record.evidenceType },
          correctedTo: null,
          rationale: parsed.data.note,
          sourceRegionId: record.sourceRegionId,
          createdBy: actor.userId,
          disposition: "rejected",
          embedText: record.notes ?? record.evidenceType
        });
      }
    });
    await writeAuditEvent({ projectId: record.projectId, actorId: actor.userId, action: `evidence.${next}`, entityType: "evidence", entityId: record.id, before: { validityState: record.validityState }, after: { validityState: next, requirementIds: parsed.data.requirementIds, note: parsed.data.note } });
    return NextResponse.json({ evidence: { ...record, validityState: next }, linkedRequirementIds: parsed.data.requirementIds });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review evidence." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
