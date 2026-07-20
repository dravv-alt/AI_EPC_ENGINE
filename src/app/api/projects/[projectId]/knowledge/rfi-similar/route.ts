import { NextResponse } from "next/server";
import { retrieveSemanticCitations } from "@/lib/knowledge/query";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

// Slice 8: given the text of an RFI being viewed or entered, embed it and return
// documentType=rfi-scoped cosine-threshold vector matches — "previously resolved
// similar RFI" suggestions. The rfi scope is enforced by the metadata filter in
// retrieveSemanticCitations before any ranking.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { text } = await request.json().catch(() => ({}));
  if (typeof text !== "string" || text.trim().length < 3) return NextResponse.json({ error: "RFI text of at least three characters is required." }, { status: 400 });
  try {
    const limited = await enforceAiRateLimit(`knowledge-rfi-similar:${projectId}`);
    if (limited) return limited;
    await requireProjectPermission(projectId, "audit:view");
    const citations = await retrieveSemanticCitations({ projectId, query: text, documentType: "rfi" });
    const suggestions = citations.map((citation) => ({ text: citation.text, content: citation.content, sourceRegionId: citation.sourceRegionId, documentVersionId: citation.documentVersionId, documentType: citation.documentType, contentHash: citation.contentHash, similarity: citation.similarity }));
    return NextResponse.json({ suggestions, noResults: suggestions.length === 0, scopedTo: { projectId, documentType: "rfi" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to find similar RFIs" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
