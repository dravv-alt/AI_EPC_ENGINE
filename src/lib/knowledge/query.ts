import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentVersions, knowledgeChunks, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { activeEmbeddingModelTag, getModelProvider } from "@/lib/model/provider";
import { rerankCitations } from "@/lib/knowledge/rerank";

export type SemanticCitation = {
  chunkId: string;
  content: string;
  text: string;
  sourceRegionId: string;
  documentVersionId: string | null;
  documentType: string;
  contentHash: string;
  similarity: number;
};

// Metadata-filter-first semantic retrieval: a mandatory SQL filter on project
// (and optional documentType) runs before ranking, then pgvector cosine
// similarity (1 - cosine distance) orders the surviving chunks and drops
// anything below the configured threshold. The query text is embedded through
// the active model provider so the same embedding space is used for indexing
// and querying.
export async function retrieveSemanticCitations(options: {
  projectId: string;
  query: string;
  documentType?: string;
  threshold?: number;
  limit?: number;
}): Promise<SemanticCitation[]> {
  const threshold = options.threshold ?? env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  const limit = options.limit ?? 8;
  const provider = getModelProvider();
  const embedding = await provider.embed(options.query);
  const vectorLiteral = `[${embedding.join(",")}]`;
  const similarity = sql<number>`1 - (${knowledgeChunks.embedding} <=> ${vectorLiteral}::vector)`;

  // Mixed-embedding-space guard: a chunk embedded under a different provider
  // (e.g. left over after an EMBEDDING_PROVIDER switch, before a reindex) is
  // excluded rather than ranked, so a provider switch degrades to "fewer
  // results" instead of silently corrupting cosine similarity across
  // incompatible vector spaces.
  const filters = [
    eq(knowledgeChunks.projectId, options.projectId),
    sql`${knowledgeChunks.embedding} is not null`,
    eq(knowledgeChunks.embeddingModel, activeEmbeddingModelTag())
  ];
  if (options.documentType) filters.push(eq(knowledgeChunks.documentType, options.documentType));

  // Over-fetch more candidates when reranking is active (EMBEDDING_PROVIDER=
  // service) so the cross-encoder has a real pool to reorder; rerankCitations
  // is a no-op passthrough otherwise, so the mock-mode fetch size (limit * 2)
  // and resulting order stay exactly as before reranking existed.
  const fetchMultiplier = env.EMBEDDING_PROVIDER === "service" ? 4 : 2;
  const rows = await db
    .select({
      chunkId: knowledgeChunks.id,
      content: knowledgeChunks.content,
      sourceRegionId: knowledgeChunks.sourceRegionId,
      documentVersionId: sourceRegions.documentVersionId,
      documentType: knowledgeChunks.documentType,
      contentHash: knowledgeChunks.contentHash,
      similarity
    })
    .from(knowledgeChunks)
    .leftJoin(sourceRegions, eq(knowledgeChunks.sourceRegionId, sourceRegions.id))
    .leftJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
    .leftJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(and(...filters))
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(limit * fetchMultiplier);

  const candidates: SemanticCitation[] = rows
    .filter((row) => Number(row.similarity) >= threshold)
    .map((row) => ({
      chunkId: row.chunkId,
      content: row.content,
      text: row.content,
      sourceRegionId: row.sourceRegionId,
      documentVersionId: row.documentVersionId ?? null,
      documentType: row.documentType,
      contentHash: row.contentHash,
      similarity: Number(row.similarity)
    }));

  return rerankCitations(options.query, candidates, limit);
}
