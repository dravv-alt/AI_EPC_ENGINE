/**
 * ============================================================================
 * GROUND-TRUTH STRATEGY & CALIBRATION DATASET ARCHITECTURE
 * ============================================================================
 * Defines the dual-stream ground-truth strategy:
 * 1. Empirical AIS Track Extraction: Actual achieved speed calculated from live 
 *    & historical AIS position deltas joined with reanalysis weather grids.
 * 2. High-Fidelity Physics Baseline Simulation: Synthetic scenarios generated via
 *    Kwon (2008) naval hydrodynamics with calibrated stochastic noise.
 */

export type GroundTruthSource = 
  | "ais_empirical"       // Observed AIS position/time delta (Highest Fidelity)
  | "physics_simulated"   // Kwon (2008) hydrodynamic simulation + stochastic noise
  | "climatological_norm";// Historical monthly climatology fallback

export interface GroundTruthRecord {
  id: string;
  source: GroundTruthSource;
  vesselClass: string;
  loadState: "laden" | "ballast";
  
  // Route Leg Spatial Coordinates
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  legDistanceNm: number;
  shipHeadingDeg: number;
  
  // Environmental Atmospheric & Marine Conditions
  timestamp: string;               // ISO-8601 observation timestamp
  beaufortScale: number;           // Beaufort wind force [0, 12]
  windSpeedKnots: number;          // 10m wind speed in knots
  windDirectionDeg: number;        // True meteorological wind direction [0, 360)
  relativeWindAngleDeg: number;    // Absolute angle between ship heading and wind [0, 180]
  significantWaveHeightM: number;  // Combined sea + swell wave height (Hs) in meters
  swellDirectionDeg: number;       // Peak wave swell direction [0, 360)
  relativeSwellAngleDeg: number;   // Angle between heading and swell [0, 180]
  visibilityNm: number;            // Optical surface visibility in nautical miles
  
  // Speed & Delay Metrics
  serviceSpeedKnots: number;       // Design calm-water scheduled speed (Vs)
  achievedSpeedKnots: number;      // Real observed or simulated ground speed (Vg)
  speedLossPercent: number;        // Speed loss: ((Vs - Vg) / Vs) * 100%
  delayHours: number;              // Leg delay: (Distance / Vg) - (Distance / Vs)
  
  // Feature Engineering Context
  isChokepoint: boolean;
  chokepointId?: string;
  forecastHorizonHours: number;    // How many hours ahead this was predicted (0 for nowcast)
}

export interface CalibrationSummary {
  totalRecords: number;
  aisEmpiricalCount: number;
  physicsSimulatedCount: number;
  meanSpeedLossPercent: number;
  meanDelayHours: number;
  noiseDistributionModel: string;  // e.g. "Gaussian(mu=0.0, sigma=0.8kn) + Cauchy tail for squalls"
  datasetVersion: string;
}
