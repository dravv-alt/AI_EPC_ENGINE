import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env, modelRequestTimeoutMs } from "@/lib/env";
import { evidenceTypeValues, type EvidenceType } from "@/lib/evidence/taxonomy";

const resultSchema = z.object({
  suggestedCategory: z.enum(evidenceTypeValues),
  description: z.string().min(8).max(900),
  confidence: z.number().min(0).max(1),
  metadata: z.array(z.object({ key: z.string().max(60), value: z.string().max(200) })).max(10)
});

export type EvidenceClassification = {
  status: "advisory" | "manual_required";
  provider: string;
  description: string;
  confidence: string | null;
  metadata: Record<string, unknown>;
};

function fallback(file: { name: string; type: string; size: number } | null, selectedCategory: string): EvidenceClassification {
  return {
    status: "manual_required",
    provider: "manual",
    description: file ? `Submitted ${file.name} (${file.type || "unknown format"}, ${file.size} bytes). Human review and the selected category are required.` : "No artifact was attached. Human review and the selected category are required.",
    confidence: null,
    metadata: { selectedCategory, fileName: file?.name ?? null, mediaType: file?.type ?? null, byteSize: file?.size ?? null, analysis: "No vision model available" }
  };
}

export async function classifyEvidenceArtifact(file: File | null, selectedCategory: string): Promise<EvidenceClassification> {
  if (!file || !file.type.startsWith("image/") || env.MODEL_PROVIDER !== "ollama") return fallback(file, selectedCategory);
  try {
    const image = Buffer.from(await file.arrayBuffer()).toString("base64");
    if (image.length > 14 * 1024 * 1024) return fallback(file, selectedCategory);
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(modelRequestTimeoutMs),
      body: JSON.stringify({
        model: env.OLLAMA_MODEL, stream: false, think: false, format: zodToJsonSchema(resultSchema, "evidence_classification"),
        messages: [
          { role: "system", content: "You classify commissioning evidence conservatively. Describe only visible facts. Suggest one controlled category, extract up to ten visible metadata fields, and never certify compliance or approve evidence. Output JSON only." },
          { role: "user", content: `Classify this image. The field engineer selected '${selectedCategory}', which may be retained or overridden only as an advisory suggestion. Allowed categories: ${evidenceTypeValues.join(", ")}.`, images: [image] }
        ], options: { temperature: 0, num_predict: 700, num_ctx: env.MODEL_CONTEXT_TOKENS }, keep_alive: "5m"
      })
    });
    if (!response.ok) return fallback(file, selectedCategory);
    const body = await response.json() as { message?: { content?: string } };
    const raw = body.message?.content?.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    if (!raw) return fallback(file, selectedCategory);
    const parsed = resultSchema.parse(JSON.parse(raw));
    return { status: "advisory", provider: `ollama:${env.OLLAMA_MODEL}`, description: parsed.description, confidence: String(parsed.confidence), metadata: { selectedCategory, suggestedCategory: parsed.suggestedCategory as EvidenceType, metadata: Object.fromEntries(parsed.metadata.map((item) => [item.key, item.value])), authority: "advisory_only" } };
  } catch {
    return fallback(file, selectedCategory);
  }
}
