import { createHash } from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env, modelRequestTimeoutMs } from "@/lib/env";
import { waitForTokenBudget } from "@/lib/redis/rate-limit";

export const EMBEDDING_DIMENSIONS = 768;

export interface ModelRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  mock: T;
  /** Optional per-call overrides. Omitted by every pre-existing call site. */
  limits?: { outputMaxTokens?: number; contextTokens?: number; timeoutMs?: number };
  /**
   * Optional hand-written, compact schema description for providers that
   * embed the schema as TEXT in the prompt (NIM, Groq — see
   * requestStructuredJson callers below). When omitted, those providers fall
   * back to auto-generating one via zodToJsonSchema, as before. Ollama and
   * Gemini bind `schema` natively (structured-output APIs) and never read
   * this field. Added for the copilot's own step schema (Opus consult,
   * 2026-08-24): the auto-generated $ref/definitions JSON dump cost real
   * tokens on every call and, empirically, a terse hand-written spec is also
   * followed more reliably by a small/hosted model than a verbose schema
   * dump. Every other existing call site omits this and is unaffected.
   */
  schemaDescription?: string;
}
export interface ModelResult<T> { data: T; provider: "mock" | "ollama" | "gemini" | "nim" | "groq" | "cerebras"; model: string; usage?: { inputTokens?: number; outputTokens?: number } }
export type GenerationProviderName = ModelResult<unknown>["provider"];
export type EmbeddingInputKind = "query" | "passage";

