import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { answerKnowledgeQuery } from "@/lib/knowledge/pipeline";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { query, documentType } = await request.json().catch(() => ({}));
  if (typeof query !== "string" || query.trim().length < 3) return NextResponse.json({ error: "A query of at least three characters is required." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const limited = await enforceAiRateLimit(`knowledge-query:${projectId}`);
    if (limited) return limited;
    const result = await answerKnowledgeQuery({ projectId, query, documentType: typeof documentType === "string" ? documentType : undefined });
    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "knowledge.query.answered",
      entityType: "project",
      entityId: projectId,
      after: {
        query,
        planModel: result.planModel,
        planProvider: result.planProvider,
        synthesisModel: result.synthesisModel,
        synthesisProvider: result.synthesisProvider,
        claimCount: result.claims.length,
        droppedClaimCount: result.droppedClaimCount,
        noResults: result.noResults,
        advisory: true
      }
    });
    return NextResponse.json({ answer: result.answer, claims: result.claims, noResults: result.noResults, scopedTo: { projectId, documentType: documentType ?? "all" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to query controlled knowledge" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
