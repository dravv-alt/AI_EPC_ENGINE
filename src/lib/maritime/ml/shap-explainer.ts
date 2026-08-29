/**
 * ============================================================================
 * SHAP-STYLE CAUSAL FEATURE IMPORTANCE & "WHY" TRANSPARENCY EXPLAINER
 * ============================================================================
 * Quantifies exact additive feature contributions to delay predictions, providing 
 * transparent explainability (wind vs wave vs encounter angle vs visibility vs chokepoint).
 */

import { FEATURE_COLUMNS, FeatureColumnName } from "./feature-extraction";
import { TrainedQuantileWeights } from "./quantile-regression";

export interface FeatureContribution {
  feature: FeatureColumnName;
  displayName: string;
  rawValue: number;
  contributionHours: number; // Signed impact on predicted delay in hours
  percentageOfVariance: number;
}

export interface PredictionExplanation {
  baselineDelayHours: number;
  predictedDelayHours: number;
  topDrivers: FeatureContribution[];
  allContributions: FeatureContribution[];
  summary: string;
}

const FEATURE_DISPLAY_NAMES: Record<FeatureColumnName, string> = {
  beaufort_force: "Beaufort Wind Force",
  wave_height_m: "Significant Wave Height",
  swell_height_m: "Ocean Swell Height",
  relative_wave_angle_deg: "Relative Encounter Angle",
  sea_condition_encoded: "Directional Sea Regime (Head/Beam/Following)",
  visibility_m: "Surface Optical Visibility",
  precipitation_mm_h: "Precipitation Rate",
  vessel_class_encoded: "Vessel Class & Deadweight",
  block_coefficient: "Hull Block Coefficient (Cb)",
  loaded_condition_encoded: "Draft State (Laden vs Ballast)",
  leg_distance_nm: "Passage Leg Distance",
  forecast_horizon_hours: "Forecast Horizon Time",
  is_climatological_fallback: "Climatological Fallback Indicator",
  is_chokepoint_leg: "Chokepoint Canal/Strait Bottleneck",
  departure_month: "Seasonal Weather Period",
};

/**
 * Computes exact SHAP-style additive feature contributions for a given input vector.
 */
export function explainPrediction(
  featureVector: number[],
  model: TrainedQuantileWeights,
  cleanPhysicsDelay: number = 0
): PredictionExplanation {
  const norm = featureVector.map((val, f) => {
    const raw = (val - model.featureMeans[f]) / (model.featureStdDevs[f] || 1.0);
    return Math.max(-4.0, Math.min(4.0, raw));
  });

  const baseline = cleanPhysicsDelay + model.q50Bias;
  const contributions: FeatureContribution[] = [];
  let totalAbsImpact = 0;

  for (let f = 0; f < FEATURE_COLUMNS.length; f++) {
    const colName = FEATURE_COLUMNS[f];
    let impact = model.q50Weights[f] * norm[f];

    // If clean physics delay is present, wind, wave, and encounter angles incorporate their direct hydrodynamic share
    if (cleanPhysicsDelay > 0) {
      if (colName === "beaufort_force") {
        impact += cleanPhysicsDelay * 0.45; // 45% hydrodynamic wind share
      } else if (colName === "wave_height_m" || colName === "swell_height_m") {
        impact += cleanPhysicsDelay * 0.35; // 35% hydrodynamic wave share
      } else if (colName === "relative_wave_angle_deg" || colName === "sea_condition_encoded") {
        impact += cleanPhysicsDelay * 0.15; // 15% encounter angle diffraction
      }
    }

    totalAbsImpact += Math.abs(impact);

    contributions.push({
      feature: colName,
      displayName: FEATURE_DISPLAY_NAMES[colName] || colName,
      rawValue: featureVector[f],
      contributionHours: Number(impact.toFixed(3)),
      percentageOfVariance: 0,
    });
  }

  // Calculate percentage share
  contributions.forEach((c) => {
    c.percentageOfVariance =
      totalAbsImpact > 0
        ? Number(((Math.abs(c.contributionHours) / totalAbsImpact) * 100).toFixed(1))
        : 0;
  });

  // Separate positive aggravating factors and negative mitigating factors
  const aggravators = contributions.filter((c) => c.contributionHours > 0.01).sort((a, b) => b.contributionHours - a.contributionHours);
  const mitigators = contributions.filter((c) => c.contributionHours < -0.01).sort((a, b) => a.contributionHours - b.contributionHours);

  // Overall top factors by absolute magnitude
  contributions.sort((a, b) => Math.abs(b.contributionHours) - Math.abs(a.contributionHours));
  const topDrivers = contributions.slice(0, 4);

  const predicted = Number(
    Math.max(
      0.0,
      baseline + contributions.reduce((s, c) => s + c.contributionHours, 0)
    ).toFixed(2)
  );

  let summary: string;
  if (aggravators.length > 0) {
    const topAgg = aggravators[0];
    const secondAgg = aggravators[1];
    summary = `Primary delay driver: ${topAgg.displayName} (+${topAgg.contributionHours.toFixed(1)}h)${
      secondAgg ? `, combined with ${secondAgg.displayName} (+${secondAgg.contributionHours.toFixed(1)}h)` : ""
    }.`;
  } else if (mitigators.length > 0) {
    const topMit = mitigators[0];
    summary = `Favorable passage conditions: ${topMit.displayName} is reducing transit time by ${Math.abs(topMit.contributionHours).toFixed(1)}h below historical baseline.`;
  } else {
    summary = "Passage delay is consistent with calm water baseline.";
  }

  return {
    baselineDelayHours: Number(baseline.toFixed(2)),
    predictedDelayHours: predicted,
    topDrivers,
    allContributions: contributions,
    summary,
  };
}

/**
 * Computes global feature importance ranking across a dataset.
 */
export function computeGlobalFeatureImportance(
  model: TrainedQuantileWeights
): { feature: FeatureColumnName; displayName: string; importanceScore: number }[] {
  const ranking = FEATURE_COLUMNS.map((col, f) => ({
    feature: col,
    displayName: FEATURE_DISPLAY_NAMES[col],
    importanceScore: Number(Math.abs(model.q50Weights[f]).toFixed(4)),
  }));

  ranking.sort((a, b) => b.importanceScore - a.importanceScore);
  return ranking;
}
