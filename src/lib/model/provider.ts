import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

export const EMBEDDING_DIMENSIONS = 768;

export interface ModelRequest<T> { system: string; prompt: string; schema: z.ZodType<T>; mock: T }
export interface ModelResult<T> { data: T; provider: "mock" | "gemini"; model: string; usage?: { inputTokens?: number; outputTokens?: number } }
export interface ModelProvider {
  generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>>;
  embed(text: string): Promise<number[]>;
}

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

export class MockModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> { return { data: request.schema.parse(request.mock), provider: "mock", model: "deterministic-mock-v1" }; }
  async embed(text: string): Promise<number[]> { return deterministicEmbedding(text); }
}

export class GeminiModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> {
    if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini.");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system_instruction: { parts: [{ text: request.system }] }, contents: [{ role: "user", parts: [{ text: request.prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
    if (!response.ok) throw new Error(`Gemini request failed with ${response.status}.`);
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no structured response.");
    return { data: request.schema.parse(JSON.parse(text)), provider: "gemini", model: env.GEMINI_MODEL, usage: { inputTokens: body.usageMetadata?.promptTokenCount, outputTokens: body.usageMetadata?.candidatesTokenCount } };
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

export function getModelProvider(): ModelProvider { return env.MODEL_PROVIDER === "gemini" ? new GeminiModelProvider() : new MockModelProvider(); }
