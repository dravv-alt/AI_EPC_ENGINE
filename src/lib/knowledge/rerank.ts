import { env } from "@/lib/env";
import type { SemanticCitation } from "@/lib/knowledge/query";

// Cross-encoder reranking over the retrieval service. When EMBEDDING_PROVIDER
// is not "service" (the offline default), this is a no-op passthrough that
// preserves the existing cosine ordering exactly — so the mock-mode
// verification matrix stays byte-identical to before reranking existed.
export async function rerankCitations(query: string, citations: SemanticCitation[], topK: number): Promise<SemanticCitation[]> {
  if (env.EMBEDDING_PROVIDER !== "service" || citations.length <= 1) return citations.slice(0, topK);
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
  return results.map((result) => citations[result.index]).filter((citation): citation is SemanticCitation => Boolean(citation));
}
