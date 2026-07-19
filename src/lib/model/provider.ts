import { createHash } from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 768;

export interface ModelRequest<T> { system: string; prompt: string; schema: z.ZodType<T>; mock: T }
export interface ModelResult<T> { data: T; provider: "mock" | "gemini" | "nim"; model: string; usage?: { inputTokens?: number; outputTokens?: number } }

export interface GenerationProvider {
  generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>>;
}
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
// Compatibility alias: most existing call sites depend on a single provider
// exposing both methods (e.g. the mock and Gemini clients did both jobs).
export interface ModelProvider extends GenerationProvider, EmbeddingProvider {}

// Deterministic pseudo-embedding: hash-seeded unit vector. The same text always
// yields the same vector, so cosine similarity is stable across runs and
// identical content collides exactly — enough to exercise the pgvector path
// without a live embedding model.
function deterministicEmbedding(text: string): number[] {
  const values: number[] = [];
  let counter = 0;
  while (values.length < EMBEDDING_DIMENSIONS) {
    const digest = createHash("sha256").update(`${text}#${counter}`).digest();
    for (let offset = 0; offset < digest.length && values.length < EMBEDDING_DIMENSIONS; offset += 2) {
      values.push((digest.readUInt16BE(offset) / 65535) * 2 - 1);
    }
    counter += 1;
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / norm);
}

// Strips markdown code fences and surrounding prose, then validates against the
// schema. Shared by every real (non-mock) generation provider so a model that
// wraps its JSON in ```json fences or a sentence of preamble still parses
// instead of throwing on the first sloppy token.
export function parseStructuredResponse<T>(raw: string, schema: z.ZodType<T>): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? raw).trim();
  const jsonSlice = extractJsonObject(candidate) ?? candidate;
  return schema.parse(JSON.parse(jsonSlice));
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// Shared repair-retry loop: call the model once, try to parse; on failure,
// call it again with the validation error appended to the prompt; fail hard
// only after the second attempt. Keeps a single sloppy token from failing an
// entire job outright, for any real (non-mock) provider.
export async function requestStructuredJson<T>(options: {
  schema: z.ZodType<T>;
  callModel: (promptSuffix: string) => Promise<string>;
}): Promise<T> {
  const first = await options.callModel("");
  try {
    return parseStructuredResponse(first, options.schema);
  } catch (firstError) {
    const reason = firstError instanceof Error ? firstError.message : String(firstError);
    const second = await options.callModel(`\n\nYour previous response could not be parsed as valid JSON matching the required schema (${reason}). Respond again with ONLY the corrected JSON object, no markdown fences, no commentary.`);
    try {
      return parseStructuredResponse(second, options.schema);
    } catch (secondError) {
      const secondReason = secondError instanceof Error ? secondError.message : String(secondError);
      throw new Error(`Model returned invalid structured output after a repair retry: ${secondReason}`);
    }
  }
}

export class MockModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> { return { data: request.schema.parse(request.mock), provider: "mock", model: "deterministic-mock-v1" }; }
  async embed(text: string): Promise<number[]> { return deterministicEmbedding(text); }
}

export class GeminiModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini.");
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system_instruction: { parts: [{ text: request.system }] }, contents: [{ role: "user", parts: [{ text: request.prompt + promptSuffix }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
        if (!response.ok) throw new Error(`Gemini request failed with ${response.status}: ${await response.text()}`);
        const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Gemini returned no structured response.");
        usage = { inputTokens: body.usageMetadata?.promptTokenCount, outputTokens: body.usageMetadata?.candidatesTokenCount };
        return text;
      }
    });
    return { data, provider: "gemini", model: env.GEMINI_MODEL, usage };
  }
  async embed(text: string): Promise<number[]> {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini.");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text }] }, outputDimensionality: EMBEDDING_DIMENSIONS }) });
    if (!response.ok) throw new Error(`Gemini embedding request failed with ${response.status}.`);
    const body = await response.json() as { embedding?: { values?: number[] } };
    const values = body.embedding?.values;
    if (!values?.length) throw new Error("Gemini returned no embedding vector.");
    return values;
  }
}

// NVIDIA NIM: OpenAI-compatible chat-completions endpoint, hosted (default) or
// self-hosted via NIM_BASE_URL. No native structured-output binding like
// Gemini's responseMimeType, so the Zod schema is rendered as JSON Schema and
// placed in the system prompt, and response_format requests a JSON object.
export class NimModelProvider implements GenerationProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.NIM_API_KEY) throw new Error("NIM_API_KEY is required when MODEL_PROVIDER=nim.");
    const jsonSchema = JSON.stringify(zodToJsonSchema(request.schema, "response"));
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const systemMessage = `${request.system}\n\nRespond with ONLY a JSON object matching this schema, no markdown fences, no commentary:\n${jsonSchema}`;
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const response = await fetch(`${env.NIM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.NIM_API_KEY}` },
          body: JSON.stringify({
            model: env.NIM_MODEL,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: request.prompt + promptSuffix }
            ]
          })
        });
        if (!response.ok) throw new Error(`NIM request failed with ${response.status}: ${await response.text()}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = body.choices?.[0]?.message?.content;
        if (!text) throw new Error("NIM returned no structured response.");
        usage = { inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
        return text;
      }
    });
    return { data, provider: "nim", model: env.NIM_MODEL, usage };
  }
}

// Embeds via the stateless Python retrieval service (Slice 1). Batches are not
// used here — this method embeds a single query string at request time; the
// worker backfill loop batches separately.
export class ServiceEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${env.RETRIEVAL_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [text], kind: "query" }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Retrieval service embed request failed with ${response.status}.`);
    const body = await response.json() as { embeddings?: number[][] };
    const vector = body.embeddings?.[0];
    if (!vector?.length) throw new Error("Retrieval service returned no embedding vector.");
    return vector;
  }
}

export function getGenerationProvider(): GenerationProvider {
  if (env.MODEL_PROVIDER === "gemini") return new GeminiModelProvider();
  if (env.MODEL_PROVIDER === "nim") return new NimModelProvider();
  return new MockModelProvider();
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return env.EMBEDDING_PROVIDER === "service" ? new ServiceEmbeddingProvider() : new MockModelProvider();
}

// The mixed-embedding-space guard (Slice 1, decision #4): every vector written
// or queried is tagged with the model that produced it, so a provider switch
// degrades to "no results" instead of silently ranking incompatible vector
// spaces against each other with cosine similarity.
export function activeEmbeddingModelTag(): string {
  return env.EMBEDDING_PROVIDER === "service" ? "bge-base-en-v1.5" : "deterministic-mock-v1";
}

// Compatibility shim for existing call sites that expect one object exposing
// both generateStructured and embed. Each method still resolves against its
// own independent provider switch.
export function getModelProvider(): ModelProvider {
  const generation = getGenerationProvider();
  const embedding = getEmbeddingProvider();
  return {
    generateStructured: (request) => generation.generateStructured(request),
    embed: (text) => embedding.embed(text)
  };
}
