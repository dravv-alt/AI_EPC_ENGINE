import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  documents,
  documentVersions,
  requirements,
  sourceRegions,
} from "@/lib/db/schema";
import { retrieveSemanticCitations } from "@/lib/knowledge/query";

export const complianceTargetDocumentTypes = [
  "submittal",
  "po",
  "shop_drawing",
  "drawing",
] as const;

export type CandidateTarget = {
  targetSourceRegionId: string;
  similarity: number;
  documentType: string;
  documentTitle: string;
  text: string;
  contentHash: string;
};

const complianceStopWords = new Set([
  "shall", "must", "should", "with", "from", "that", "this", "have",
  "will", "into", "than", "then", "where", "when", "which", "their",
  "design", "system", "equipment", "minimum", "maximum", "required",
]);

function meaningfulTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !complianceStopWords.has(token)),
  );
}

// Embedding similarity alone can pair clauses from entirely different
// engineering domains (for example chilled-water temperature and enclosure
// ingress protection). A candidate must also share at least one meaningful
// controlled term, or two terms for a low-scoring semantic result.
export function isComplianceCandidateRelevant(
  requirementText: string,
  candidateText: string,
  similarity: number,
) {
  const requirementTokens = meaningfulTokens(requirementText);
  const candidateTokens = meaningfulTokens(candidateText);
  const overlap = [...requirementTokens].filter((token) =>
    candidateTokens.has(token),
  );
  return similarity >= 0.72
    ? overlap.length >= 1
    : similarity >= 0.52 && overlap.length >= 2;
}

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
  const retrievalLimit = Math.max(20, limit * 4);

  const requirement = await db.query.requirements.findFirst({
    where: and(
      eq(requirements.id, input.requirementId),
      eq(requirements.projectId, input.projectId),
    ),
  });
  if (!requirement || requirement.reviewState !== "accepted") return [];

  const perTypeResults = await Promise.all(
    complianceTargetDocumentTypes.map((documentType) =>
      retrieveSemanticCitations({
        projectId: input.projectId,
        query: requirement.statement,
        documentType,
        limit: retrievalLimit,
      }),
    ),
  );

  const union = perTypeResults
    .flat()
    .filter(
      (candidate) => candidate.sourceRegionId !== requirement.sourceRegionId,
    )
    .filter((candidate) =>
      isComplianceCandidateRelevant(
        requirement.statement,
        candidate.text,
        candidate.similarity,
      ),
    );
  const ranked = union.sort((a, b) => b.similarity - a.similarity);
  if (!ranked.length) return [];

  const [requirementSource] = await db
    .select({
      documentId: documents.id,
      versionStatus: documentVersions.status,
      extractionStatus: documentVersions.extractionStatus,
    })
    .from(sourceRegions)
    .innerJoin(
      documentVersions,
      eq(sourceRegions.documentVersionId, documentVersions.id),
    )
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(
      and(
        eq(documents.projectId, input.projectId),
        eq(sourceRegions.id, requirement.sourceRegionId),
      ),
    )
    .limit(1);
  if (
    !requirementSource ||
    requirementSource.versionStatus !== "approved" ||
    requirementSource.extractionStatus !== "completed"
  )
    return [];

  const targetSources = await db
    .select({
      regionId: sourceRegions.id,
      documentId: documents.id,
      documentTitle: documents.title,
      versionStatus: documentVersions.status,
      extractionStatus: documentVersions.extractionStatus,
    })
    .from(sourceRegions)
    .innerJoin(
      documentVersions,
      eq(sourceRegions.documentVersionId, documentVersions.id),
    )
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(
      and(
        eq(documents.projectId, input.projectId),
        inArray(
          sourceRegions.id,
          ranked.map((candidate) => candidate.sourceRegionId),
        ),
      ),
    );
  const sourceByRegion = new Map(
    targetSources.map((row) => [row.regionId, row]),
  );
  const eligible = ranked.filter((candidate) => {
    const source = sourceByRegion.get(candidate.sourceRegionId);
    return (
      source?.versionStatus === "approved" &&
      source.extractionStatus === "completed" &&
      source.documentId !== requirementSource?.documentId
    );
  });

  // Preserve source diversity before filling remaining slots by relevance. A
  // global top-k can otherwise return five adjacent chunks from one drawing
  // and completely miss a relevant PO or vendor submittal.
  const selected: typeof eligible = [];
  const selectedRegionIds = new Set<string>();
  const representedDocuments = new Set<string>();
  for (const candidate of eligible) {
    const documentId = sourceByRegion.get(candidate.sourceRegionId)!.documentId;
    if (representedDocuments.has(documentId)) continue;
    selected.push(candidate);
    selectedRegionIds.add(candidate.sourceRegionId);
    representedDocuments.add(documentId);
    if (selected.length === limit) break;
  }
  for (const candidate of eligible) {
    if (selected.length === limit) break;
    if (selectedRegionIds.has(candidate.sourceRegionId)) continue;
    selected.push(candidate);
    selectedRegionIds.add(candidate.sourceRegionId);
  }

  return selected.map((candidate) => ({
    targetSourceRegionId: candidate.sourceRegionId,
    similarity: candidate.similarity,
    documentType: candidate.documentType,
    documentTitle:
      sourceByRegion.get(candidate.sourceRegionId)?.documentTitle ?? "",
    text: candidate.text,
    contentHash: candidate.contentHash,
  }));
}
