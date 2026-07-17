import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { complianceChecks, compliancePrecedents, findings } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";

const schema = z.object({ action: z.enum(["accept", "reject"]), note: z.string().trim().min(10).max(5000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ precedentId: string }> }) {
  const { precedentId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Precedent review is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  const existing = await db.query.compliancePrecedents.findFirst({ where: eq(compliancePrecedents.id, precedentId) });
  if (!existing) return NextResponse.json({ error: "Compliance precedent not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(existing.projectId, "requirement:review");
    if (existing.reviewState !== "proposed") return NextResponse.json({ error: "This precedent already received a final disposition." }, { status: 409 });
    const accepted = parsed.data.action === "accept";
    const result = await db.transaction(async (tx) => {
      const [precedent] = await tx.update(compliancePrecedents).set({ reviewState: accepted ? "accepted" : "rejected", reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, updatedAt: new Date() }).where(and(eq(compliancePrecedents.id, precedentId), eq(compliancePrecedents.reviewState, "proposed"))).returning();
      if (!precedent) throw new Error("CONFLICT");
      const check = await tx.query.complianceChecks.findFirst({ where: and(eq(complianceChecks.id, existing.sourceCheckId), eq(complianceChecks.projectId, existing.projectId)) });
      if (!accepted || !check || check.reviewState !== "proposed") return { precedent, check, finding: null };
      let finding = check.proposedFindingId ? await tx.query.findings.findFirst({ where: eq(findings.id, check.proposedFindingId) }) : undefined;
      if (finding) [finding] = await tx.update(findings).set({ status: "dismissed", description: `${finding.description ?? check.reason}\n\nDismissed by accepted equality precedent ${precedent.id}: ${parsed.data.note}`, version: sql`${findings.version} + 1`, updatedAt: new Date() }).where(eq(findings.id, finding.id)).returning();
      const [updatedCheck] = await tx.update(complianceChecks).set({ verdict: "equivalent_by_precedent", precedentId: precedent.id, reviewState: "accepted", reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, findingDisposition: finding ? "dismissed" : "not_applicable", version: sql`${complianceChecks.version} + 1`, updatedAt: new Date() }).where(and(eq(complianceChecks.id, check.id), eq(complianceChecks.reviewState, "proposed"))).returning();
      return { precedent, check: updatedCheck, finding: finding ?? null };
    });
    await writeAuditEvent({ projectId: existing.projectId, actorId: actor.userId, action: `compliance.precedent.${accepted ? "accepted" : "rejected"}`, entityType: "compliance_precedent", entityId: precedentId, before: existing, after: result });
    if (result.finding) await persistProjectGateReadiness(existing.projectId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") return NextResponse.json({ error: "This precedent changed after you opened it. Reload before reviewing." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review compliance precedent." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
