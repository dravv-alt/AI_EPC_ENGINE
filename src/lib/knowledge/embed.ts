import { env } from "@/lib/env";

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSION = 768;

export { EMBEDDING_DIMENSION };

/**
 * Generate an embedding vector for a text chunk using Gemini's embedding model.
 * Returns a 768-dimensional float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for embedding generation.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSION
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding API returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  const values = body.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected ${EMBEDDING_DIMENSION}-dim embedding, got ${values?.length ?? 0}.`);
  }

  return values;
}

/**
 * Generate a query embedding (same model, different task type for better retrieval).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for embedding generation.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIMENSION
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding API returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  const values = body.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected ${EMBEDDING_DIMENSION}-dim embedding, got ${values?.length ?? 0}.`);
  }

  return values;
}