export interface GenerationProvider {
  generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>>;
}
export interface EmbeddingProvider {
  embed(text: string, kind?: EmbeddingInputKind): Promise<number[]>;
  embedMany?(texts: string[], kind?: EmbeddingInputKind): Promise<number[][]>;
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
  provider: "mock" | "ollama" | "gemini" | "nim" | "groq" | "cerebras" | "service" | "pinecone";
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

/**
 * Thrown by a provider's `callModel` when the PROVIDER rejected the model's
 * output format before we ever got text to parse (e.g. Groq's json_object
 * validator: the model wrote plain prose, or tried its own native
 * tool-calling syntax instead of the prompted JSON schema — both observed
 * live with openai/gpt-oss-20b). Distinguished from a generic thrown error
 * (network failure, auth, rate limit/429, 5xx) so the repair-retry below
 * only fires for genuine content-quality issues — retrying a 429 immediately
 * would just burn more of an already-exhausted token budget for no benefit.
 */
export class RetryableModelOutputError extends Error {}

// Error codes an OpenAI-compatible endpoint (NIM, Groq) returns when it
// rejected the MODEL'S output format, not the request itself — retryable.
// Both observed live on Groq with openai/gpt-oss-20b: "output_parse_failed"
// (wrote plain prose instead of JSON) and "tool_use_failed" (emitted its own
// native tool-call syntax — a natively tool-use-trained model sometimes
// defaults to that instead of the prompted JSON schema, even though we never
// declare a `tools` param). Checked defensively on NIM too since it shares
// the same error shape, even though not observed there yet.
const OPENAI_COMPATIBLE_RETRYABLE_OUTPUT_CODES = new Set(["output_parse_failed", "tool_use_failed"]);

function parseRetryableOutputCode(bodyText: string): string | undefined {
  try {
    return (JSON.parse(bodyText) as { error?: { code?: string } })?.error?.code;
  } catch {
    return undefined;
  }
}

// Shared repair-retry loop: call the model once, try to parse; on failure,
// call it again with the validation error appended to the prompt; fail hard
// only after the second attempt. Keeps a single sloppy token from failing an
// entire job outright, for any real (non-mock) provider. Covers two distinct
// failure points: the model returned text that didn't parse (first try/catch
// only, pre-existing), and the provider rejected the request outright before
// any text came back (outer try/catch — only for RetryableModelOutputError).
export async function requestStructuredJson<T>(options: {
  schema: z.ZodType<T>;
  callModel: (promptSuffix: string) => Promise<string>;
}): Promise<T> {
  let first: string;
  try {
    first = await options.callModel("");
  } catch (error) {
    if (!(error instanceof RetryableModelOutputError)) throw error;
    return repairRetry(options, error.message);
  }
  try {
    return parseStructuredResponse(first, options.schema);
  } catch (firstError) {
    const reason = firstError instanceof Error ? firstError.message : String(firstError);
    return repairRetry(options, reason);
  }
}

async function repairRetry<T>(options: { schema: z.ZodType<T>; callModel: (promptSuffix: string) => Promise<string> }, reason: string): Promise<T> {
  try {
    const second = await options.callModel(`\n\nYour previous response could not be completed (${reason}). Respond again with ONLY a plain JSON object matching the required schema — no markdown fences, no commentary, no function/tool-call syntax.`);
    return parseStructuredResponse(second, options.schema);
  } catch (secondError) {
    const secondReason = secondError instanceof Error ? secondError.message : String(secondError);
    throw new Error(`Model returned invalid structured output after a repair retry: ${secondReason}`);
  }
}

// Rough chars/4 estimate — no real tokenizer dependency for this; only used
// to pace requests against MODEL_TOKENS_PER_MINUTE, not for billing/limits
// enforcement, so an approximation is fine (and matches the ballpark a
// provider's own error message reports, e.g. Groq's "Requested N tokens").
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function tokenBudgetFor(provider: GenerationProviderName) {
  return env.MODEL_PROVIDER === provider || env.COPILOT_MODEL_PROVIDER === provider
    ? env.MODEL_TOKENS_PER_MINUTE
    : undefined;
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
    const deadline = Date.now() + (request.limits?.timeoutMs ?? modelRequestTimeoutMs);
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
            options: { temperature: 0, num_predict: request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS, num_ctx: request.limits?.contextTokens ?? env.MODEL_CONTEXT_TOKENS },
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
    const deadline = Date.now() + (request.limits?.timeoutMs ?? modelRequestTimeoutMs);
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
              maxOutputTokens: request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS
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
    const jsonSchema = request.schemaDescription ?? JSON.stringify(zodToJsonSchema(request.schema, "response"));
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const systemMessage = boundedPrompt(`${request.system}\n\nRespond with ONLY a JSON object matching this schema, no markdown fences, no commentary:\n${jsonSchema}`, "System prompt");
    const deadline = Date.now() + (request.limits?.timeoutMs ?? modelRequestTimeoutMs);
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const userContent = boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt");
        // Scoped by the literal provider name ("nim"), not env.MODEL_PROVIDER
        // — this class can be instantiated directly regardless of which
        // provider is currently active (verify-provider-safety.ts does
        // exactly that), and scoping by the active config caused it to wait
        // on a DIFFERENT provider's exhausted budget (found live: this
        // script hung ~60s waiting on Groq's budget while testing NIM).
        // MODEL_TOKENS_PER_MINUTE is only meaningful for whichever provider
        // is actually active; a direct-instantiation test naturally gets an
        // unused, always-fresh "nim" counter instead.
        await waitForTokenBudget("model-provider:nim", estimateTokens(systemMessage) + estimateTokens(userContent) + (request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS), tokenBudgetFor("nim"));
        const response = await fetchWithinDeadline(`${env.NIM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.NIM_API_KEY}` },
          body: JSON.stringify({
            model: env.NIM_MODEL,
            temperature: 0,
            max_tokens: request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS,
            response_format: { type: "json_object" },
            reasoning_effort: "low",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userContent }
            ]
          })
        }, deadline, "NIM structured generation");
        if (!response.ok) {
          const bodyText = await response.text();
          const code = parseRetryableOutputCode(bodyText);
          if (response.status === 400 && code && OPENAI_COMPATIBLE_RETRYABLE_OUTPUT_CODES.has(code)) {
            throw new RetryableModelOutputError(`NIM rejected the model's output format (${code}): ${bodyText}`);
          }
          throw new Error(`NIM request failed with ${response.status}: ${bodyText}`);
        }
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

