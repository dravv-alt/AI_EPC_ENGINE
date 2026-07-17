export type ReadinessState = "unknown" | "blocked" | "in_review" | "ready";

export interface ReadinessInput {
  acceptedRequirements: number;
  requiredEvidence: number;
  acceptedEvidence: number;
  staleEvidence: number;
  failedEvidence: number;
  blockingFindings: number;
  unmetPrerequisites: number;
}

export function computeReadiness(input: ReadinessInput): ReadinessState {
  if (input.acceptedRequirements === 0 || input.requiredEvidence === 0) return "unknown";
  if (input.failedEvidence > 0 || input.blockingFindings > 0 || input.unmetPrerequisites > 0) return "blocked";
  if (input.staleEvidence > 0 || input.acceptedEvidence < input.requiredEvidence) return "in_review";
  return "ready";
}
