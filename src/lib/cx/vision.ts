import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env, modelRequestTimeoutMs } from "@/lib/env";

/**
 * Phase 5: Ollama Vision — Gauge Photo Analysis
 *
 * Sends a field photograph (base64 PNG/JPEG) to the configured local model and
 * extracts a structured reading. The result is ADVISORY only — it is stored
 * as `needs_human_review` and must be reviewed/confirmed by a field engineer
 * before it can become part of an approved test record.
 *
 * Architecture note (Pramana Pattern 1 + 5):
 * - AI output enters the system as `needs_human_review` — never auto-approved.
 * - The response includes `confidence` so engineers can triage quickly.
 * - `rawDescription` preserves the model's full narrative for audit.
 */

const visionResultSchema = z.object({
  /** The numeric value read from the gauge, if identifiable. */
  numericValue: z.number().nullable(),
  /** The unit displayed on the gauge (e.g. "kPa", "°C", "rpm"). */
  unit: z.string().max(40).nullable(),
  /** true/false if the photo shows a boolean indicator (e.g. lamp on/off). */
  booleanValue: z.boolean().nullable(),
  /** Confidence: high | medium | low. Always treat low as needs_human_review. */
  confidence: z.enum(["high", "medium", "low"]),
  /**
   * The model's full natural-language description of what it saw.
   * Preserved verbatim in the audit trail.
   */
  rawDescription: z.string().max(2000),
  /**
   * Any reason the model couldn't extract a value
   * (e.g. "Image is blurry", "Gauge face is partially occluded").
   */
  extractionFailureReason: z.string().max(500).nullable(),
});

export type VisionResult = z.infer<typeof visionResultSchema>;

/** Returned to the API caller as a structured advisory reading. */
export interface GaugeAnalysis {
  /** The raw structured result from the vision model. */
  result: VisionResult;
  /** The local Ollama model used. */
  model: string;
  /** Always "advisory" — this reading must be confirmed by a human. */
  advisory: true;
  /**
   * Suggested cx verdict. The caller MUST NOT use this as authoritative —
   * it is a starting point for human review.
   */
  suggestedVerdict: "proposed_pass" | "proposed_fail" | "needs_human_review";
}

const SYSTEM_PROMPT = `You are a field instrumentation reading assistant for commissioning engineers on industrial EPC projects.
Your job is to extract the DISPLAYED VALUE from a photograph of a physical instrument or indicator.

Rules:
1. Only report what is CLEARLY VISIBLE in the image. Never guess or extrapolate.
2. If the gauge is a numeric instrument (pressure, flow, temperature, voltage, etc.), extract numericValue and unit.
3. If the instrument is a boolean indicator (lamp, switch, valve open/closed), set booleanValue.
4. If you cannot read the value clearly, set confidence to "low" and explain in extractionFailureReason.
5. NEVER certify, approve, or determine compliance — that is for the human engineer.
6. Output JSON only matching the provided schema.`;

function parseVisionJson(text: string) {
  // Some local models wrap otherwise valid structured output in a Markdown
  // fence despite the supplied JSON schema. Accept that transport wrapper but
  // keep Zod validation below as the authority for the actual payload.
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

/**
 * Analyze a gauge photograph using the configured local Ollama model.
 *
 * @param imageBase64 - Raw base64-encoded image bytes (no data URL prefix).
 * @param mimeType    - The image MIME type, e.g. "image/jpeg" or "image/png".
 * @param context     - Optional free-text context (step instruction, nominal value)
 *                      to help the model identify the relevant gauge.
 */
export async function analyzeGaugePhoto(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  context?: string
): Promise<GaugeAnalysis> {
  if (imageBase64.length > 14 * 1024 * 1024) throw new Error("Encoded image exceeds the local vision input limit.");
  const prompt = context
    ? `Context for this reading: ${context.slice(0, 4_000)}\n\nExtract the displayed value from the instrument in the photograph.`
    : "Extract the displayed value from the instrument in the photograph.";
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        stream: false,
        think: false,
        format: zodToJsonSchema(visionResultSchema, "vision_result"),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt, images: [imageBase64], mimeType },
        ],
        options: { temperature: 0, num_predict: env.MODEL_OUTPUT_MAX_TOKENS, num_ctx: env.MODEL_CONTEXT_TOKENS },
        keep_alive: "5m",
      }),
      signal: AbortSignal.timeout(modelRequestTimeoutMs),
    });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama vision request failed with HTTP ${response.status}: ${body}`);
  }

  const body = await response.json() as { message?: { content?: string } };
  const text = body.message?.content;
  if (!text) throw new Error("Ollama vision returned no content.");

  const result = visionResultSchema.parse(parseVisionJson(text));

  // Determine a conservative suggested verdict:
  // - low confidence → always needs human review
  // - high/medium with a value → proposed_pass (nominal check is for the human)
  // - no value extracted → needs human review
  const suggestedVerdict: GaugeAnalysis["suggestedVerdict"] =
    result.confidence === "low" || result.extractionFailureReason
      ? "needs_human_review"
      : result.numericValue !== null || result.booleanValue !== null
      ? "needs_human_review" // Still advisory — humans must confirm against nominal
      : "needs_human_review";

  return {
    result,
    model: env.OLLAMA_MODEL,
    advisory: true,
    suggestedVerdict,
  };
}