// Groq: same OpenAI-compatible chat-completions shape as NIM above, added at
// the user's request after `meta/llama-3.1-8b-instruct` on NIM proved
// unreliable at tool-use/structured output for anything but very directive
// phrasing. `reasoning_effort: "low"` is Groq-specific and only meaningful
// for reasoning-style models (gpt-oss); it keeps chain-of-thought token
// spend down so `max_tokens` is spent on the actual JSON answer rather than
// getting truncated mid-response (the exact failure mode observed earlier
// this build with a different reasoning model on NIM, where `content` came
// back null with `finish_reason: "length"`). Harmless no-op for a
// non-reasoning model if this provider is ever pointed at one.
export class GroqModelProvider implements GenerationProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is required when MODEL_PROVIDER=groq.");
    const jsonSchema = request.schemaDescription ?? JSON.stringify(zodToJsonSchema(request.schema, "response"));
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const systemMessage = boundedPrompt(`${request.system}\n\nRespond with ONLY a JSON object matching this schema, no markdown fences, no commentary:\n${jsonSchema}`, "System prompt");
    const deadline = Date.now() + (request.limits?.timeoutMs ?? modelRequestTimeoutMs);
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const userContent = boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt");
        // Waits for real per-minute token budget room (MODEL_TOKENS_PER_MINUTE)
        // instead of firing and hoping — see rate-limit.ts's waitForTokenBudget.
        // Scoped by the literal provider name ("groq"), not env.MODEL_PROVIDER
        // — see the matching comment in NimModelProvider for why.
        await waitForTokenBudget("model-provider:groq", estimateTokens(systemMessage) + estimateTokens(userContent) + (request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS), tokenBudgetFor("groq"));
        const response = await fetchWithinDeadline(`${env.GROQ_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
          body: JSON.stringify({
            model: env.GROQ_MODEL,
            temperature: 0,
            max_tokens: request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userContent }
            ]
          })
        }, deadline, "Groq structured generation");
        if (!response.ok) {
          const bodyText = await response.text();
          const code = parseRetryableOutputCode(bodyText);
          if (response.status === 400 && code && OPENAI_COMPATIBLE_RETRYABLE_OUTPUT_CODES.has(code)) {
            throw new RetryableModelOutputError(`Groq rejected the model's output format (${code}): ${bodyText}`);
          }
          throw new Error(`Groq request failed with ${response.status}: ${bodyText}`);
        }
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = body.choices?.[0]?.message?.content;
        if (!text) throw new Error("Groq returned no structured response.");
        usage = { inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
        return text;
      }
    });
    return { data, provider: "groq", model: env.GROQ_MODEL, usage };
  }
}

// Cerebras: OpenAI-compatible chat completions. Keep the request model-generic
// because dedicated Gemma endpoints do not accept GPT-OSS-only reasoning
// parameters. CEREBRAS_MODEL is the organization-specific dedicated endpoint
// identifier when Gemma 4 31B is provisioned.
export class CerebrasModelProvider implements GenerationProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.CEREBRAS_API_KEY) throw new Error("CEREBRAS_API_KEY is required when MODEL_PROVIDER=cerebras.");
    const jsonSchema = request.schemaDescription ?? JSON.stringify(zodToJsonSchema(request.schema, "response"));
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    const systemMessage = boundedPrompt(`${request.system}\n\nRespond with ONLY a JSON object matching this schema, no markdown fences, no commentary:\n${jsonSchema}`, "System prompt");
    const deadline = Date.now() + (request.limits?.timeoutMs ?? modelRequestTimeoutMs);
    const data = await requestStructuredJson({
      schema: request.schema,
      callModel: async (promptSuffix) => {
        const userContent = boundedPrompt(`${request.prompt}${promptSuffix}`, "Model prompt");
        await waitForTokenBudget("model-provider:cerebras", estimateTokens(systemMessage) + estimateTokens(userContent) + (request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS), tokenBudgetFor("cerebras"));
        const response = await fetchWithinDeadline(`${env.CEREBRAS_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.CEREBRAS_API_KEY}` },
          body: JSON.stringify({
            model: env.CEREBRAS_MODEL,
            temperature: 0,
            max_tokens: request.limits?.outputMaxTokens ?? env.MODEL_OUTPUT_MAX_TOKENS,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: userContent }
            ]
          })
        }, deadline, "Cerebras structured generation");
        if (!response.ok) {
          const bodyText = await response.text();
          const code = parseRetryableOutputCode(bodyText);
          if (response.status === 400 && code && OPENAI_COMPATIBLE_RETRYABLE_OUTPUT_CODES.has(code)) {
            throw new RetryableModelOutputError(`Cerebras rejected the model's output format (${code}): ${bodyText}`);
          }
          throw new Error(`Cerebras request failed with ${response.status}: ${bodyText}`);
        }
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = body.choices?.[0]?.message?.content;
        if (!text) throw new Error("Cerebras returned no structured response.");
        usage = { inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens };
        return text;
      }
    });
    return { data, provider: "cerebras", model: env.CEREBRAS_MODEL, usage };
  }
}

