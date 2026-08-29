/**
 * ============================================================================
 * MARITIME ML FEATURE EXTRACTION PIPELINE
 * ============================================================================
 * Transforms synthetic & empirical training rows into structured numeric 
 * feature matrices with ordinal sea-condition encoding, normalized hydrodynamic 
 * indicators, and forecast-horizon tracking.
 */

import { SyntheticTrainingRow } from "../synthetic/generate-training-row";
import { ALL_VESSEL_CLASSES } from "../synthetic/scenario-generator";

export const FEATURE_COLUMNS = [
  "beaufort_force",
  "wave_height_m",
  "swell_height_m",
  "relative_wave_angle_deg",
  "sea_condition_encoded",
  "visibility_m",
  "precipitation_mm_h",
  "vessel_class_encoded",
  "block_coefficient",
  "loaded_condition_encoded",
  "leg_distance_nm",
  "forecast_horizon_hours",
  "is_climatological_fallback",
  "is_chokepoint_leg",
  "departure_month",
] as const;

export type FeatureColumnName = (typeof FEATURE_COLUMNS)[number];

// Ordinal encoding: Monotonically increasing resistance (Kwon 2008 C_beta order)
export const SEA_CONDITION_ORDER = [
  "following",   // 0: Minimal added resistance
  "quartering",  // 1: Mild stern quartering
  "beam",        // 2: Moderate rolling / bilge resistance
  "bow",         // 3: High diffraction
  "head",        // 4: Maximum pitch & bow slamming
] as const;

export interface ExtractedFeatureRecord {
  scenarioId: string;
  waypointIndex: number;
  features: Record<FeatureColumnName, number>;
  featureVector: number[];
  cleanDelayHours: number;
  targetNoisyDelayHours: number;
}

/**
 * Extracts normalized tabular feature matrices from generated training rows.
 */
export function extractFeatureVectors(trainingRows: SyntheticTrainingRow[]): ExtractedFeatureRecord[] {
  const records: ExtractedFeatureRecord[] = [];

  for (const row of trainingRows) {
    const vesselClassIdx = Math.max(0, ALL_VESSEL_CLASSES.indexOf(row.vesselClass as any));
    const departureMonth = new Date(row.departureTime).getUTCMonth() + 1;

    for (const leg of row.legs) {
      const seaCondIdx = Math.max(
        0,
        SEA_CONDITION_ORDER.indexOf(leg.seaCondition as any)
      );

      const features: Record<FeatureColumnName, number> = {
        beaufort_force: leg.beaufortForce,
        wave_height_m: leg.inputSnapshot.waveHeightM,
        swell_height_m: leg.inputSnapshot.waveHeightM * 0.7, // Proxy if direct swell not recorded
        relative_wave_angle_deg: leg.relativeWaveAngleDeg,
        sea_condition_encoded: seaCondIdx,
        visibility_m: leg.inputSnapshot.visibilityMeters,
        precipitation_mm_h: leg.inputSnapshot.weatherCode >= 60 ? 3.5 : 0.0,
        vessel_class_encoded: vesselClassIdx,
        block_coefficient: leg.speedLoss.cForm ? 0.75 : 0.65,
        loaded_condition_encoded: row.isLaden ? 1 : 0,
        leg_distance_nm: leg.legDistanceNm,
        forecast_horizon_hours: leg.inputSnapshot.forecastHorizonHours || 0,
        is_climatological_fallback: leg.inputSnapshot.isClimatologicalFallback ? 1 : 0,
        is_chokepoint_leg: leg.primaryCause.category === "chokepoint_queuing" ? 1 : 0,
        departure_month: departureMonth,
      };

      const featureVector = FEATURE_COLUMNS.map((col) => features[col]);

      records.push({
        scenarioId: row.scenarioId,
        waypointIndex: leg.waypointIndex,
        features,
        featureVector,
        cleanDelayHours: leg.cleanDelayHours,
        targetNoisyDelayHours: leg.noisyLegDelayHours,
      });
    }
  }

  return records;
}
