import { z } from "zod";
import { compareCompliance, type ComparisonResult, type ComplianceVerdict, type RequirementInput } from "@/lib/compliance/compare";
import type { SemanticCitation } from "@/lib/knowledge/query";
import { getGenerationProvider } from "@/lib/model/provider";

// Decision #7 (agentFixingPlan.md): the LLM owns the compliance verdict in
// real mode. compareCompliance is demoted to mock-supplier + recorded
// cross-check — it is ALWAYS computed first, unconditionally, and its result
// is what MockModelProvider echoes back verbatim under MODEL_PROVIDER=mock,
// which is what keeps verify:compliance-http byte-identical offline.
export const assessmentSchema = z.object({
  verdict: z.enum(["conforms", "deterministic_flag", "possible_mismatch", "needs_engineering_judgment", "equivalent_by_precedent"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(20).max(4000),
  groundingRegionIds: z.array(z.string().uuid()).default([])
});

export interface DocumentContext {
  documentType: string;
  documentTitle: string;
  revision: string | null;
  hierarchy: number;
}

export interface AssessComplianceInput {
  requirement: RequirementInput;
  targetText: string;
  acceptedPrecedent: boolean;
  groundingCandidates: SemanticCitation[];
  requirementContext: DocumentContext;
  targetContext: DocumentContext;
}

export interface AssessComplianceResult {
  verdict: ComplianceVerdict;
  confidence: string;
  reason: string;
  suggestionSource: "deterministic" | "model";
  suggestionModelVersion: string;
  deterministicCrossCheck: ComparisonResult;
  requirementSnapshot: Record<string, unknown>;
  targetSnapshot: Record<string, unknown>;
}

// Deterministic, code-level groundedness guard — mirrors the reference
// implementation at cx/generation.ts:76, except it demotes the verdict
// instead of throwing: an assessment should still be produced, just forced
// down to require human judgment when the model's cited region IDs cannot be
// verified against the candidate set retrieved in code.
export function validateGrounding(groundingRegionIds: string[], candidates: SemanticCitation[]): { valid: boolean; unverifiedIds: string[] } {
  if (!groundingRegionIds.length) return { valid: true, unverifiedIds: [] };
  const allowed = new Set(candidates.map((candidate) => candidate.sourceRegionId));
  const unverifiedIds = groundingRegionIds.filter((id) => !allowed.has(id));
  return { valid: unverifiedIds.length === 0, unverifiedIds };
}

// Exported standalone (mirrors Slice 3's filterGroundedClaims pattern) so
// both safety properties can be unit-tested directly without driving them
// through the full mock generation pipeline:
//   1. groundedness — any model-returned groundingRegionId not present in the
//      retrieved candidate set forces the verdict down.
//   2. check_precedent semantics (unchanged) — exact normalized-hash equality
//      is the ONLY path to equivalent_by_precedent; a model asserting that
//      verdict without an accepted precedent going in is forced down too.
export function applyVerdictSafetyDowngrades(input: {
  verdict: ComplianceVerdict;
  reason: string;
  groundingRegionIds: string[];
  groundingCandidates: SemanticCitation[];
  acceptedPrecedent: boolean;
}): { verdict: ComplianceVerdict; reason: string } {
  let verdict = input.verdict;
  let reason = input.reason;

  const grounding = validateGrounding(input.groundingRegionIds, input.groundingCandidates);
  if (!grounding.valid) {
    verdict = "needs_engineering_judgment";
    reason = `${reason}\n\nGrounding could not be verified: the assessment referenced region ID(s) not present in the retrieved standards-clause candidates, so this verdict has been downgraded to require engineering judgment.`;
  }

  if (verdict === "equivalent_by_precedent" && !input.acceptedPrecedent) {
    verdict = "needs_engineering_judgment";
    reason = `${reason}\n\nNo exact-hash accepted project precedent exists for this requirement and this exact normalized target line, so an equivalence-by-precedent verdict cannot stand; downgraded to require engineering judgment.`;
  }

  return { verdict, reason };
}

const SYSTEM_PROMPT = "You are assisting a licensed engineer with a professional compliance comparison between an accepted controlled requirement and a cited target document line (submittal, PO, shop drawing, or drawing). Write in a professional engineering register. You never certify, approve, or close a finding, and you never assert final compliance authority — every assessment you produce is advisory and requires human engineering review before it has any effect. If you assert an equivalence claim or cite a standards clause to support your reasoning, you must ground it in one of the supplied grounding candidate region IDs, or your assessment will be automatically downgraded to require engineering judgment. Output JSON only, matching the required schema.";

export async function assessCompliance(input: AssessComplianceInput): Promise<AssessComplianceResult> {
  const deterministic = compareCompliance(input.requirement, input.targetText, input.acceptedPrecedent);

  const mock = {
    verdict: deterministic.verdict,
    confidence: Number(deterministic.confidence),
    reason: deterministic.reason,
    groundingRegionIds: [] as string[]
  };

  const prompt = JSON.stringify({
    requirement: {
      statement: input.requirement.statement,
      numericValue: input.requirement.numericValue,
      unit: input.requirement.unit,
      tolerance: input.requirement.tolerance,
      source: input.requirementContext
    },
    target: {
      text: input.targetText,
      source: input.targetContext
    },
    hierarchyMismatch: input.requirementContext.hierarchy !== input.targetContext.hierarchy,
    acceptedPrecedent: input.acceptedPrecedent,
    groundingCandidates: input.groundingCandidates.map((candidate) => ({ regionId: candidate.sourceRegionId, documentType: candidate.documentType, text: candidate.text, similarity: candidate.similarity })),
    deterministicCrossCheck: { comparisonType: deterministic.comparisonType, verdict: deterministic.verdict, confidence: deterministic.confidence, reason: deterministic.reason }
  });

  const result = await getGenerationProvider().generateStructured({ system: SYSTEM_PROMPT, prompt, schema: assessmentSchema, mock });

  const { verdict, reason } = applyVerdictSafetyDowngrades({
    verdict: result.data.verdict,
    reason: result.data.reason,
    groundingRegionIds: result.data.groundingRegionIds ?? [],
    groundingCandidates: input.groundingCandidates,
    acceptedPrecedent: input.acceptedPrecedent
  });

  const suggestionSource: "deterministic" | "model" = result.provider === "mock" ? "deterministic" : "model";

  return {
    verdict,
    confidence: result.data.confidence.toFixed(4),
    reason,
    suggestionSource,
    suggestionModelVersion: result.model,
    deterministicCrossCheck: deterministic,
    requirementSnapshot: deterministic.requirementSnapshot,
    targetSnapshot: deterministic.targetSnapshot
  };
}
