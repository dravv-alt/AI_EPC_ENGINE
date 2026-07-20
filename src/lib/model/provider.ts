import { createHash } from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env, modelRequestTimeoutMs } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 768;

export interface ModelRequest<T> { system: string; prompt: string; schema: z.ZodType<T>; mock: T }
export interface ModelResult<T> { data: T; provider: "mock" | "ollama" | "gemini" | "nim"; model: string; usage?: { inputTokens?: number; outputTokens?: number } }

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

function boundedPrompt(text: string, label: string) {
  if (text.length > env.MODEL_PROMPT_MAX_CHARS) {
    throw new Error(`${label} exceeds the configured ${env.MODEL_PROMPT_MAX_CHARS}-character model input limit.`);
  }
  return text;
}

function remainingDeadline(deadline: number, provider: string) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error(`${provider} request exceeded its ${modelRequestTimeoutMs} ms end-to-end deadline.`);
  return remainingMs;
}

async function fetchWithinDeadline(url: string, init: RequestInit, deadline: number, provider: string) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(remainingDeadline(deadline, provider)) });
}

export type ProviderHealth = {
  status: "ok" | "unavailable";
  provider: "mock" | "ollama" | "gemini" | "nim" | "service";
  model: string;
  reason?: string;
};

async function providerHealth<T extends ProviderHealth["provider"]>(provider: T, model: string, check: () => Promise<void>): Promise<ProviderHealth> {
  try {
    await check();
    return { status: "ok", provider, model };
  } catch (error) {
    return { status: "unavailable", provider, model, reason: error instanceof Error ? error.message : "Provider unavailable" };
  }
}

async function assertHealthResponse(response: Response, provider: string) {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`${provider} health check failed with ${response.status}${detail ? `: ${detail}` : ""}`);
}

async function checkOllamaModel(model: string) {
  const deadline = Date.now() + modelRequestTimeoutMs;
  const response = await fetchWithinDeadline(`${env.OLLAMA_BASE_URL}/api/show`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model })
  }, deadline, "Ollama health check");
  await assertHealthResponse(response, "Ollama");
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

/**
 * Local, non-streaming structured generation. The hard request deadline,
 * bounded prompt, context window, and output cap keep a slow local model from
 * tying up a Next.js request or flooding a browser with an unbounded answer.
 */
