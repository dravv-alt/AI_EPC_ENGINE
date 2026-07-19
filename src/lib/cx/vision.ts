import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Phase 5: Gemini Vision — Gauge Photo Analysis
 *
 * Sends a field photograph (base64 PNG/JPEG) to Gemini's vision model and
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
  /** The Gemini model used. */
  model: string;
  /** Always "advisory" — this reading must be confirmed by a human. */
  advisory: true;
  /**
   * Suggested cx verdict. The caller MUST NOT use this as authoritative —
   * it is a starting point for human review.
   */
  suggestedVerdict: "proposed_pass" | "proposed_fail" | "needs_human_review";
}

const VISION_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a field instrumentation reading assistant for commissioning engineers on industrial EPC projects.
Your job is to extract the DISPLAYED VALUE from a photograph of a physical instrument or indicator.

Rules:
1. Only report what is CLEARLY VISIBLE in the image. Never guess or extrapolate.
2. If the gauge is a numeric instrument (pressure, flow, temperature, voltage, etc.), extract numericValue and unit.
3. If the instrument is a boolean indicator (lamp, switch, valve open/closed), set booleanValue.
4. If you cannot read the value clearly, set confidence to "low" and explain in extractionFailureReason.
5. NEVER certify, approve, or determine compliance — that is for the human engineer.
6. Output JSON only matching the provided schema.`;

/**
 * Analyze a gauge photograph using Gemini Vision.
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
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for Gemini Vision analysis.");
  }

  const userParts: unknown[] = [
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    {
      text: context
        ? `Context for this reading: ${context}\n\nExtract the displayed value from the instrument in the photograph.`
        : "Extract the displayed value from the instrument in the photograph.",
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              numericValue: { type: "NUMBER", nullable: true },
              unit: { type: "STRING", nullable: true },
              booleanValue: { type: "BOOLEAN", nullable: true },
              confidence: { type: "STRING", enum: ["high", "medium", "low"] },
              rawDescription: { type: "STRING" },
              extractionFailureReason: { type: "STRING", nullable: true },
            },
            required: ["confidence", "rawDescription"],
          },
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini Vision request failed with HTTP ${response.status}: ${body}`);
  }

  const body = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini Vision returned no content.");

  const result = visionResultSchema.parse(JSON.parse(text));

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
    model: VISION_MODEL,
    advisory: true,
    suggestedVerdict,
  };
}
