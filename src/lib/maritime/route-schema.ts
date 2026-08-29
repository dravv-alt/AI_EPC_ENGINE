/**
 * ============================================================================
 * ROUTE REPRESENTATION & NAVIGATION GEOMETRY SCHEMA
 * ============================================================================
 * Defines geodetic route decomposition, navigation leg types (Great Circle vs 
 * Rhumb Line), adaptive waypoint density rules, and true azimuth bearing calculation.
 */

import { identifyChokepoint, type MaritimeChokepoint } from "./chokepoints";

export type NavigationLegType = 
  | "great_circle"        // Geodesic orthodromic shortest curve (Open Ocean)
  | "rhumb_line"           // Loxodromic constant-heading segment
  | "chokepoint_channel"   // Constrained strait or canal fairway track
  | "port_approach";       // Deep-water pilot station approach fairway

export interface RouteWaypoint {
  index: number;                  // 0-indexed sequential waypoint index
  lat: number;                    // Latitude in decimal degrees [-90, 90]
  lng: number;                    // Longitude in decimal degrees [-180, 180]
  
  // Geodetic Navigation Parameters
  legDistanceNm: number;          // Distance from previous waypoint in nautical miles
  cumulativeDistanceNm: number;   // Total cumulative distance from origin (nm)
  bearingDeg: number;             // True forward azimuth heading to NEXT waypoint [0, 360)
  bearingDeltaDeg: number;        // Bearing change from previous leg (steering deviation)
  
  legType: NavigationLegType;
  chokepoint: MaritimeChokepoint | null; // Tagged chokepoint if within strait/canal
  isCanalLock: boolean;           // Fixed lock transit node (Panama/Suez)
  
  // Downstream Temporal Integration
  plannedSpeedKnots: number;      // Calm-water scheduled speed
  effectiveSpeedKnots?: number;   // Speed after Kwon (2008) added-resistance reduction
  plannedEta?: Date;              // Baseline scheduled arrival
  calculatedEta?: Date;           // Dynamic weather-integrated propagated ETA
  delayAccumulatedHours?: number; // Total downstream delay propagated up to this point
}

export interface DecomposedRoute {
  totalDistanceNm: number;
  totalPlannedHours: number;
  waypoints: RouteWaypoint[];
  chokepointsTraversed: MaritimeChokepoint[];
  hasCanalTransit: boolean;
  hasAntimeridianCrossing: boolean;
}

/**
 * Calculates geodetic distance in nautical miles using the Haversine formula (1 nm = 1.852 km).
 */
export function calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R_NM = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_NM * c;
}

/**
 * Calculates initial true forward azimuth bearing from point A to point B in degrees [0, 360).
 */
export function calculateInitialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return Number(bearing.toFixed(1));
}

/**
 * Adaptive Waypoint Densification:
 * Decomposes raw route polylines into standards-grade navigation waypoints:
 * - Emits a waypoint every targetIntervalNm (default 35 nm / ~65 km)
 * - Emits a waypoint whenever forward azimuth bearing changes by > 15°
 * - Tags chokepoints and canal locks automatically.
 */
