import { NextResponse } from "next/server";
import { retrieveSemanticCitations } from "@/lib/knowledge/query";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { query, documentType } = await request.json().catch(() => ({}));
  if (typeof query !== "string" || query.trim().length < 3) return NextResponse.json({ error: "A query of at least three characters is required." }, { status: 400 });
  try {
    await requireProjectPermission(projectId, "audit:view");
    const citations = await retrieveSemanticCitations({ projectId, query, documentType: typeof documentType === "string" ? documentType : undefined });
    const claims = citations.map((citation) => ({ text: citation.text, content: citation.content, sourceRegionId: citation.sourceRegionId, documentVersionId: citation.documentVersionId, documentType: citation.documentType, contentHash: citation.contentHash, similarity: citation.similarity }));
    return NextResponse.json({ answer: claims.length ? claims.map((claim) => claim.text).join("\n\n") : null, claims, noResults: claims.length === 0, scopedTo: { projectId, documentType: documentType ?? "all" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to query controlled knowledge" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