export class OllamaModelProvider implements GenerationProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    const schema = zodToJsonSchema(request.schema, "response");
    const deadline = Date.now() + modelRequestTimeoutMs;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const prompt = boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt");
        const response = await fetchWithinDeadline(`${env.OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: env.OLLAMA_MODEL,
            stream: false,
            think: false,
            format: schema,
            messages: [
              { role: "system", content: `${boundedPrompt(request.system, "System prompt")}\nReturn only JSON that satisfies the supplied schema.` },
              { role: "user", content: prompt }
            ],
            options: { temperature: 0, num_predict: env.MODEL_OUTPUT_MAX_TOKENS, num_ctx: env.MODEL_CONTEXT_TOKENS },
            keep_alive: "5m"
          }),
        }, deadline, "Ollama structured generation");
        if (!response.ok) throw new Error(`Ollama request failed with ${response.status}: ${await response.text()}`);
        const body = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
        const text = body.message?.content;
        if (!text) throw new Error("Ollama returned no structured response.");
        usage = { inputTokens: body.prompt_eval_count, outputTokens: body.eval_count };
        return text;
      }
    });
    return { data, provider: "ollama", model: env.OLLAMA_MODEL, usage };
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: env.OLLAMA_EMBEDDING_MODEL, input: boundedPrompt(text, "Embedding input"), truncate: false })
    }, deadline, "Ollama embedding");
    if (!response.ok) throw new Error(`Ollama embedding request failed with ${response.status}: ${await response.text()}`);
    const body = await response.json() as { embeddings?: number[][] };
    const vector = body.embeddings?.[0];
    if (!vector?.length) throw new Error("Ollama returned no embedding vector.");
    if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error(`Ollama embedding model returned ${vector.length} dimensions; this database requires ${EMBEDDING_DIMENSIONS}.`);
    return vector;
  }
}

export class GeminiModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini.");
    const deadline = Date.now() + modelRequestTimeoutMs;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const system = boundedPrompt(request.system, "System prompt");
        const prompt = boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt");
        const response = await fetchWithinDeadline(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: `${system}\nReturn only JSON that satisfies the supplied schema.` }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: zodToJsonSchema(request.schema, "response"),
              temperature: 0,
              maxOutputTokens: env.MODEL_OUTPUT_MAX_TOKENS
            }
          })
        }, deadline, "Gemini structured generation");
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
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text: boundedPrompt(text, "Embedding input") }] },
        outputDimensionality: EMBEDDING_DIMENSIONS
      })
    }, deadline, "Gemini embedding");
    if (!response.ok) throw new Error(`Gemini embedding request failed with ${response.status}.`);
    const body = await response.json() as { embedding?: { values?: number[] } };
    const values = body.embedding?.values;
    if (!values?.length) throw new Error("Gemini returned no embedding vector.");
    if (values.length !== EMBEDDING_DIMENSIONS) throw new Error(`Gemini embedding model returned ${values.length} dimensions; this database requires ${EMBEDDING_DIMENSIONS}.`);
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
    const systemMessage = boundedPrompt(`${request.system}\n\nRespond with ONLY a JSON object matching this schema, no markdown fences, no commentary:\n${jsonSchema}`, "System prompt");
    const deadline = Date.now() + modelRequestTimeoutMs;
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const response = await fetchWithinDeadline(`${env.NIM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.NIM_API_KEY}` },
          body: JSON.stringify({
            model: env.NIM_MODEL,
            temperature: 0,
            max_tokens: env.MODEL_OUTPUT_MAX_TOKENS,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt") }
            ]
          })
        }, deadline, "NIM structured generation");
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
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.RETRIEVAL_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [boundedPrompt(text, "Embedding input")], kind: "query" })
    }, deadline, "Retrieval embedding");
    if (!response.ok) throw new Error(`Retrieval service embed request failed with ${response.status}.`);
    const body = await response.json() as { embeddings?: number[][] };
    const vector = body.embeddings?.[0];
    if (!vector?.length) throw new Error("Retrieval service returned no embedding vector.");
    if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error(`Retrieval service returned ${vector.length} dimensions; this database requires ${EMBEDDING_DIMENSIONS}.`);
    return vector;
  }
}

export function getGenerationProvider(): GenerationProvider {
  if (env.MODEL_PROVIDER === "ollama") return new OllamaModelProvider();
  if (env.MODEL_PROVIDER === "gemini") return new GeminiModelProvider();
  if (env.MODEL_PROVIDER === "nim") return new NimModelProvider();
  return new MockModelProvider();
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER === "ollama") return new OllamaEmbeddingProvider();
  if (env.EMBEDDING_PROVIDER === "gemini") return new GeminiModelProvider();
  return env.EMBEDDING_PROVIDER === "service" ? new ServiceEmbeddingProvider() : new MockModelProvider();
}

// The mixed-embedding-space guard (Slice 1, decision #4): every vector written
// or queried is tagged with the model that produced it, so a provider switch
// degrades to "no results" instead of silently ranking incompatible vector
// spaces against each other with cosine similarity.
export function activeEmbeddingModelTag(): string {
  if (env.EMBEDDING_PROVIDER === "ollama") return env.OLLAMA_EMBEDDING_MODEL;
  if (env.EMBEDDING_PROVIDER === "gemini") return env.GEMINI_EMBEDDING_MODEL;
  return env.EMBEDDING_PROVIDER === "service" ? "bge-base-en-v1.5" : "deterministic-mock-v1";
}

/**
 * A non-generative readiness probe for the configured generation provider.
 * It validates reachability, credentials, and the selected model without
 * spending inference tokens or allowing a model request to block health
 * checks indefinitely.
 */
export async function generationProviderHealth(): Promise<ProviderHealth> {
  if (env.MODEL_PROVIDER === "mock") return { status: "ok", provider: "mock", model: "deterministic-mock-v1" };
  if (env.MODEL_PROVIDER === "ollama") return providerHealth("ollama", env.OLLAMA_MODEL, () => checkOllamaModel(env.OLLAMA_MODEL));
  if (env.MODEL_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) return { status: "unavailable", provider: "gemini", model: env.GEMINI_MODEL, reason: "GEMINI_API_KEY is not configured." };
    return providerHealth("gemini", env.GEMINI_MODEL, async () => {
      const deadline = Date.now() + modelRequestTimeoutMs;
      const response = await fetchWithinDeadline(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}?key=${env.GEMINI_API_KEY}`, {}, deadline, "Gemini health check");
      await assertHealthResponse(response, "Gemini");
    });
  }
  if (!env.NIM_API_KEY) return { status: "unavailable", provider: "nim", model: env.NIM_MODEL, reason: "NIM_API_KEY is not configured." };
  return providerHealth("nim", env.NIM_MODEL, async () => {
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.NIM_BASE_URL}/models`, {
      headers: { authorization: `Bearer ${env.NIM_API_KEY}` }
    }, deadline, "NIM health check");
    await assertHealthResponse(response, "NIM");
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    if (payload.data?.length && !payload.data.some((model) => model.id === env.NIM_MODEL)) {
      throw new Error(`NIM model ${env.NIM_MODEL} is not available from this endpoint.`);
    }
  });
}

/** Equivalent readiness probe for the deliberately independent embedding provider. */
export async function embeddingProviderHealth(): Promise<ProviderHealth> {
  if (env.EMBEDDING_PROVIDER === "mock") return { status: "ok", provider: "mock", model: "deterministic-mock-v1" };
  if (env.EMBEDDING_PROVIDER === "ollama") return providerHealth("ollama", env.OLLAMA_EMBEDDING_MODEL, () => checkOllamaModel(env.OLLAMA_EMBEDDING_MODEL));
  if (env.EMBEDDING_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) return { status: "unavailable", provider: "gemini", model: env.GEMINI_EMBEDDING_MODEL, reason: "GEMINI_API_KEY is not configured." };
    return providerHealth("gemini", env.GEMINI_EMBEDDING_MODEL, async () => {
      const deadline = Date.now() + modelRequestTimeoutMs;
      const response = await fetchWithinDeadline(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBEDDING_MODEL}?key=${env.GEMINI_API_KEY}`, {}, deadline, "Gemini embedding health check");
      await assertHealthResponse(response, "Gemini embedding");
    });
  }
  return providerHealth("service", "bge-base-en-v1.5", async () => {
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.RETRIEVAL_SERVICE_URL}/health`, {}, deadline, "Retrieval embedding health check");
    await assertHealthResponse(response, "Retrieval service");
  });
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
