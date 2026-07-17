export type StepInput = { modality: "numeric" | "boolean" | "narrative"; nominalValue?: number | null; tolerance?: number | null; expectedBoolean?: boolean | null };
export type StepReading = { value?: number | null; boolean?: boolean | null; text?: string | null };
export type CxVerdict = "proposed_pass" | "proposed_fail" | "needs_human_review";

/** Pure, LLM-free acceptance boundary. Narrative criteria always require a human. */
export function evaluateStep(step: StepInput, reading: StepReading): CxVerdict {
  if (step.modality === "narrative") return "needs_human_review";
  if (step.modality === "boolean") return reading.boolean === step.expectedBoolean ? "proposed_pass" : "proposed_fail";
  if (reading.value == null || step.nominalValue == null || step.tolerance == null) throw new Error("Numeric step requires reading, nominal value, and tolerance.");
  return Math.abs(reading.value - step.nominalValue) <= step.tolerance ? "proposed_pass" : "proposed_fail";
}

export function aggregateVerdicts(verdicts: CxVerdict[]): CxVerdict {
  if (verdicts.includes("proposed_fail")) return "proposed_fail";
  if (verdicts.includes("needs_human_review")) return "needs_human_review";
  return "proposed_pass";
}
