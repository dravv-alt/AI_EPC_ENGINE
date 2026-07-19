import postgres from "postgres";
import { generateQueryEmbedding } from "./embed";
import { env } from "@/lib/env";

const sql = postgres(env.DATABASE_URL);

// Keep the original scorers as fallback when embeddings are unavailable
export function tokenizeQuery(query: string) {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2).slice(0, 12);
}

export function scoreCitationText(query: string, content: string) {
  const tokens = tokenizeQuery(query);
  const normalized = content.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

/**
 * Semantic search over source_regions using pgvector cosine similarity.
 * Falls back to token matching if embeddings are unavailable.
 */
export async function semanticSearch(input: {
  projectId: string;
  query: string;
  limit?: number;
  documentType?: string;
}): Promise<Array<{ regionId: string; score: number; text: string; pageNumber: string; documentVersionId: string }>> {
  const { projectId, query, limit = 10, documentType } = input;

  // Check if GEMINI_API_KEY is available for embedding
  if (!env.GEMINI_API_KEY) {
    // Fallback: use token-based scoring
    const rows = await sql`
      SELECT sr.id, sr.extracted_text, sr.page_number, sr.document_version_id
      FROM source_regions sr
      JOIN document_versions dv ON sr.document_version_id = dv.id
      JOIN documents d ON dv.document_id = d.id
      WHERE d.project_id = ${projectId}
        AND dv.extraction_status = 'completed'
        ${documentType ? sql`AND d.document_type = ${documentType}` : sql``}
      LIMIT 200
    `;
    return rows
      .map((r) => ({
        regionId: r.id as string,
        score: scoreCitationText(query, r.extracted_text as string),
        text: r.extracted_text as string,
        pageNumber: r.page_number as string,
        documentVersionId: r.document_version_id as string,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Semantic: generate query embedding and do cosine similarity
  const queryEmbedding = await generateQueryEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const rows = await sql`
    SELECT
      sr.id,
      sr.extracted_text,
      sr.page_number,
      sr.document_version_id,
      1 - (sr.embedding <=> ${vectorStr}::vector) AS similarity
    FROM source_regions sr
    JOIN document_versions dv ON sr.document_version_id = dv.id
    JOIN documents d ON dv.document_id = d.id
    WHERE d.project_id = ${projectId}
      AND dv.extraction_status = 'completed'
      AND sr.embedding IS NOT NULL
      ${documentType ? sql`AND d.document_type = ${documentType}` : sql``}
    ORDER BY sr.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    regionId: r.id as string,
    score: Number(r.similarity),
    text: r.extracted_text as string,
    pageNumber: r.page_number as string,
    documentVersionId: r.document_version_id as string,
  }));
}
