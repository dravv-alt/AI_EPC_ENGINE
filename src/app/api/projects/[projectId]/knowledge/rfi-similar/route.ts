import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documentVersions, documents } from "@/lib/db/schema";
import { retrieveSemanticCitations } from "@/lib/knowledge/query";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

// Slice 8/9: given the text of an RFI being viewed or entered, embed it and
// return documentType=rfi-scoped cosine-threshold vector matches. The rfi
// scope is enforced by the metadata filter in retrieveSemanticCitations
// before any ranking.
//
// Slice 9: nothing in `documentVersions.status` (a document-lifecycle state)
// distinguishes a resolved RFI from an open one, so this endpoint used to
// label every documentType=rfi match "previously resolved" regardless of
// actual resolution. It now looks up each match's owning document's
// `resolutionState` and only returns `resolutionState = "resolved"` matches
// under `suggestions` (the endpoint's whole premise is prior resolutions);
// unresolved matches, if any, come back in the separately-labeled
// `unresolvedSuggestions` field and must never be rendered under a
// "resolved" heading.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { text } = await request.json().catch(() => ({}));
  if (typeof text !== "string" || text.trim().length < 3) return NextResponse.json({ error: "RFI text of at least three characters is required." }, { status: 400 });
  try {
    const limited = await enforceAiRateLimit(`knowledge-rfi-similar:${projectId}`);
    if (limited) return limited;
    await requireProjectPermission(projectId, "audit:view");
    const citations = await retrieveSemanticCitations({ projectId, query: text, documentType: "rfi" });
    const versionIds = [...new Set(citations.map((citation) => citation.documentVersionId).filter((id): id is string => Boolean(id)))];
    const stateRows = versionIds.length
      ? await db.select({ documentVersionId: documentVersions.id, resolutionState: documents.resolutionState })
          .from(documentVersions)
          .innerJoin(documents, eq(documentVersions.documentId, documents.id))
          .where(inArray(documentVersions.id, versionIds))
      : [];
    const resolutionByVersion = new Map(stateRows.map((row) => [row.documentVersionId, row.resolutionState]));
    const toSuggestion = (citation: (typeof citations)[number]) => ({ text: citation.text, content: citation.content, sourceRegionId: citation.sourceRegionId, documentVersionId: citation.documentVersionId, documentType: citation.documentType, contentHash: citation.contentHash, similarity: citation.similarity });
    const resolved = citations.filter((citation) => resolutionByVersion.get(citation.documentVersionId ?? "") === "resolved").map(toSuggestion);
    const unresolved = citations.filter((citation) => resolutionByVersion.get(citation.documentVersionId ?? "") !== "resolved").map(toSuggestion);
    return NextResponse.json({ suggestions: resolved, unresolvedSuggestions: unresolved, noResults: resolved.length === 0, scopedTo: { projectId, documentType: "rfi" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to find similar RFIs" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
