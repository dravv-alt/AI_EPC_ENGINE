import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { citation, createComplianceCheck, CreateComplianceCheckError } from "@/lib/compliance/create-check";
import { db } from "@/lib/db/client";
import { complianceChecks, requirements, users } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({
  requirementId: z.string().uuid(),
  targetSourceRegionId: z.string().uuid(),
  precedentId: z.string().uuid().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const rows = await db.select({ check: complianceChecks, reviewerName: users.displayName }).from(complianceChecks).leftJoin(users, eq(complianceChecks.reviewedBy, users.id)).where(eq(complianceChecks.projectId, projectId)).orderBy(desc(complianceChecks.createdAt));
    const items = await Promise.all(rows.map(async ({ check, reviewerName }) => ({
      ...check,
      reviewerName,
      requirementCitation: await citation((await db.query.requirements.findFirst({ where: and(eq(requirements.id, check.requirementId), eq(requirements.projectId, projectId)) }))!.sourceRegionId),
      targetCitation: await citation(check.targetSourceRegionId)
    })));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load compliance checks." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comparison request.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "requirement:review");
    const limited = await enforceAiRateLimit(`compliance-check:${projectId}`);
    if (limited) return limited;
    const result = await createComplianceCheck({ projectId, requirementId: parsed.data.requirementId, targetSourceRegionId: parsed.data.targetSourceRegionId, actorId: actor.userId, precedentId: parsed.data.precedentId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CreateComplianceCheckError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run check." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