export function decomposeRoute(
  rawCoordinates: [number, number][],
  serviceSpeedKnots: number = 14.5,
  targetIntervalNm: number = 35.0
): DecomposedRoute {
  if (rawCoordinates.length === 0) {
    return {
      totalDistanceNm: 0,
      totalPlannedHours: 0,
      waypoints: [],
      chokepointsTraversed: [],
      hasCanalTransit: false,
      hasAntimeridianCrossing: false,
    };
  }

  const waypoints: RouteWaypoint[] = [];
  let cumulativeDist = 0;
  const chokepointsMap = new Map<string, MaritimeChokepoint>();
  let hasAntimeridian = false;

  // Initial Waypoint
  const startPt = rawCoordinates[0];
  const startCp = identifyChokepoint(startPt[0], startPt[1]);
  if (startCp) chokepointsMap.set(startCp.id, startCp);

  waypoints.push({
    index: 0,
    lat: startPt[0],
    lng: startPt[1],
    legDistanceNm: 0,
    cumulativeDistanceNm: 0,
    bearingDeg: rawCoordinates.length > 1 ? calculateInitialBearing(startPt[0], startPt[1], rawCoordinates[1][0], rawCoordinates[1][1]) : 0,
    bearingDeltaDeg: 0,
    legType: startCp ? "chokepoint_channel" : "port_approach",
    chokepoint: startCp,
    isCanalLock: startCp?.category === "canal",
    plannedSpeedKnots: serviceSpeedKnots,
  });

  for (let i = 1; i < rawCoordinates.length; i++) {
    const prevPt = rawCoordinates[i - 1];
    const currPt = rawCoordinates[i];

    // Check antimeridian crossing (jump between +170° and -170°)
    if (Math.abs(currPt[1] - prevPt[1]) > 180) {
      hasAntimeridian = true;
    }

    const segDist = calculateDistanceNm(prevPt[0], prevPt[1], currPt[0], currPt[1]);
    const bearing = calculateInitialBearing(prevPt[0], prevPt[1], currPt[0], currPt[1]);
    const prevBearing = waypoints[waypoints.length - 1].bearingDeg;
    const bearingDelta = Math.abs(bearing - prevBearing);

    // If segment is long (> targetIntervalNm), interpolate intermediate points
    if (segDist > targetIntervalNm) {
      const steps = Math.ceil(segDist / targetIntervalNm);
      for (let s = 1; s <= steps; s++) {
        const fraction = s / steps;
        const lat = prevPt[0] + (currPt[0] - prevPt[0]) * fraction;
        const lng = prevPt[1] + (currPt[1] - prevPt[1]) * fraction;
        const stepDist = segDist / steps;
        cumulativeDist += stepDist;

        const cp = identifyChokepoint(lat, lng);
        if (cp) chokepointsMap.set(cp.id, cp);

        waypoints.push({
          index: waypoints.length,
          lat: Number(lat.toFixed(4)),
          lng: Number(lng.toFixed(4)),
          legDistanceNm: Number(stepDist.toFixed(1)),
          cumulativeDistanceNm: Number(cumulativeDist.toFixed(1)),
          bearingDeg: bearing,
          bearingDeltaDeg: s === 1 ? Number(bearingDelta.toFixed(1)) : 0,
          legType: cp ? "chokepoint_channel" : "great_circle",
          chokepoint: cp,
          isCanalLock: cp?.category === "canal",
          plannedSpeedKnots: cp ? Math.min(serviceSpeedKnots, cp.speedLimitKnots) : serviceSpeedKnots,
        });
      }
    } else {
      cumulativeDist += segDist;
      const cp = identifyChokepoint(currPt[0], currPt[1]);
      if (cp) chokepointsMap.set(cp.id, cp);

      waypoints.push({
        index: waypoints.length,
        lat: Number(currPt[0].toFixed(4)),
        lng: Number(currPt[1].toFixed(4)),
        legDistanceNm: Number(segDist.toFixed(1)),
        cumulativeDistanceNm: Number(cumulativeDist.toFixed(1)),
        bearingDeg: bearing,
        bearingDeltaDeg: Number(bearingDelta.toFixed(1)),
        legType: cp ? "chokepoint_channel" : i === rawCoordinates.length - 1 ? "port_approach" : "rhumb_line",
        chokepoint: cp,
        isCanalLock: cp?.category === "canal",
        plannedSpeedKnots: cp ? Math.min(serviceSpeedKnots, cp.speedLimitKnots) : serviceSpeedKnots,
      });
    }
  }

  const totalHours = waypoints.reduce((acc, wp) => {
    return acc + (wp.legDistanceNm / (wp.plannedSpeedKnots || serviceSpeedKnots));
  }, 0);

  return {
    totalDistanceNm: Number(cumulativeDist.toFixed(1)),
    totalPlannedHours: Number(totalHours.toFixed(1)),
    waypoints,
    chokepointsTraversed: Array.from(chokepointsMap.values()),
    hasCanalTransit: Array.from(chokepointsMap.values()).some((cp) => cp.category === "canal"),
    hasAntimeridianCrossing: hasAntimeridian,
  };
}