// Embeds via the stateless Python retrieval service (Slice 1). Batches are not
// used here — this method embeds a single query string at request time; the
// worker backfill loop batches separately.
export class ServiceEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string, kind: EmbeddingInputKind = "passage"): Promise<number[]> {
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.RETRIEVAL_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [boundedPrompt(text, "Embedding input")], kind })
    }, deadline, "Retrieval embedding");
    if (!response.ok) throw new Error(`Retrieval service embed request failed with ${response.status}.`);
    const body = await response.json() as { embeddings?: number[][] };
    const vector = body.embeddings?.[0];
    if (!vector?.length) throw new Error("Retrieval service returned no embedding vector.");
    if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error(`Retrieval service returned ${vector.length} dimensions; this database requires ${EMBEDDING_DIMENSIONS}.`);
    return vector;
  }
}

export class PineconeEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string, kind: EmbeddingInputKind = "passage"): Promise<number[]> {
    const vectors = await this.embedMany([text], kind);
    return vectors[0]!;
  }

  async embedMany(texts: string[], kind: EmbeddingInputKind = "passage"): Promise<number[][]> {
    if (!texts.length) return [];
    if (!env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY is required when EMBEDDING_PROVIDER=pinecone.");
    if (env.PINECONE_EMBEDDING_DIMENSIONS !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Pinecone is configured for ${env.PINECONE_EMBEDDING_DIMENSIONS} dimensions; this database requires ${EMBEDDING_DIMENSIONS}.`);
    }
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.PINECONE_BASE_URL}/embed`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Api-Key": env.PINECONE_API_KEY,
        "X-Pinecone-Api-Version": env.PINECONE_API_VERSION
      },
      body: JSON.stringify({
        model: env.PINECONE_EMBEDDING_MODEL,
        inputs: texts.map((text) => ({ text: boundedPrompt(text, "Embedding input") })),
        parameters: {
          input_type: kind,
          truncate: "END",
          dimension: EMBEDDING_DIMENSIONS
        }
      })
    }, deadline, "Pinecone embedding");
    if (!response.ok) throw new Error(`Pinecone embedding request failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = await response.json() as { data?: Array<{ values?: number[] }> };
    const vectors = body.data?.map((item) => item.values ?? []) ?? [];
    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Pinecone returned an invalid embedding batch; expected ${texts.length} vectors of ${EMBEDDING_DIMENSIONS} dimensions.`);
    }
    return vectors;
  }
}

export function getGenerationProvider(provider: GenerationProviderName = env.MODEL_PROVIDER): GenerationProvider {
  if (provider === "ollama") return new OllamaModelProvider();
  if (provider === "gemini") return new GeminiModelProvider();
  if (provider === "nim") return new NimModelProvider();
  if (provider === "groq") return new GroqModelProvider();
  if (provider === "cerebras") return new CerebrasModelProvider();
  return new MockModelProvider();
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER === "ollama") return new OllamaEmbeddingProvider();
  if (env.EMBEDDING_PROVIDER === "gemini") return new GeminiModelProvider();
  if (env.EMBEDDING_PROVIDER === "pinecone") return new PineconeEmbeddingProvider();
  return env.EMBEDDING_PROVIDER === "service" ? new ServiceEmbeddingProvider() : new MockModelProvider();
}

// The mixed-embedding-space guard (Slice 1, decision #4): every vector written
// or queried is tagged with the model that produced it, so a provider switch
// degrades to "no results" instead of silently ranking incompatible vector
// spaces against each other with cosine similarity.
export function activeEmbeddingModelTag(): string {
  if (env.EMBEDDING_PROVIDER === "ollama") return env.OLLAMA_EMBEDDING_MODEL;
  if (env.EMBEDDING_PROVIDER === "gemini") return env.GEMINI_EMBEDDING_MODEL;
  if (env.EMBEDDING_PROVIDER === "pinecone") return `pinecone:${env.PINECONE_EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}`;
  return env.EMBEDDING_PROVIDER === "service" ? "bge-base-en-v1.5" : "deterministic-mock-v1";
}

/**
 * A non-generative readiness probe for the configured generation provider.
 * It validates reachability, credentials, and the selected model without
 * spending inference tokens or allowing a model request to block health
 * checks indefinitely.
 */
