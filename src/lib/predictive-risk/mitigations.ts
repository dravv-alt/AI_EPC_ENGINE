import { z } from "zod";
import { getGenerationProvider } from "@/lib/model/provider";
import type { RiskSignalType } from "@/lib/predictive-risk/clients";

export interface MitigationOption { id: string; label: string; description: string }

// The 8 static, pre-approved mitigation proposals. These are the mock payload
// for MODEL_PROVIDER=mock (so verify-risk-http.ts keeps passing unmodified
// offline) and the fallback for any real-provider failure — a mitigation
// generation failure must never break the poll loop.
export function staticMitigations(type: RiskSignalType): MitigationOption[] {
  const options: Record<RiskSignalType, MitigationOption[]> = {
    procurement_status: [
      { id: "expedite-vendor", label: "Review vendor expediting", description: "A planner may confirm expediting feasibility and then model the accepted constraint separately." },
      { id: "alternate-source", label: "Evaluate an alternate source", description: "Procurement may assess an approved alternative supplier without the risk engine selecting one." }
    ],
    equipment_lead_time: [
      { id: "split-delivery", label: "Evaluate split delivery", description: "The delivery owner may assess whether a controlled partial shipment protects the critical task." },
      { id: "resequence", label: "Review task resequencing", description: "A scheduler may model a reviewed precedence change through a separate deterministic solve." }
    ],
    workforce_availability: [
      { id: "reallocate-crew", label: "Review crew reallocation", description: "The planner may assess moving an available crew and explicitly update reviewed resource constraints." },
      { id: "approved-subcontract", label: "Evaluate approved subcontract support", description: "The project team may assess qualified support; this proposal does not appoint or schedule anyone." }
    ],
    weather_forecast: [
      { id: "weather-window", label: "Review a protected weather window", description: "The planner may set a reviewed work window before invoking the deterministic solver." },
      { id: "indoor-resequence", label: "Evaluate indoor work resequencing", description: "The scheduler may assess moving unaffected indoor tasks without this engine changing dates." }
    ]
  };
  return options[type];
}

const mitigationSchema = z.object({
  options: z.array(z.object({
    id: z.string(),
    label: z.string().max(120),
    description: z.string().max(600)
  })).min(1).max(3)
});

export interface MitigationContext {
  type: RiskSignalType;
  taskName: string;
  vendor?: string | null;
  probability: number;
  estimatedDelayHours: number;
  isCritical: boolean;
  deadlineBreach: boolean;
}

export interface MitigationGenerationResult {
  options: MitigationOption[];
  provider: "mock" | "ollama" | "gemini" | "nim";
  model: string;
}

// Generates contextual mitigation proposals via the configured generation
// provider. These are advisory only: the engine never applies them, and no
// schedule date or resource assignment is ever moved by this call. On any
// failure (network, schema mismatch, anything) this falls back to the static
// options so a mitigation-generation failure never breaks the poll loop.
export async function generateMitigations(context: MitigationContext): Promise<MitigationGenerationResult> {
  const fallback = staticMitigations(context.type);
  try {
    const system = "You are an advisory assistant for a construction schedule risk engine. You propose short, professional mitigation options for a human planner to review. You never assign resources, change dates, or claim authority — every option must be phrased as something a human 'may review' or 'may evaluate'. Respond only with the structured JSON requested.";
    const prompt = [
      `Signal type: ${context.type}`,
      `Task: ${context.taskName}`,
      context.vendor ? `Vendor: ${context.vendor}` : null,
      `Probability of delay: ${context.probability}`,
      `Estimated delay hours: ${context.estimatedDelayHours}`,
      `Task is on the critical path: ${context.isCritical}`,
      `Task deadline would be breached: ${context.deadlineBreach}`,
      "Propose 2-3 mitigation options a human planner could review. Each option needs a short id (kebab-case), a label (<=120 chars), and a description (<=600 chars) naming the specific task (and vendor, if given) without instructing anyone to act unilaterally."
    ].filter(Boolean).join("\n");
    const result = await getGenerationProvider().generateStructured({
      system,
      prompt,
      schema: mitigationSchema,
      mock: { options: fallback }
    });
    return { options: result.data.options, provider: result.provider, model: result.model };
  } catch {
    return { options: fallback, provider: "mock", model: "static-fallback-v1" };
  }
}
