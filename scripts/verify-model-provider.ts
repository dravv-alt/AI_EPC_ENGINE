import assert from "node:assert/strict";
import { z } from "zod";

// Slice 0: the generation/embedding provider split. This is a pure unit-level
// tracer — no database, no network, no containers — so it must pass in every
// environment, including CI with zero secrets configured.
async function main() {
  const providerModule = await import("../src/lib/model/provider");
  const { getGenerationProvider, getEmbeddingProvider, MockModelProvider, parseStructuredResponse } = providerModule as typeof providerModule & {
    parseStructuredResponse: <T>(raw: string, schema: z.ZodType<T>) => T;
  };

  // 1. Mock generation returns the mock payload verbatim, untouched.
  const schema = z.object({ value: z.number() });
  const mock = new MockModelProvider();
  const result = await mock.generateStructured({ system: "s", prompt: "p", schema, mock: { value: 42 } });
  assert.equal(result.data.value, 42, "Mock generation must return the mock payload unchanged.");
  assert.equal(result.provider, "mock");

  // 2. Mock embedding is 768-dim, unit-norm, and deterministic (identical text -> identical vector).
  const embeddingA = await mock.embed("controlled clause text");
  const embeddingB = await mock.embed("controlled clause text");
  const embeddingC = await mock.embed("a completely different sentence");
  assert.equal(embeddingA.length, 768, "Mock embeddings must be 768-dimensional.");
  assert.deepEqual(embeddingA, embeddingB, "Identical text must yield an identical embedding vector.");
  assert.notDeepEqual(embeddingA, embeddingC, "Different text must yield a different embedding vector.");
  const norm = Math.sqrt(embeddingA.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-6, "Mock embeddings must be unit-normalized.");

  // 3. getGenerationProvider()/getEmbeddingProvider() resolve independently per env.
  process.env.MODEL_PROVIDER = "mock";
  process.env.EMBEDDING_PROVIDER = "mock";
  const generationProvider = getGenerationProvider();
  const embeddingProvider = getEmbeddingProvider();
  assert.ok(generationProvider, "getGenerationProvider must resolve under mock config.");
  assert.ok(embeddingProvider, "getEmbeddingProvider must resolve under mock config.");

  // 4. JSON-repair retry: fenced JSON must parse cleanly.
  const fenced = "```json\n{\"value\": 7}\n```";
  const parsedFenced = parseStructuredResponse(fenced, schema);
  assert.equal(parsedFenced.value, 7, "A markdown-fenced JSON response must parse after stripping fences.");

  // 5. JSON-repair retry: prose-wrapped JSON must still parse.
  const prosed = "Sure, here is the JSON you requested:\n{\"value\": 9}\nLet me know if you need anything else.";
  const parsedProsed = parseStructuredResponse(prosed, schema);
  assert.equal(parsedProsed.value, 9, "A JSON object embedded in prose must be extracted and parsed.");

  // 6. Genuinely invalid output must still throw.
  assert.throws(() => parseStructuredResponse("not json at all", schema), "Non-JSON output must throw rather than silently succeed.");

  console.log("Model provider foundation verified: mock generation, mock embedding, provider resolution, and JSON-repair parsing all behave correctly.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
