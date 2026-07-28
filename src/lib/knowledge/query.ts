import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentVersions, knowledgeChunks, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { activeEmbeddingModelTag, getModelProvider } from "@/lib/model/provider";
import { rerankCitations } from "@/lib/knowledge/rerank";

// ADR-021 scope dimensions: a requirement or evidence row anchored to the
// chunk's source_region_id is the entry point into the provenance graph
// (mirrors the anchor resolution in expand.ts). From that anchor, a chunk is
// "in scope" for a system/asset/gate filter when either:
//   - the anchor is evidence carrying that system_id/asset_id directly
//     (evidence already has those columns; no edge needed), or
//   - a one-hop AFFECTS/BELONGS_TO edge (either direction) connects the
//     anchor to the target system/asset/gate node.
// This runs as a correlated SQL subquery, not a JS graph walk, so it composes
// into the mandatory pre-ranking WHERE clause alongside project/documentType
// instead of being applied after vector ranking.
function scopeFilterSql(projectId: string, targetType: "system" | "asset" | "gate", targetId: string) {
  return sql`${knowledgeChunks.sourceRegionId} IN (
    SELECT requirements.source_region_id FROM requirements
    WHERE requirements.project_id = ${projectId} AND requirements.source_region_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM edges
        WHERE edges.project_id = ${projectId}
          AND edges.relationship_type IN ('AFFECTS', 'BELONGS_TO')
          AND (
            (edges.from_type = 'requirement' AND edges.from_id = requirements.id AND edges.to_type = ${targetType} AND edges.to_id = ${targetId})
            OR (edges.to_type = 'requirement' AND edges.to_id = requirements.id AND edges.from_type = ${targetType} AND edges.from_id = ${targetId})
          )
      )
    UNION
    SELECT evidence.source_region_id FROM evidence
    WHERE evidence.project_id = ${projectId} AND evidence.source_region_id IS NOT NULL
      AND (
        (${targetType} = 'system' AND evidence.system_id = ${targetId})
        OR (${targetType} = 'asset' AND evidence.asset_id = ${targetId})
        OR EXISTS (
          SELECT 1 FROM edges
          WHERE edges.project_id = ${projectId}
            AND edges.relationship_type IN ('AFFECTS', 'BELONGS_TO')
            AND (
              (edges.from_type = 'evidence' AND edges.from_id = evidence.id AND edges.to_type = ${targetType} AND edges.to_id = ${targetId})
              OR (edges.to_type = 'evidence' AND edges.to_id = evidence.id AND edges.from_type = ${targetType} AND edges.from_id = ${targetId})
            )
        )
      )
  )`;
}

export type SemanticCitation = {
  chunkId: string;
  content: string;
  text: string;
  sourceRegionId: string;
  documentVersionId: string | null;
  documentId: string | null;
  documentTitle: string | null;
  documentType: string;
  contentHash: string;
  similarity: number;
};

const LEXICAL_STOP_WORDS = new Set(["about", "and", "are", "does", "for", "from", "into", "the", "this", "what", "with"]);

function lexicalTokens(value: string) {
  return [...new Set(value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length >= 3 && !LEXICAL_STOP_WORDS.has(token)).map((token) => token.endsWith("ies") ? `${token.slice(0, -3)}y` : token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token))];
}

