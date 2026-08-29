/**
 * ============================================================================
 * MARITIME DELAY DRIFT MONITORING & ACTUAL-VS-PREDICTED LOGGING
 * ============================================================================
 * Tracks actual realized vessel transit times against initial physics (Layer 1)
 * and ML quantile predictions (Layer 3) to compute online MAE drift and interval 
 * calibration coverage over time.
 */

import { randomUUID } from "node:crypto";
import { ResolvedRouteAssessment } from "../route-delay-orchestrator";
import { QuantilePrediction } from "../ml/quantile-regression";

export interface VoyageRealizationRecord {
  id: string;
  shipmentId: string;
  vesselClass: string;
  routeId: string;
  departureTime: string;
  actualArrivalTime: string;
  plannedDurationHours: number;
  actualDurationHours: number;
  actualRealizedDelayHours: number;
  
  // Layer 1 Physics Prediction
  initialPhysicsDelayHours: number;
  physicsErrorHours: number;

  // Layer 3 ML Quantile Prediction
  mlPrediction: QuantilePrediction;
  mlP50ErrorHours: number;
  isWithinP10P90Band: boolean;

  recordedAt: string;
}

export interface DriftMetricsSummary {
  totalCompletedVoyages: number;
  physicsBaselineMae: number;
  mlQuantileMae: number;
  maeImprovementPercent: number;
  empirical80CoveragePercent: number;
  isDriftAlertTriggered: boolean;
  driftStatus: "healthy" | "minor_drift" | "severe_drift";
}

const realizationHistory = new Map<string, VoyageRealizationRecord>();

/**
 * Logs an actual completed voyage realization and calculates online error metrics.
 */
export function recordVoyageRealization(
  shipmentId: string,
  actualArrivalTime: Date,
  assessment: ResolvedRouteAssessment,
  mlPrediction: QuantilePrediction
): VoyageRealizationRecord {
  const actualDurationHours = Number(
    ((actualArrivalTime.getTime() - assessment.initialDepartureTime.getTime()) / 3600_000).toFixed(2)
  );
  const actualRealizedDelayHours = Number(
    Math.max(0.0, actualDurationHours - assessment.totalPlannedHours).toFixed(2)
  );

  const physicsErrorHours = Number(
    Math.abs(actualRealizedDelayHours - assessment.totalDelayHours).toFixed(2)
  );
  const mlP50ErrorHours = Number(
    Math.abs(actualRealizedDelayHours - mlPrediction.p50).toFixed(2)
  );
  const isWithinP10P90Band =
    actualRealizedDelayHours >= mlPrediction.p10 &&
    actualRealizedDelayHours <= mlPrediction.p90;

  const record: VoyageRealizationRecord = {
    id: `realize_${randomUUID()}`,
    shipmentId,
    vesselClass: assessment.vessel.id,
    routeId: `RT_${shipmentId}`,
    departureTime: assessment.initialDepartureTime.toISOString(),
    actualArrivalTime: actualArrivalTime.toISOString(),
    plannedDurationHours: assessment.totalPlannedHours,
    actualDurationHours,
    actualRealizedDelayHours,
    initialPhysicsDelayHours: assessment.totalDelayHours,
    physicsErrorHours,
    mlPrediction,
    mlP50ErrorHours,
    isWithinP10P90Band,
    recordedAt: new Date().toISOString(),
  };

  realizationHistory.set(shipmentId, record);
  return record;
}

/**
 * Computes fleet-wide online drift metrics.
 */
export function computeDriftMetrics(): DriftMetricsSummary {
  const records = Array.from(realizationHistory.values());
  const total = records.length;

  if (total === 0) {
    return {
      totalCompletedVoyages: 0,
      physicsBaselineMae: 0,
      mlQuantileMae: 0,
      maeImprovementPercent: 0,
      empirical80CoveragePercent: 80.0,
      isDriftAlertTriggered: false,
      driftStatus: "healthy",
    };
  }

  const sumPhysicsErr = records.reduce((s, r) => s + r.physicsErrorHours, 0);
  const sumMlErr = records.reduce((s, r) => s + r.mlP50ErrorHours, 0);
  const withinBandCount = records.filter((r) => r.isWithinP10P90Band).length;

  const physicsBaselineMae = Number((sumPhysicsErr / total).toFixed(3));
  const mlQuantileMae = Number((sumMlErr / total).toFixed(3));
  const maeImprovementPercent = Number(
    (((physicsBaselineMae - mlQuantileMae) / Math.max(0.001, physicsBaselineMae)) * 100).toFixed(1)
  );
  const empirical80CoveragePercent = Number(((withinBandCount / total) * 100).toFixed(1));

  // Drift Alert if coverage falls below 65% on >= 10 voyages
  const isDriftAlertTriggered = total >= 10 && empirical80CoveragePercent < 65.0;
  const driftStatus =
    empirical80CoveragePercent >= 75
      ? "healthy"
      : empirical80CoveragePercent >= 65
      ? "minor_drift"
      : "severe_drift";

  return {
    totalCompletedVoyages: total,
    physicsBaselineMae,
    mlQuantileMae,
    maeImprovementPercent,
    empirical80CoveragePercent,
    isDriftAlertTriggered,
    driftStatus,
  };
}
