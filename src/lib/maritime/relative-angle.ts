/**
 * ============================================================================
 * RELATIVE ENCOUNTER ANGLE & VECTOR TRIGONOMETRY
 * ============================================================================
 * Computes true relative encounter angles between a ship's heading and 
 * meteorological wind / ocean swell directions (which use "direction FROM" convention).
 * 
 * Encounter Angles:
 * 0°   = Dead Ahead (Head Sea / Head Wind - Maximum Resistance)
 * 45°  = Bow Quartering
 * 90°  = Beam Sea / Transverse Wind
 * 135° = Stern Quartering
 * 180° = Dead Astern (Following Sea / Tail Wind - Minimum Resistance)
 */

export type SeaCondition = "head" | "bow" | "beam" | "quartering" | "following";

/**
 * Computes relative encounter angle between ship heading and meteorological direction [0, 180].
 * @param shipHeadingDeg Ship's forward course over ground [0, 360)
 * @param metDirectionFromDeg Wind or swell direction coming FROM [0, 360)
 */
export function relativeEncounterAngle(
  shipHeadingDeg: number,
  metDirectionFromDeg: number
): number {
  const normHeading = ((shipHeadingDeg % 360) + 360) % 360;
  const normMet = ((metDirectionFromDeg % 360) + 360) % 360;
  const diff = Math.abs(normHeading - normMet);
  const encounter = diff > 180 ? 360 - diff : diff;
  return Number(encounter.toFixed(1));
}

/**
 * Classifies the relative encounter angle into discrete hydrodynamic sea regimes.
 */
export function classifySeaCondition(relativeAngleDeg: number): SeaCondition {
  const angle = Math.abs(relativeAngleDeg);
  if (angle <= 30) return "head";
  if (angle <= 60) return "bow";
  if (angle <= 120) return "beam";
  if (angle <= 150) return "quartering";
  return "following";
}

/**
 * Forward Azimuth (Initial Great-Circle Bearing) from Point A (lat1, lon1) to Point B (lat2, lon2).
 * Returns true compass heading in degrees [0, 360).
 */
export function forwardAzimuth(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return Number((((toDeg(theta) + 360) % 360)).toFixed(1));
}