async function retrieveLexicalCitations(options: {
  projectId: string;
  query: string;
  documentType?: string;
  documentId?: string;
  systemId?: string;
  assetId?: string;
  gateId?: string;
  revision?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
}): Promise<SemanticCitation[]> {
  const filters = [eq(knowledgeChunks.projectId, options.projectId)];
  if (options.documentType) filters.push(eq(knowledgeChunks.documentType, options.documentType));
  if (options.documentId) filters.push(eq(documents.id, options.documentId));
  if (options.revision) filters.push(eq(documentVersions.revision, options.revision));
  if (options.dateFrom) filters.push(gte(documentVersions.createdAt, options.dateFrom));
  if (options.dateTo) filters.push(lte(documentVersions.createdAt, options.dateTo));
  if (options.systemId) filters.push(scopeFilterSql(options.projectId, "system", options.systemId));
  if (options.assetId) filters.push(scopeFilterSql(options.projectId, "asset", options.assetId));
  if (options.gateId) filters.push(scopeFilterSql(options.projectId, "gate", options.gateId));

  const rows = await db
    .select({
      chunkId: knowledgeChunks.id,
      content: knowledgeChunks.content,
      sourceRegionId: knowledgeChunks.sourceRegionId,
      documentVersionId: sourceRegions.documentVersionId,
      documentId: documents.id,
      documentTitle: documents.title,
      documentType: knowledgeChunks.documentType,
      contentHash: knowledgeChunks.contentHash
    })
    .from(knowledgeChunks)
    .leftJoin(sourceRegions, eq(knowledgeChunks.sourceRegionId, sourceRegions.id))
    .leftJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
    .leftJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(and(...filters))
    .limit(500);

  const queryTokens = lexicalTokens(options.query);
  if (!queryTokens.length) return [];
  return rows
    .map((row) => {
      const contentTokens = new Set(lexicalTokens(`${row.documentTitle ?? ""} ${row.content}`));
      const overlap = queryTokens.filter((token) => contentTokens.has(token)).length;
      const similarity = overlap ? 0.35 + 0.65 * (overlap / queryTokens.length) : 0;
      return {
        chunkId: row.chunkId,
        content: row.content,
        text: row.content,
        sourceRegionId: row.sourceRegionId,
        documentVersionId: row.documentVersionId ?? null,
        documentId: row.documentId ?? null,
        documentTitle: row.documentTitle ?? null,
        documentType: row.documentType,
        contentHash: row.contentHash,
        similarity
      };
    })
    .filter((row) => row.similarity > 0)
    .sort((left, right) => right.similarity - left.similarity || left.chunkId.localeCompare(right.chunkId))
    .slice(0, options.limit);
}

// Metadata-filter-first semantic retrieval: a mandatory SQL filter on project
// (and optional documentType/systemId/assetId/gateId/revision/date range)
// runs before ranking, then pgvector cosine similarity (1 - cosine distance)
// orders the surviving chunks and drops anything below the configured
// threshold. The query text is embedded through the active model provider so
// the same embedding space is used for indexing and querying.
export async function retrieveSemanticCitations(options: {
  projectId: string;
  query: string;
  documentType?: string;
  documentId?: string;
  systemId?: string;
  assetId?: string;
  gateId?: string;
  revision?: string;
  dateFrom?: Date;
  dateTo?: Date;
  threshold?: number;
  limit?: number;
}): Promise<SemanticCitation[]> {
  const threshold = options.threshold ?? env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  const limit = options.limit ?? 8;
  const provider = getModelProvider();
  let embedding: number[];
  try {
    embedding = await provider.embed(options.query);
  } catch {
    return retrieveLexicalCitations({ ...options, limit });
  }
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
  if (options.documentId) filters.push(eq(documents.id, options.documentId));
  if (options.revision) filters.push(eq(documentVersions.revision, options.revision));
  if (options.dateFrom) filters.push(gte(documentVersions.createdAt, options.dateFrom));
  if (options.dateTo) filters.push(lte(documentVersions.createdAt, options.dateTo));
  if (options.systemId) filters.push(scopeFilterSql(options.projectId, "system", options.systemId));
  if (options.assetId) filters.push(scopeFilterSql(options.projectId, "asset", options.assetId));
  if (options.gateId) filters.push(scopeFilterSql(options.projectId, "gate", options.gateId));

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
      documentId: documents.id,
      documentTitle: documents.title,
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
      documentId: row.documentId ?? null,
      documentTitle: row.documentTitle ?? null,
      documentType: row.documentType,
      contentHash: row.contentHash,
      similarity: Number(row.similarity)
    }));

  // A processed source may have controlled chunks before the asynchronous
  // embedding worker has populated vectors. Keep the source searchable through
  // a deterministic lexical fallback until indexing catches up. If vector rows
  // exist but all are below threshold, preserve the semantic "no match" result.
  if (!rows.length) return retrieveLexicalCitations({ ...options, limit });
  return rerankCitations(options.query, candidates, limit);
}
