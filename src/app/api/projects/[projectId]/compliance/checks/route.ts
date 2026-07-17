import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { complianceChecks, documents, documentVersions, requirements, sourceRegions } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
const schema = z.object({ requirementId: z.string().uuid(), targetSourceRegionId: z.string().uuid() });
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid comparison request" }, { status: 400 });
  try {
    await requireProjectPermission(projectId, "requirement:review");
    const [requirement, scopedRegions] = await Promise.all([db.query.requirements.findFirst({ where: eq(requirements.id, parsed.data.requirementId) }), db.select({ region: sourceRegions }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId))]);
    const target = scopedRegions.find((item) => item.region.id === parsed.data.targetSourceRegionId)?.region;
    if (!requirement || requirement.projectId !== projectId || !target) return NextResponse.json({ error: "Controlled requirement and project-scoped target line are required." }, { status: 422 });
    if (requirement.reviewState !== "accepted") return NextResponse.json({ error: "Only accepted requirements can be checked." }, { status: 409 });
    const targetNumber = Number(target.extractedText.match(/-?\d+(?:\.\d+)?/)?.[0]); const deterministic = requirement.modality !== "narrative" && requirement.numericValue !== null && Number.isFinite(targetNumber); const verdict = requirement.modality === "narrative" ? "possible_mismatch" : deterministic && Math.abs(Number(requirement.numericValue) - targetNumber) > Number(requirement.tolerance ?? 0) ? "deterministic_flag" : deterministic ? "conforms" : "needs_engineering_judgment";
    const [check] = await db.insert(complianceChecks).values({ projectId, requirementId: requirement.id, targetSourceRegionId: target.id, verdict, confidence: deterministic ? "1.0000" : "0.0000", reason: deterministic ? `Compared controlled numeric values; target line value ${targetNumber}.` : "Narrative or insufficient structured values require engineering review." }).returning();
    return NextResponse.json({ check, citedRequirementRegionId: requirement.sourceRegionId, citedTargetRegionId: target.id }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run check" }, { status: error instanceof AccessError ? error.status : 500 }); }
}
