/**
 * ============================================================================
 * BEAUFORT SCALE CONVERSION & STANDARD METEOROLOGICAL THRESHOLDS
 * ============================================================================
 * Standard empirical relation v = 0.836 * B^(3/2) (m/s at 10m height, 1946 WMO revision).
 * Inverse formula: B = (v / 0.836)^(2/3)
 */

export const KNOTS_PER_MS = 1.943844;
export const MS_PER_KNOT = 0.514444;

/**
 * Converts wind speed in meters per second (at 10m height) to integer Beaufort scale force [0, 12].
 */
export function windSpeedToBeaufort(speedMs: number): number {
  if (speedMs <= 0.2) return 0;
  const b = Math.pow(speedMs / 0.836, 2 / 3);
  return Math.min(12, Math.max(0, Math.round(b)));
}

/**
 * Converts wind speed in knots to integer Beaufort scale force [0, 12].
 */
export function windKnotsToBeaufort(speedKnots: number): number {
  return windSpeedToBeaufort(speedKnots * MS_PER_KNOT);
}

/**
 * Converts integer Beaufort force [0, 12] to nominal midpoint wind speed in knots.
 */
export function beaufortToMeanKnots(force: number): number {
  const clamped = Math.min(12, Math.max(0, Math.round(force)));
  const ms = 0.836 * Math.pow(clamped, 1.5);
  return Number((ms * KNOTS_PER_MS).toFixed(1));
}

/**
 * Standard WMO Beaufort scale knot thresholds:
 * [lowerBoundKnots, upperBoundKnots, description]
 */
export const BEAUFORT_TABLE: Record<
  number,
  { name: string; minKnots: number; maxKnots: number; meanWaveHeightM: number }
> = {
  0: { name: "Calm", minKnots: 0, maxKnots: 1, meanWaveHeightM: 0.0 },
  1: { name: "Light air", minKnots: 1, maxKnots: 3, meanWaveHeightM: 0.1 },
  2: { name: "Light breeze", minKnots: 4, maxKnots: 6, meanWaveHeightM: 0.2 },
  3: { name: "Gentle breeze", minKnots: 7, maxKnots: 10, meanWaveHeightM: 0.6 },
  4: { name: "Moderate breeze", minKnots: 11, maxKnots: 16, meanWaveHeightM: 1.0 },
  5: { name: "Fresh breeze", minKnots: 17, maxKnots: 21, meanWaveHeightM: 2.0 },
  6: { name: "Strong breeze", minKnots: 22, maxKnots: 27, meanWaveHeightM: 3.0 },
  7: { name: "Near gale", minKnots: 28, maxKnots: 33, meanWaveHeightM: 4.0 },
  8: { name: "Gale", minKnots: 34, maxKnots: 40, meanWaveHeightM: 5.5 },
  9: { name: "Strong gale", minKnots: 41, maxKnots: 47, meanWaveHeightM: 7.0 },
  10: { name: "Storm", minKnots: 48, maxKnots: 55, meanWaveHeightM: 9.0 },
  11: { name: "Violent storm", minKnots: 56, maxKnots: 63, meanWaveHeightM: 11.5 },
  12: { name: "Hurricane force", minKnots: 64, maxKnots: 150, meanWaveHeightM: 14.0 },
};
