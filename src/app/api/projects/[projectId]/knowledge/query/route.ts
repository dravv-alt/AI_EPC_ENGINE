import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { answerKnowledgeQuery } from "@/lib/knowledge/pipeline";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";
import { z } from "zod";

const optionalUuid = z.string().uuid().optional();

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { query, documentType, documentId, systemId, assetId, gateId, revision, dateFrom, dateTo } = await request.json().catch(() => ({}));
  if (typeof query !== "string" || query.trim().length < 3) return NextResponse.json({ error: "A query of at least three characters is required." }, { status: 400 });
  const parsedDocumentId = optionalUuid.safeParse(typeof documentId === "string" && documentId ? documentId : undefined);
  if (!parsedDocumentId.success) return NextResponse.json({ error: "Document scope must be a valid identifier." }, { status: 400 });
  const parsedDateFrom = typeof dateFrom === "string" && !Number.isNaN(Date.parse(dateFrom)) ? new Date(dateFrom) : undefined;
  const parsedDateTo = typeof dateTo === "string" && !Number.isNaN(Date.parse(dateTo)) ? new Date(dateTo) : undefined;
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const limited = await enforceAiRateLimit(`knowledge-query:${projectId}`);
    if (limited) return limited;
    const result = await answerKnowledgeQuery({
      projectId,
      query,
      documentType: typeof documentType === "string" ? documentType : undefined,
      documentId: parsedDocumentId.data,
      systemId: typeof systemId === "string" ? systemId : undefined,
      assetId: typeof assetId === "string" ? assetId : undefined,
      gateId: typeof gateId === "string" ? gateId : undefined,
      revision: typeof revision === "string" ? revision : undefined,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo
    });
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
        ,documentScope: result.documentScope
      }
    });
    return NextResponse.json({
      answer: result.answer,
      claims: result.claims,
      noResults: result.noResults,
      scopedTo: {
        projectId,
        documentType: documentType ?? "all",
        documentId: result.documentScope?.id ?? "all",
        documentTitle: result.documentScope?.title ?? "all",
        documentScopeSource: result.documentScope?.source ?? "none",
        systemId: typeof systemId === "string" ? systemId : "all",
        assetId: typeof assetId === "string" ? assetId : "all",
        gateId: typeof gateId === "string" ? gateId : "all",
        revision: typeof revision === "string" ? revision : "all",
        dateFrom: parsedDateFrom?.toISOString() ?? "any",
        dateTo: parsedDateTo?.toISOString() ?? "any"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to query controlled knowledge" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