export async function generationProviderHealth(provider: GenerationProviderName = env.MODEL_PROVIDER): Promise<ProviderHealth> {
  if (provider === "mock") return { status: "ok", provider: "mock", model: "deterministic-mock-v1" };
  if (provider === "ollama") return providerHealth("ollama", env.OLLAMA_MODEL, () => checkOllamaModel(env.OLLAMA_MODEL));
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) return { status: "unavailable", provider: "gemini", model: env.GEMINI_MODEL, reason: "GEMINI_API_KEY is not configured." };
    return providerHealth("gemini", env.GEMINI_MODEL, async () => {
      const deadline = Date.now() + modelRequestTimeoutMs;
      const response = await fetchWithinDeadline(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}?key=${env.GEMINI_API_KEY}`, {}, deadline, "Gemini health check");
      await assertHealthResponse(response, "Gemini");
    });
  }
  if (provider === "nim") {
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
  if (provider === "groq") {
    if (!env.GROQ_API_KEY) return { status: "unavailable", provider: "groq", model: env.GROQ_MODEL, reason: "GROQ_API_KEY is not configured." };
    return providerHealth("groq", env.GROQ_MODEL, async () => {
      const deadline = Date.now() + modelRequestTimeoutMs;
      const response = await fetchWithinDeadline(`${env.GROQ_BASE_URL}/models`, {
        headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }
      }, deadline, "Groq health check");
      await assertHealthResponse(response, "Groq");
      const payload = await response.json() as { data?: Array<{ id?: string }> };
      if (payload.data?.length && !payload.data.some((model) => model.id === env.GROQ_MODEL)) {
        throw new Error(`Groq model ${env.GROQ_MODEL} is not available from this endpoint.`);
      }
    });
  }
  if (!env.CEREBRAS_API_KEY) return { status: "unavailable", provider: "cerebras", model: env.CEREBRAS_MODEL, reason: "CEREBRAS_API_KEY is not configured." };
  return providerHealth("cerebras", env.CEREBRAS_MODEL, async () => {
    const deadline = Date.now() + modelRequestTimeoutMs;
    const response = await fetchWithinDeadline(`${env.CEREBRAS_BASE_URL}/models`, {
      headers: { authorization: `Bearer ${env.CEREBRAS_API_KEY}` }
    }, deadline, "Cerebras health check");
    await assertHealthResponse(response, "Cerebras");
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    if (payload.data?.length && !payload.data.some((model) => model.id === env.CEREBRAS_MODEL)) {
      throw new Error(`Cerebras model ${env.CEREBRAS_MODEL} is not available from this endpoint.`);
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
  if (env.EMBEDDING_PROVIDER === "pinecone") {
    if (!env.PINECONE_API_KEY) return { status: "unavailable", provider: "pinecone", model: env.PINECONE_EMBEDDING_MODEL, reason: "PINECONE_API_KEY is not configured." };
    const pineconeApiKey = env.PINECONE_API_KEY;
    return providerHealth("pinecone", env.PINECONE_EMBEDDING_MODEL, async () => {
      const deadline = Date.now() + modelRequestTimeoutMs;
      const response = await fetchWithinDeadline(`${env.PINECONE_BASE_URL}/models/${encodeURIComponent(env.PINECONE_EMBEDDING_MODEL)}`, {
        headers: { "Api-Key": pineconeApiKey, "X-Pinecone-Api-Version": env.PINECONE_API_VERSION }
      }, deadline, "Pinecone embedding health check");
      await assertHealthResponse(response, "Pinecone embedding");
      const payload = await response.json() as { model?: string; supported_dimensions?: number[] };
      if (payload.model && payload.model !== env.PINECONE_EMBEDDING_MODEL) throw new Error(`Pinecone returned model ${payload.model}.`);
      if (payload.supported_dimensions?.length && !payload.supported_dimensions.includes(EMBEDDING_DIMENSIONS)) {
        throw new Error(`Pinecone model ${env.PINECONE_EMBEDDING_MODEL} does not support ${EMBEDDING_DIMENSIONS} dimensions.`);
      }
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
    embed: (text, kind) => embedding.embed(text, kind),
    embedMany: embedding.embedMany ? (texts, kind) => embedding.embedMany!(texts, kind) : undefined
  };
}
