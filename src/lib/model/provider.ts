import { z } from "zod";
import { env } from "@/lib/env";

export interface ModelRequest<T> { system: string; prompt: string; schema: z.ZodType<T>; mock: T }
export interface ModelResult<T> { data: T; provider: "mock" | "gemini"; model: string; usage?: { inputTokens?: number; outputTokens?: number } }
export interface ModelProvider { generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> }

export class MockModelProvider implements ModelProvider {
  async generateStructured<T>(request: ModelRequest<T>): Promise<ModelResult<T>> { return { data: request.schema.parse(request.mock), provider: "mock", model: "deterministic-mock-v1" }; }
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
}

export function getModelProvider(): ModelProvider { return env.MODEL_PROVIDER === "gemini" ? new GeminiModelProvider() : new MockModelProvider(); }
