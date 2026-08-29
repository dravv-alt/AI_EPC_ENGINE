/**
 * ============================================================================
 * MARITIME INTELLIGENCE DOMAIN ENGINE: BARREL EXPORTS
 * ============================================================================
 */

// Phase 0: Foundations & Schemas
export * from "./vessel-profiles";
export * from "./chokepoints";
export * from "./route-schema";
export * from "./delay-taxonomy";
export * from "./ground-truth";

// Phase 1: Physics Baseline Engine (Layer 1)
export * from "./beaufort";
export * from "./relative-angle";
export * from "./kwon-speed-loss";
export * from "./delay-integrator";

// Phase 2 & 3: Route Decomposition, Weather Ingestion & Orchestrator
export * from "./route-decomposition";
export * from "./weather-ingestion";
export * from "./route-delay-orchestrator";

// Phase 4: Weather Caching, Audit Logging & Delta Alerting
export * from "./weather-cache";
export * from "./jobs/audit-log";
export * from "./jobs/delta-alerting";
export * from "./jobs/reevaluate-shipment";

// Phase 5: Synthetic Ground-Truth Data Pipeline
export * from "./synthetic/historical-weather-client";
export * from "./synthetic/scenario-generator";
export * from "./synthetic/noise-model";
export * from "./synthetic/generate-training-row";
export * from "./synthetic/dataset-store";
export * from "./synthetic/run-generation-batch";

// Phase 6: ML Calibration Layer (Quantile Regression & SHAP Explainability)
export * from "./ml/feature-extraction";
export * from "./ml/quantile-regression";
export * from "./ml/shap-explainer";
export * from "./ml/backtest";
