import { z } from "zod";
import { env } from "@/lib/env";
import { EMBEDDING_DIMENSIONS, OllamaEmbeddingProvider, OllamaModelProvider } from "@/lib/model/provider";

async function main() {
  if (env.MODEL_PROVIDER !== "ollama" || env.EMBEDDING_PROVIDER !== "ollama") {
    throw new Error("Run this check with MODEL_PROVIDER=ollama and EMBEDDING_PROVIDER=ollama.");
  }
  const started = performance.now();
  const generation = await new OllamaModelProvider().generateStructured({
    system: "Answer concisely and obey the JSON schema.",
    prompt: "Return a short acknowledgement that local inference is working.",
    schema: z.object({ acknowledgement: z.string().min(1).max(120) }),
    mock: { acknowledgement: "unused" }
  });
  const embedding = await new OllamaEmbeddingProvider().embed("Pramana local embedding verification.");
  const elapsedMs = Math.round(performance.now() - started);
  if (embedding.length !== EMBEDDING_DIMENSIONS) throw new Error(`Expected ${EMBEDDING_DIMENSIONS} embedding dimensions, received ${embedding.length}.`);
  if (elapsedMs > env.OLLAMA_TIMEOUT_MS * 2) throw new Error(`Ollama verification exceeded the bounded request budget (${elapsedMs} ms).`);
  console.log(`Ollama verified: ${generation.model}; ${embedding.length}-dim embedding; ${elapsedMs} ms.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
