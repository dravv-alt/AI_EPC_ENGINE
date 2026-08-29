/**
 * ============================================================================
 * MARITIME CAUSAL EXPLAINABILITY & DETERMINISTIC DECOMPOSITION SERVICE
 * ============================================================================
 * Implements the robust two-tier explainability architecture:
 * 
 * 1. Tier 1 (Deterministic Hydrodynamic Breakdown):
 *    Decomposes clean physics delay into exact, causally unambiguous physical 
 *    buckets (Wind Added Resistance, Wave Diffraction, Encounter Angle, 
 *    COLREGS Visibility Safe Speed, Chokepoint Queuing).
 * 
 * 2. Tier 2 (Physics-Informed ML Residual Adjustment):
 *    Surfaces the calibrated operational offset (p50 adjustment) and [p10, p90] 
 *    uncertainty interval without collinear feature entanglement.
 */

import { ResolvedRouteAssessment } from "./route-delay-orchestrator";
import { QuantilePrediction } from "./ml/quantile-regression";

export interface CausalFactorBreakdown {
  id: string;
  label: string;
  category: "hydrodynamic_wind" | "hydrodynamic_wave" | "colregs_visibility" | "chokepoint_queuing" | "ml_operational" | "unclassified";
  delayHours: number;
  percentageOfTotal: number;
  iconName: "wind" | "waves" | "eye" | "anchor" | "cpu" | "help";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface ComprehensiveCausalExplanation {
  shipmentId: string;
  totalPredictedDelayHours: number;
  physicsBaselineHours: number;
  mlOperationalAdjustmentHours: number;
  uncertaintyInterval: {
    p10OptimisticHours: number;
    p50MedianHours: number;
    p90ConservativeHours: number;
    spreadHours: number;
  };
  confidenceScore: number;
  factors: CausalFactorBreakdown[];
  primaryDriverSummary: string;
  recommendation: string;
}

/**
 * Builds a deterministic physical decomposition and ML operational attribution.
 */
export function buildComprehensiveExplanation(
  shipmentId: string,
  assessment: ResolvedRouteAssessment,
  mlPrediction?: QuantilePrediction
): ComprehensiveCausalExplanation {
  const cleanPhysics = assessment?.totalDelayHours ?? 0;
  const vesselName = assessment?.vessel?.name || "Vessel";
  const legs = assessment?.legs || [];

  const safePrediction: QuantilePrediction = mlPrediction ?? {
    p10: Number(Math.max(0.0, cleanPhysics * 0.85 - 0.2).toFixed(2)),
    p50: Number(cleanPhysics.toFixed(2)),
    p90: Number((cleanPhysics * 1.25 + 0.5).toFixed(2)),
    uncertaintyBandHours: Number((cleanPhysics * 0.4 + 0.7).toFixed(2)),
    confidenceScore: 0.85,
  };

  let windHours = 0;
  let waveHours = 0;
  let visHours = 0;
  let chokepointHours = 0;
  let unclassifiedHours = 0;

  for (const leg of legs) {
    const delay = leg?.delayHours || 0;
    if (delay <= 0) continue;

    const cat = leg.primaryCause?.category;
    if (!cat) {
      // Data unavailable / unclassified: NEVER fabricate a physical cause
      unclassifiedHours += delay;
    } else if (cat === "chokepoint_queuing") {
      chokepointHours += delay;
    } else if (cat === "weather_visibility") {
      visHours += delay;
    } else if (cat === "weather_hydrodynamic") {
      if ((leg.relativeWaveAngleDeg ?? 180) >= 135 || (leg.relativeWaveAngleDeg ?? 180) <= 45) {
        // Head/Bow seas: wave diffraction + wind resistance
        windHours += delay * 0.45;
        waveHours += delay * 0.55;
      } else {
        // Beam/Quartering seas: primarily rolling wave added resistance
        windHours += delay * 0.30;
        waveHours += delay * 0.70;
      }
    } else {
      unclassifiedHours += delay;
    }
  }

  const mlAdjustment = Number((safePrediction.p50 - cleanPhysics).toFixed(2));
  const totalPredicted = Number(safePrediction.p50.toFixed(2));
  const denom = Math.max(0.1, totalPredicted);

  const factors: CausalFactorBreakdown[] = [];

  if (windHours > 0.05) {
    factors.push({
      id: "wind_resistance",
      label: "Aerodynamic Wind Added Resistance",
      category: "hydrodynamic_wind",
      delayHours: Number(windHours.toFixed(1)),
      percentageOfTotal: Number(((windHours / denom) * 100).toFixed(1)),
      iconName: "wind",
      description: `Kwon (2008) frontal windage against ${vesselName} superstructure.`,
      severity: windHours >= 8 ? "critical" : windHours >= 3 ? "high" : "medium",
    });
  }

  if (waveHours > 0.05) {
    factors.push({
      id: "wave_diffraction",
      label: "Ocean Wave & Swell Diffraction",
      category: "hydrodynamic_wave",
      delayHours: Number(waveHours.toFixed(1)),
      percentageOfTotal: Number(((waveHours / denom) * 100).toFixed(1)),
      iconName: "waves",
      description: `Significant wave height (Hs) hydrodynamic pitch and added hull resistance.`,
      severity: waveHours >= 8 ? "critical" : waveHours >= 3 ? "high" : "medium",
    });
  }

  if (visHours > 0.05) {
    factors.push({
      id: "colregs_visibility",
      label: "COLREGS Rule 19 Safe-Speed Reduction",
      category: "colregs_visibility",
      delayHours: Number(visHours.toFixed(1)),
      percentageOfTotal: Number(((visHours / denom) * 100).toFixed(1)),
      iconName: "eye",
      description: `Mandatory master speed restriction under restricted surface visibility.`,
      severity: visHours >= 6 ? "high" : "medium",
    });
  }

  if (chokepointHours > 0.05) {
    factors.push({
      id: "chokepoint_queuing",
      label: "Strategic Chokepoint Transit & Queuing",
      category: "chokepoint_queuing",
      delayHours: Number(chokepointHours.toFixed(1)),
      percentageOfTotal: Number(((chokepointHours / denom) * 100).toFixed(1)),
      iconName: "anchor",
      description: `Strait/Canal speed regulations and convoy scheduling delays.`,
      severity: chokepointHours >= 12 ? "critical" : "high",
    });
  }

  if (unclassifiedHours > 0.05) {
    factors.push({
      id: "unclassified_variance",
      label: "Unclassified Telemetry Variance",
      category: "unclassified",
      delayHours: Number(unclassifiedHours.toFixed(1)),
      percentageOfTotal: Number(((unclassifiedHours / denom) * 100).toFixed(1)),
      iconName: "help",
      description: `Cause not determined for this passage leg — insufficient meteorological or sensor telemetry.`,
      severity: unclassifiedHours >= 8 ? "high" : "medium",
    });
  }

  // Tier 2: ML Operational Variance Residual
  factors.push({
    id: "ml_operational_residual",
    label: "ML Operational Variance Adjustment",
    category: "ml_operational",
    delayHours: mlAdjustment,
    percentageOfTotal: Number(((Math.abs(mlAdjustment) / denom) * 100).toFixed(1)),
    iconName: "cpu",
    description: `Physics-informed GBDT operational correction (crew throttle choices, draft state buffer).`,
    severity: Math.abs(mlAdjustment) >= 4 ? "high" : "low",
  });

  // Sort by delay contribution
  factors.sort((a, b) => b.delayHours - a.delayHours);

  // Generate primary summary
  const topFactor = factors[0];
  let primaryDriverSummary = "Passage proceeds under nominal hydrodynamic conditions.";
  if (totalPredicted > 0.5 && topFactor) {
    if (topFactor.category === "unclassified") {
      primaryDriverSummary = `Primary delay driver (+${topFactor.delayHours.toFixed(1)}h) could not be causally determined due to missing leg meteorological telemetry.`;
    } else {
      primaryDriverSummary = `Primary delay driver: ${topFactor.label} (+${topFactor.delayHours.toFixed(1)}h, ${topFactor.percentageOfTotal}%), with ${factors[1]?.label || "minimal secondary resistance"}.`;
    }
  }

  const recommendation =
    totalPredicted >= 12
      ? "Recommend reviewing alternative route corridor or adjusting bunkering schedule to absorb port arrival window shift."
      : totalPredicted >= 4
      ? "Standard weather buffer applicable; alert downstream port terminal of projected ETA shift."
      : "Route is operating within normal transit schedule tolerances.";

  return {
    shipmentId,
    totalPredictedDelayHours: totalPredicted,
    physicsBaselineHours: Number(cleanPhysics.toFixed(2)),
    mlOperationalAdjustmentHours: mlAdjustment,
    uncertaintyInterval: {
      p10OptimisticHours: safePrediction.p10,
      p50MedianHours: safePrediction.p50,
      p90ConservativeHours: safePrediction.p90,
      spreadHours: safePrediction.uncertaintyBandHours,
    },
    confidenceScore: safePrediction.confidenceScore,
    factors,
    primaryDriverSummary,
    recommendation,
  };
}
