import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentVersions, requirements, sourceRegions } from "@/lib/db/schema";
import { retrieveSemanticCitations } from "@/lib/knowledge/query";

const targetDocumentTypes = ["submittal", "po", "shop_drawing", "drawing"] as const;

export type CandidateTarget = {
  targetSourceRegionId: string;
  similarity: number;
  documentType: string;
  documentTitle: string;
  text: string;
};

// Given an accepted requirement, semantically searches the project's
// submittals/POs/shop-drawings/drawings for candidate target regions to
// compare it against. The metadata filter (project + exactly these four
// document types) runs in SQL before ranking, once per document type — a
// single unfiltered call would let ranking, not the filter, decide which
// document types survive.
export async function discoverCandidateTargets(input: {
  projectId: string;
  requirementId: string;
  limit?: number;
}): Promise<CandidateTarget[]> {
  const limit = input.limit ?? 5;

  const requirement = await db.query.requirements.findFirst({ where: and(eq(requirements.id, input.requirementId), eq(requirements.projectId, input.projectId)) });
  if (!requirement || requirement.reviewState !== "accepted") return [];

  const perTypeResults = await Promise.all(
    targetDocumentTypes.map((documentType) => retrieveSemanticCitations({ projectId: input.projectId, query: requirement.statement, documentType, limit }))
  );

  const union = perTypeResults.flat().filter((candidate) => candidate.sourceRegionId !== requirement.sourceRegionId);
  const ranked = union.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  if (!ranked.length) return [];

  const documentTitles = await db
    .select({ regionId: sourceRegions.id, documentTitle: documents.title })
    .from(sourceRegions)
    .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(and(eq(documents.projectId, input.projectId), inArray(sourceRegions.id, ranked.map((candidate) => candidate.sourceRegionId))));
  const titleByRegion = new Map(documentTitles.map((row) => [row.regionId, row.documentTitle]));

  return ranked.map((candidate) => ({
    targetSourceRegionId: candidate.sourceRegionId,
    similarity: candidate.similarity,
    documentType: candidate.documentType,
    documentTitle: titleByRegion.get(candidate.sourceRegionId) ?? "",
    text: candidate.text
  }));
}
