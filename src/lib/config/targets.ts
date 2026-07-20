import { env } from "@/lib/env";

/**
 * Named, overridable accuracy/latency targets.
 *
 * Traces to: TRD NFR table; PRD success metrics.
 *
 * These are targets/config for golden-set evaluation and operational tuning — nothing in
 * this module gates or enforces behavior on its own. Each value resolves through the
 * shared Zod-validated `env` (see `src/lib/env.ts`): an out-of-range override is rejected
 * at process startup rather than silently accepted, and an absent override falls back to
 * the documented default below.
 */

/** Deterministic compliance-deviation detection accuracy target on the golden set (TRD/PRD). */
export const COMPLIANCE_DEVIATION_ACCURACY_TARGET = env.COMPLIANCE_DEVIATION_ACCURACY_TARGET;

/**
 * Predictive-risk detection lead time target, in hours, on the golden set (TRD/PRD).
 * No numeric value is specified in the plans; 48 hours is a reasonable placeholder default
 * pending a golden-set-derived figure.
 */
export const RISK_LEAD_TIME_TARGET = env.RISK_LEAD_TIME_TARGET_HOURS;

/** Similar-RFI retrieval precision/recall target on the golden set (TRD/PRD). */
export const RFI_MATCH_ACCURACY_TARGET = env.RFI_MATCH_ACCURACY_TARGET;

/** Minimum precision for high-severity findings in a blinded engineer review (PRD success metric). */
export const HIGH_SEVERITY_PRECISION_TARGET = env.HIGH_SEVERITY_PRECISION_TARGET;

/** Minimum reduction in weekly readiness-report/evidence-pack preparation time (PRD success metric). */
export const PACK_PREP_TIME_REDUCTION_TARGET = env.PACK_PREP_TIME_REDUCTION_TARGET;

/** CP-SAT solver microservice request timeout, in milliseconds (Rules.md line 33: default 90s, configurable). */
export const SOLVER_TIMEOUT_MS = env.SOLVER_TIMEOUT_MS;

/** Bounded, backed-off retry cap for the CP-SAT solver microservice call (Rules.md line 33). */
export const SOLVER_MAX_ATTEMPTS = env.SOLVER_MAX_ATTEMPTS;
