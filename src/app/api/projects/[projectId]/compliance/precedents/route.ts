import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { normalizedContentHash } from "@/lib/compliance/compare";
import { db } from "@/lib/db/client";
import { complianceChecks, compliancePrecedents, sourceRegions, users } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({
  checkId: z.string().uuid(),
  title: z.string().trim().min(5).max(250),
  rationale: z.string().trim().min(20).max(5000)
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select({ precedent: compliancePrecedents, creatorName: users.displayName }).from(compliancePrecedents).leftJoin(users, eq(compliancePrecedents.createdBy, users.id)).where(eq(compliancePrecedents.projectId, projectId)).orderBy(desc(compliancePrecedents.createdAt));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load compliance precedents." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Precedent proposal is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "requirement:review");
    const check = await db.query.complianceChecks.findFirst({ where: and(eq(complianceChecks.id, parsed.data.checkId), eq(complianceChecks.projectId, projectId)) });
    if (!check) return NextResponse.json({ error: "The source compliance check is outside this project." }, { status: 404 });
    if (check.comparisonType !== "qualitative" || !["possible_mismatch", "needs_engineering_judgment"].includes(check.verdict)) return NextResponse.json({ error: "Equality precedents are only permitted for qualitative comparisons. Deterministic numeric, boolean, and categorical deviations cannot be overridden by precedent." }, { status: 409 });
    const target = await db.query.sourceRegions.findFirst({ where: eq(sourceRegions.id, check.targetSourceRegionId) });
    if (!target) return NextResponse.json({ error: "The exact target citation is unavailable." }, { status: 409 });
    const duplicate = await db.query.compliancePrecedents.findFirst({ where: and(eq(compliancePrecedents.projectId, projectId), eq(compliancePrecedents.requirementId, check.requirementId), eq(compliancePrecedents.targetContentHash, normalizedContentHash(target.extractedText)), eq(compliancePrecedents.reviewState, "accepted")) });
    if (duplicate) return NextResponse.json({ error: "An accepted precedent already governs this requirement and normalized target line.", precedentId: duplicate.id }, { status: 409 });
    const [precedent] = await db.insert(compliancePrecedents).values({ projectId, requirementId: check.requirementId, targetSourceRegionId: check.targetSourceRegionId, targetContentHash: normalizedContentHash(target.extractedText), sourceCheckId: check.id, title: parsed.data.title, rationale: parsed.data.rationale, createdBy: actor.userId }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "compliance.precedent.proposed", entityType: "compliance_precedent", entityId: precedent.id, after: { ...precedent, advisory: true } });
    return NextResponse.json({ precedent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to propose compliance precedent." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
