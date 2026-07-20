import { NextResponse } from "next/server";
import { computeEvidenceEntropy } from "@/lib/evidence/entropy";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

// CanonicalBuildPlan Feature 21 — advisory, read-only evidence-entropy score.
// Deliberately never touches computeReadiness or any gate/blocker path; see
// src/lib/evidence/entropy.ts for the invariant and the six signal rules.
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const result = await computeEvidenceEntropy(projectId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to compute the evidence entropy score." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
