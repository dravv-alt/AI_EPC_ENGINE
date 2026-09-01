import { and, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentVersions, knowledgeChunks, sourceRegions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { activeEmbeddingModelTag, embedPassages, getModelProvider } from "@/lib/model/provider";
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
  documentVersionStatus: string | null;
  documentId: string | null;
  documentTitle: string | null;
  documentType: string;
  contentHash: string;
  similarity: number;
};

const LEXICAL_STOP_WORDS = new Set(["about", "and", "are", "does", "for", "from", "into", "the", "this", "what", "with"]);

// A durable worker normally populates embeddings immediately after document
// extraction.  Keep retrieval resilient if that worker was started before the
// app configuration was available, or after the embedding provider changed:
// the first query performs a small, project-scoped catch-up and then retries
// semantic retrieval.  The bound avoids turning an interactive search into an
// unbounded reindex; the worker remains responsible for the full backlog.
const INTERACTIVE_EMBED_CATCH_UP_LIMIT = 64;

async function catchUpProjectEmbeddings(projectId: string) {
  const modelTag = activeEmbeddingModelTag();
  const pending = await db
    .select({ id: knowledgeChunks.id, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(and(
      eq(knowledgeChunks.projectId, projectId),
      or(isNull(knowledgeChunks.embedding), ne(knowledgeChunks.embeddingModel, modelTag))
    ))
    .limit(INTERACTIVE_EMBED_CATCH_UP_LIMIT);

  if (!pending.length) return 0;
  const provider = getModelProvider();
  const vectors = await embedPassages(provider, pending.map((chunk) => chunk.content));
  for (const [index, chunk] of pending.entries()) {
    const vector = vectors[index];
    if (!vector) continue;
    await db.update(knowledgeChunks)
      .set({ embedding: vector, embeddingModel: modelTag, updatedAt: new Date() })
      .where(eq(knowledgeChunks.id, chunk.id));
  }
  return pending.length;
}

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
      documentVersionStatus: documentVersions.status,
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
    .orderBy(
      sql`case when ${knowledgeChunks.content} = ${options.query} then 0 else 1 end`,
      desc(knowledgeChunks.updatedAt),
    )
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
        documentVersionStatus: row.documentVersionStatus ?? null,
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

  // Presentation-safe local mode: deterministic development embeddings are
  // not a semantic authority, so search the already-ingested, project-scoped
  // corpus directly. This avoids remote-provider quota/network delays while
  // preserving document, revision, system, asset, gate, and date filters.
  if (env.EMBEDDING_PROVIDER === "mock") {
    return retrieveLexicalCitations({ ...options, limit });
  }

  const provider = getModelProvider();
  let embedding: number[];
  try {
    embedding = await provider.embed(options.query, "query");
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
  let rows = await db
    .select({
      chunkId: knowledgeChunks.id,
      content: knowledgeChunks.content,
      sourceRegionId: knowledgeChunks.sourceRegionId,
      documentVersionId: sourceRegions.documentVersionId,
      documentVersionStatus: documentVersions.status,
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
    // Order by vector distance alone. A non-indexable leading sort key (for
    // example an exact-text CASE) prevents the ivfflat index
    // knowledge_chunks_embedding_idx from serving this ORDER BY and forces a
    // full scan of the project's chunks. The exact-text invariant is applied
    // to the fetched candidates below instead.
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(limit * fetchMultiplier);

  // Do not silently degrade a freshly processed document to keyword matching
  // merely because the asynchronous worker has not caught up yet.  Retry once
  // after a bounded, same-project vector backfill.  A non-empty vector result
  // below the threshold remains a genuine semantic "no match" and is never
  // replaced with lexical results.
  if (!rows.length && await catchUpProjectEmbeddings(options.projectId)) {
    rows = await db
      .select({
        chunkId: knowledgeChunks.id,
        content: knowledgeChunks.content,
        sourceRegionId: knowledgeChunks.sourceRegionId,
        documentVersionId: sourceRegions.documentVersionId,
        documentVersionStatus: documentVersions.status,
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
  }

  const candidates: SemanticCitation[] = rows
    .filter((row) => Number(row.similarity) >= threshold)
    .map((row) => ({
      chunkId: row.chunkId,
      content: row.content,
      text: row.content,
      sourceRegionId: row.sourceRegionId,
      documentVersionId: row.documentVersionId ?? null,
      documentVersionStatus: row.documentVersionStatus ?? null,
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
  // Development mock vectors are not a semantic authority. If they return no
  // threshold-qualified result, use the exact metadata-scoped lexical ranker.
  if (!candidates.length && env.EMBEDDING_PROVIDER !== "service")
    return retrieveLexicalCitations({ ...options, limit });
  // Preserve the exact-text invariant that the SQL ORDER BY deliberately no
  // longer encodes: some hosted embedding models quantize near-duplicate
  // engineering clauses to the same cosine distance, so an identical
  // controlled excerpt must still rank first among the fetched candidates.
  const exactQuery = options.query.trim();
  const ordered = exactQuery
    ? [...candidates].sort((a, b) => Number(b.content.trim() === exactQuery) - Number(a.content.trim() === exactQuery))
    : candidates;
  return rerankCitations(options.query, ordered, limit);
}
