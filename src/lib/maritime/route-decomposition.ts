/**
 * ============================================================================
 * ROUTE DECOMPOSITION & GEODESIC DENSIFICATION SERVICE
 * ============================================================================
 * Slerp (Spherical Linear Interpolation) great-circle routing with adaptive 
 * waypoint densification (25–50 nm spacing, >15° bearing change detection) 
 * and automated chokepoint channel classification.
 */

import { forwardAzimuth } from "./relative-angle";
import { identifyChokepoint, MaritimeChokepoint } from "./chokepoints";

export interface RawRoutePoint {
  lat: number;
  lng: number;
}

export interface DecomposedWaypoint {
  index: number;
  lat: number;
  lng: number;
  cumulativeDistanceNm: number;
  distanceToNextNm: number;
  bearingToNextDeg: number;
  legType: "great_circle" | "chokepoint_channel" | "port_approach";
  chokepoint: MaritimeChokepoint | null;
  isCanalLock: boolean;
  sharpTurn: boolean;
}

const NM_PER_KM = 0.539957;
const R_EARTH_KM = 6371.0088;
const MIN_LEG_NM = 25.0;
const MAX_LEG_NM = 50.0;
const BEARING_CHANGE_THRESHOLD_DEG = 15.0;

/**
 * Calculates geodetic distance in nautical miles using the Haversine formula.
 */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R_EARTH_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));
  return Number((km * NM_PER_KM).toFixed(2));
}

/**
 * Spherical Linear Interpolation (slerp) on unit sphere for true Great-Circle tracks.
 * Antimeridian safe (wraps longitude properly to [-180, 180]).
 */
export function slerpGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  f: number
): { lat: number; lng: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1), lambda1 = toRad(lon1);
  const phi2 = toRad(lat2), lambda2 = toRad(lon2);

  const d =
    2 *
    Math.asin(
      Math.min(
        1.0,
        Math.sqrt(
          Math.sin((phi2 - phi1) / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2
        )
      )
    );

  if (d === 0) return { lat: lat1, lng: lon1 };

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);

  const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
  const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  const phi3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lambda3 = Math.atan2(y, x);

  return {
    lat: Number(toDeg(phi3).toFixed(4)),
    lng: Number(toDeg(lambda3).toFixed(4)),
  };
}

/**
 * Densifies a sparse or dense polyline into standard 25-50nm navigation waypoints
 * with geodesic slerp interpolation and chokepoint channel classification.
 */
export function densifyRoute(controlPoints: RawRoutePoint[]): DecomposedWaypoint[] {
  if (controlPoints.length < 2) {
    throw new Error("Route needs at least origin and destination coordinates");
  }

  const waypoints: DecomposedWaypoint[] = [];
  let cumulativeDistanceNm = 0;
  let index = 0;
  let prevBearing: number | null = null;

  for (let seg = 0; seg < controlPoints.length - 1; seg++) {
    const a = controlPoints[seg];
    const b = controlPoints[seg + 1];
    const segDistanceNm = haversineNm(a.lat, a.lng, b.lat, b.lng);

    // Aim for 35-50nm steps per segment
    const nSamples = Math.max(1, Math.round(segDistanceNm / MAX_LEG_NM));
    const stepDistanceNm = segDistanceNm / nSamples;

    for (let s = 0; s < nSamples; s++) {
      const f = s / nSamples;
      const point = f === 0 ? a : slerpGreatCircle(a.lat, a.lng, b.lat, b.lng, f);
      const fNext = (s + 1) / nSamples;
      const nextPoint =
        s + 1 === nSamples ? b : slerpGreatCircle(a.lat, a.lng, b.lat, b.lng, fNext);

      const bearing = forwardAzimuth(point.lat, point.lng, nextPoint.lat, nextPoint.lng);
      const bearingChange =
        prevBearing !== null
          ? Math.min(Math.abs(bearing - prevBearing), 360 - Math.abs(bearing - prevBearing))
          : 0;

      const sharpTurn = bearingChange > BEARING_CHANGE_THRESHOLD_DEG;
      const cp = identifyChokepoint(point.lat, point.lng);

      waypoints.push({
        index,
        lat: point.lat,
        lng: point.lng,
        cumulativeDistanceNm: Number(cumulativeDistanceNm.toFixed(1)),
        distanceToNextNm: Number(stepDistanceNm.toFixed(1)),
        bearingToNextDeg: bearing,
        legType: cp ? "chokepoint_channel" : index === 0 ? "port_approach" : "great_circle",
        chokepoint: cp,
        isCanalLock: cp?.category === "canal",
        sharpTurn,
      });

      cumulativeDistanceNm += stepDistanceNm;
      prevBearing = bearing;
      index++;
    }
  }

  // Final destination point
  const last = controlPoints[controlPoints.length - 1];
  const lastCp = identifyChokepoint(last.lat, last.lng);
  waypoints.push({
    index,
    lat: last.lat,
    lng: last.lng,
    cumulativeDistanceNm: Number(cumulativeDistanceNm.toFixed(1)),
    distanceToNextNm: 0,
    bearingToNextDeg: waypoints[waypoints.length - 1]?.bearingToNextDeg ?? 0,
    legType: lastCp ? "chokepoint_channel" : "port_approach",
    chokepoint: lastCp,
    isCanalLock: lastCp?.category === "canal",
    sharpTurn: false,
  });

  return waypoints;
}

