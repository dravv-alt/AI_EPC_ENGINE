import assert from "node:assert/strict";
import { z } from "zod";

// This is intentionally network-free. It proves that hosted providers receive
// the same timeout, bounded-output, and bounded-input controls as Ollama.
process.env.GEMINI_API_KEY = "verification-key";
process.env.NIM_API_KEY = "verification-key";
process.env.MODEL_TIMEOUT_MS = "1000";
process.env.MODEL_PROMPT_MAX_CHARS = "1000";
process.env.MODEL_OUTPUT_MAX_TOKENS = "123";

async function main() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"ok"}' } }] }), { status: 200 });
  }) as typeof fetch;

  try {
    const { GeminiModelProvider, NimModelProvider } = await import("../src/lib/model/provider");
    const schema = z.object({ answer: z.string() });
    const request = { system: "Return JSON.", prompt: "Say ok.", schema, mock: { answer: "unused" } };

    await new GeminiModelProvider().generateStructured(request);
    const gemini = calls.at(-1);
    assert.ok(gemini?.init?.signal, "Gemini requests must carry an abort signal.");
    const geminiBody = JSON.parse(String(gemini?.init?.body));
    assert.equal(geminiBody.generationConfig.maxOutputTokens, 123, "Gemini output must be capped.");
    assert.equal(geminiBody.generationConfig.responseMimeType, "application/json");

    await new NimModelProvider().generateStructured(request);
    const nim = calls.at(-1);
    assert.ok(nim?.init?.signal, "NIM requests must carry an abort signal.");
    const nimBody = JSON.parse(String(nim?.init?.body));
    assert.equal(nimBody.max_tokens, 123, "NIM output must be capped.");
    assert.equal(nimBody.response_format.type, "json_object");

    await assert.rejects(
      () => new GeminiModelProvider().generateStructured({ ...request, prompt: "x".repeat(1_001) }),
      /input limit/,
      "Gemini must reject oversized prompts before sending a provider request."
    );
    await assert.rejects(
      () => new NimModelProvider().generateStructured({ ...request, prompt: "x".repeat(1_001) }),
      /input limit/,
      "NIM must reject oversized prompts before sending a provider request."
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Hosted provider safety verified: Gemini and NIM use bounded inputs, output caps, and abort deadlines.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
