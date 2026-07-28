import { env } from "@/lib/env";
import type { SemanticCitation } from "@/lib/knowledge/query";

// Cosine similarity retrieves a broad candidate set; the cross-encoder then
// decides whether each candidate actually answers the query. This second
// score is essential on large corpora where unrelated passages can still have
// a moderately positive cosine score. Mock mode remains deterministic.
export async function rerankCitations(query: string, citations: SemanticCitation[], topK: number): Promise<SemanticCitation[]> {
  if (!citations.length || env.EMBEDDING_PROVIDER === "mock") return citations.slice(0, topK);
  try {
    const response = await fetch(`${env.RETRIEVAL_SERVICE_URL}/rerank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, documents: citations.map((citation) => citation.text), top_k: topK }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Retrieval service rerank request failed with ${response.status}.`);
    const body = await response.json() as { results?: Array<{ index: number; score: number }> };
    const results = body.results;
    if (!results?.length) throw new Error("Retrieval service returned no rerank results.");
    return results
      .filter((result) => result.score >= env.KNOWLEDGE_RERANK_THRESHOLD)
      .map((result) => citations[result.index])
      .filter((citation): citation is SemanticCitation => Boolean(citation));
  } catch {
    // Retrieval remains available when the optional reranker is down; health
    // reporting exposes that degraded state separately.
    return citations.slice(0, topK);
  }
}