/**
 * Interpolates the estimated real-time vessel coordinates [lat, lng] along a multi-segment route polyline
 * given the voyage elapsed progress fraction (0.0 to 1.0).
 */
export function interpolatePositionAlongPolyline(
  polyline: [number, number][],
  progressFraction: number
): { lat: number; lng: number; progressPercent: number; segmentIndex: number } | null {
  if (!polyline || polyline.length === 0) return null;
  if (polyline.length === 1) {
    return { lat: polyline[0][0], lng: polyline[0][1], progressPercent: 100, segmentIndex: 0 };
  }

  const clampedProgress = Math.max(0.0, Math.min(1.0, progressFraction));
  if (clampedProgress <= 0.001) {
    return { lat: polyline[0][0], lng: polyline[0][1], progressPercent: 0, segmentIndex: 0 };
  }
  if (clampedProgress >= 0.999) {
    const last = polyline[polyline.length - 1];
    return { lat: last[0], lng: last[1], progressPercent: 100, segmentIndex: polyline.length - 1 };
  }

  // Calculate cumulative distances along all segments
  const distances: number[] = [0];
  let totalDistance = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = haversineNm(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
    totalDistance += d;
    distances.push(totalDistance);
  }

  if (totalDistance === 0) {
    return { lat: polyline[0][0], lng: polyline[0][1], progressPercent: 0, segmentIndex: 0 };
  }

  const targetDistance = clampedProgress * totalDistance;

  // Find the exact segment
  for (let i = 0; i < distances.length - 1; i++) {
    const startDist = distances[i];
    const endDist = distances[i + 1];
    if (targetDistance >= startDist && targetDistance <= endDist) {
      const segmentDist = endDist - startDist;
      const fraction = segmentDist > 0 ? (targetDistance - startDist) / segmentDist : 0;
      const interpolated = slerpGreatCircle(
        polyline[i][0],
        polyline[i][1],
        polyline[i + 1][0],
        polyline[i + 1][1],
        fraction
      );
      return {
        lat: Number(interpolated.lat.toFixed(4)),
        lng: Number(interpolated.lng.toFixed(4)),
        progressPercent: Math.round(clampedProgress * 100),
        segmentIndex: i,
      };
    }
  }

  const last = polyline[polyline.length - 1];
  return { lat: last[0], lng: last[1], progressPercent: 100, segmentIndex: polyline.length - 1 };
}

/**
 * Computes timeline elapsed progress (0.0 to 1.0) strictly in relation to:
 * - Current real-time clock (`now`)
 * - Departure timestamp (`departureDate`)
 * - Target planned delivery / weather-adjusted arrival (`plannedDeliveryDate`)
 */
export function computeTimelineProgress(
  departureDate: Date | string | null,
  plannedDeliveryDate: Date | string | null,
  now: number = Date.now()
): number {
  if (!plannedDeliveryDate) return 0.50;

  const targetArrivalMs = new Date(plannedDeliveryDate).getTime();
  if (isNaN(targetArrivalMs)) return 0.50;

  let departureMs = departureDate ? new Date(departureDate).getTime() : NaN;
  if (isNaN(departureMs) || departureMs >= targetArrivalMs) {
    // If departure date is unrecorded, calibrate standard transit duration ending at target planned delivery
    departureMs = targetArrivalMs - 7 * 24 * 3600_000;
  }

  const totalVoyageDurationMs = targetArrivalMs - departureMs;
  if (totalVoyageDurationMs <= 0) return 1.0;

  // Exact real-time elapsed duration relative to current time
  const elapsedMs = now - departureMs;
  const progressRatio = elapsedMs / totalVoyageDurationMs;

  // Fully continuous progression from 0.0 (origin departure) to 1.0 (delivered at destination)
  return Math.max(0.0, Math.min(1.0, progressRatio));
}

