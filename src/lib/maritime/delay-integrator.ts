/**
 * ============================================================================
 * LEG-BASED DELAY NUMERICAL INTEGRATOR & ETA PROPAGATION ENGINE
 * ============================================================================
 * Iterates through decomposed route waypoints, applies:
 * 1. Vector encounter angles (relative wind and wave direction)
 * 2. Kwon (2008) added hydrodynamic resistance
 * 3. COLREGS Rule 19 safe-speed restrictions under reduced visibility (sea fog)
 * 4. Chokepoint speed limits and canal queuing buffers
 * 5. Cumulative ETA propagation: (Timestamp at waypoint i+1 shifts downstream weather lookups)
 */

import { windKnotsToBeaufort, windSpeedToBeaufort } from "./beaufort";
import { classifySeaCondition, forwardAzimuth, relativeEncounterAngle, SeaCondition } from "./relative-angle";
import { kwonSpeedLoss, SpeedLossResult } from "./kwon-speed-loss";
import { VesselProfile } from "./vessel-profiles";
import { MaritimeChokepoint } from "./chokepoints";
import { DELAY_TAXONOMY, DelayTaxonomyEntry } from "./delay-taxonomy";

export interface WeatherInputSnapshot {
  windSpeedKnots: number;
  windSpeedMs: number;
  windFromDeg: number;
  waveHeightM: number;
  waveFromDeg: number;
  visibilityMeters: number;
  weatherCode: number;
  forecastHorizonHours: number;
  isClimatologicalFallback: boolean;
}

export interface WaypointWeatherSample {
  waypointIndex: number;
  lat: number;
  lng: number;
  nextLat?: number;
  nextLng?: number;
  legDistanceNm: number;
  
  // Meteorological & Oceanographic Observations
  windSpeedKnots: number;
  windFromDeg: number;            // Meteorological convention: Direction wind is FROM [0, 360)
  waveHeightM: number;            // Significant wave height (Hs) in meters
  waveFromDeg: number;            // Swell / primary wave direction FROM [0, 360)
  visibilityMeters: number;       // Optical surface visibility (meters)
  weatherCode: number;            // WMO Weather Code
  forecastHorizonHours?: number;
  isClimatologicalFallback?: boolean;
  
  // Navigation & Geography Context
  chokepoint?: MaritimeChokepoint | null;
  isCanalLock?: boolean;
}

export interface LegDelayResult {
  waypointIndex: number;
  lat: number;
  lng: number;
  legDistanceNm: number;
  plannedSpeedKnots: number;
  effectiveSpeedKnots: number;
  plannedHours: number;
  actualHours: number;
  delayHours: number;
  cumulativeDelayHours: number;
  
  // Raw Environmental Snapshot (for ML & Full Audit Reconstructibility)
  inputSnapshot: WeatherInputSnapshot;

  // Environmental & Hydrodynamic Parameters
  beaufortForce: number;
  seaCondition: SeaCondition;
  relativeWindAngleDeg: number;
  relativeWaveAngleDeg: number;
  speedLoss: SpeedLossResult;
  colregsSpeedFactor: number;
  
  // Causal Classification & EPC Audit
  primaryCause: DelayTaxonomyEntry;
  etaAtWaypoint: Date;
  summary: string;
}

export interface RouteDelayIntegrationSummary {
  totalPlannedHours: number;
  totalActualHours: number;
  totalDelayHours: number;
  initialDepartureTime: Date;
  finalEta: Date;
  maxDelayWaypointIndex: number;
  legs: LegDelayResult[];
  activeThreatCount: number;
}

/**
 * COLREGS Rule 19 Safe Speed Reduction Factor:
 * In restricted visibility (sea fog, dense squall, sandstorm), master must proceed
 * at a safe speed adapted to prevailing visibility to avoid collision.
 */
export function colregsVisibilitySpeedFactor(visibilityMeters: number): number {
  if (visibilityMeters >= 3000) return 1.0; // Clear visibility
  if (visibilityMeters >= 1500) return 0.88;// Moderate haze / light fog
  if (visibilityMeters >= 800) return 0.70; // Sea fog (COLREGS safe speed ~70%)
  if (visibilityMeters >= 300) return 0.50; // Dense fog (speed halved)
  return 0.35;                              // Zero-visibility fog / blind navigation
}

/**
 * Computes route delay by integrating hydrodynamic speed loss and COLREGS 
 * restrictions leg-by-leg, propagating ETA timestamps forward.
 */
export function computeRouteDelay(
  waypoints: WaypointWeatherSample[],
  vessel: VesselProfile,
  plannedSpeedKnots: number = 14.5,
  isLaden: boolean = true,
  departureTime: Date = new Date()
): RouteDelayIntegrationSummary {
  const legs: LegDelayResult[] = [];
  let cumulativeTime = new Date(departureTime);
  let cumulativeDelay = 0;
  let totalPlannedHours = 0;
  let totalActualHours = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const legDist = wp.legDistanceNm || 0;

    // Handle origin point (0 distance)
    if (legDist <= 0.05 && i === 0) {
      legs.push({
        waypointIndex: 0,
        lat: wp.lat,
        lng: wp.lng,
        legDistanceNm: 0,
        plannedSpeedKnots,
        effectiveSpeedKnots: plannedSpeedKnots,
        plannedHours: 0,
        actualHours: 0,
        delayHours: 0,
        cumulativeDelayHours: 0,
        inputSnapshot: {
          windSpeedKnots: wp.windSpeedKnots,
          windSpeedMs: Number((wp.windSpeedKnots * 0.514444).toFixed(2)),
          windFromDeg: wp.windFromDeg,
          waveHeightM: wp.waveHeightM,
          waveFromDeg: wp.waveFromDeg,
          visibilityMeters: wp.visibilityMeters,
          weatherCode: wp.weatherCode,
          forecastHorizonHours: wp.forecastHorizonHours || 0,
          isClimatologicalFallback: wp.isClimatologicalFallback || false,
        },
        beaufortForce: windKnotsToBeaufort(wp.windSpeedKnots),
        seaCondition: "head",
        relativeWindAngleDeg: 0,
        relativeWaveAngleDeg: 0,
        speedLoss: kwonSpeedLoss(vessel, plannedSpeedKnots, 0, "head", isLaden),
        colregsSpeedFactor: 1.0,
        primaryCause: DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS,
        etaAtWaypoint: new Date(cumulativeTime),
        summary: "Departure Origin Pilot Station",
      });
      continue;
    }

    // 1. Determine Heading
    const heading =
      wp.nextLat !== undefined && wp.nextLng !== undefined
        ? forwardAzimuth(wp.lat, wp.lng, wp.nextLat, wp.nextLng)
        : legs.length > 0
          ? legs[legs.length - 1].relativeWindAngleDeg // Fallback to last bearing
          : 0;

    // 2. Compute Relative Encounter Angles
    const relWindAngle = relativeEncounterAngle(heading, wp.windFromDeg);
    const relWaveAngle = relativeEncounterAngle(heading, wp.waveFromDeg);
    
    // Wave action dominates added resistance; classify sea condition from wave angle
    const seaCondition = classifySeaCondition(relWaveAngle);
    const beaufort = windKnotsToBeaufort(wp.windSpeedKnots);

    // 3. Hydrodynamic Speed Loss (Kwon 2008)
    const speedLoss = kwonSpeedLoss(vessel, plannedSpeedKnots, beaufort, seaCondition, isLaden);

    // 4. COLREGS Visibility Restriction
    const visFactor = colregsVisibilitySpeedFactor(wp.visibilityMeters);

    // 5. Chokepoint Speed Limits & Queue Additions
    let mandatedSpeed = plannedSpeedKnots;
    let chokepointQueueHours = 0;

    if (wp.chokepoint) {
      mandatedSpeed = Math.min(plannedSpeedKnots, wp.chokepoint.speedLimitKnots);
      // If entering a canal system, add average queuing wait
      if (wp.isCanalLock && wp.chokepoint.averageQueuingHours > 0) {
        chokepointQueueHours = wp.chokepoint.averageQueuingHours;
      }
    }

    // Effective Speed: Combines Kwon hydrodynamic loss with COLREGS visibility factor
    const combinedSpeedLoss = Math.min(
      speedLoss.effectiveSpeedKnots,
      mandatedSpeed * visFactor
    );
    const effectiveSpeed = Math.max(vessel.minSteerageSpeedKnots, combinedSpeedLoss);

    // Leg Transit Time Calculations
    const plannedHours = legDist / Math.max(1.0, plannedSpeedKnots);
    const hydrodynamicTransitHours = legDist / Math.max(1.0, effectiveSpeed);
    const actualHours = hydrodynamicTransitHours + chokepointQueueHours;
    const legDelay = Math.max(0.0, actualHours - plannedHours);

    cumulativeDelay += legDelay;
    totalPlannedHours += plannedHours;
    totalActualHours += actualHours;

    // Determine Causal Taxonomy Attribution
    let primaryCause: DelayTaxonomyEntry = DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS;
    if (chokepointQueueHours > 0 && wp.chokepoint?.id === "Suez_Canal") {
      primaryCause = DELAY_TAXONOMY.SUEZ_CONVOY_QUEUE;
    } else if (chokepointQueueHours > 0 && wp.chokepoint?.id === "Panama_Canal") {
      primaryCause = DELAY_TAXONOMY.PANAMA_DRAFT_LOCK_RESTRICTION;
    } else if (visFactor < 0.85 && visFactor <= (1.0 - speedLoss.percentSpeedLoss)) {
      primaryCause = DELAY_TAXONOMY.VISIBILITY_FOG_COLREGS;
    } else if (wp.weatherCode >= 95) {
      primaryCause = DELAY_TAXONOMY.TROPICAL_CYCLONE_DIVERSION;
    } else if (seaCondition === "beam") {
      primaryCause = DELAY_TAXONOMY.WIND_WAVE_BEAM_SEAS;
    } else if (seaCondition === "following") {
      primaryCause = DELAY_TAXONOMY.WIND_WAVE_FOLLOWING_SEAS;
    } else {
      primaryCause = DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS;
    }

    // Advance Cumulative Timestamp for Downstream ETA Propagation
    cumulativeTime = new Date(cumulativeTime.getTime() + actualHours * 3600_000);

    const summary =
      legDelay > 0.1
        ? `${primaryCause.name}: ${beaufort >= 7 ? `Force ${beaufort} gale` : `${wp.windSpeedKnots} kn wind`}, ${seaCondition} seas (${wp.waveHeightM}m Hs) -> speed reduced from ${plannedSpeedKnots} to ${effectiveSpeed} kn (+${legDelay.toFixed(1)}h)`
        : `Normal passage: ${plannedSpeedKnots} kn scheduled (${effectiveSpeed} kn achieved)`;

    legs.push({
      waypointIndex: i,
      lat: wp.lat,
      lng: wp.lng,
      legDistanceNm: Number(legDist.toFixed(1)),
      plannedSpeedKnots,
      effectiveSpeedKnots: effectiveSpeed,
      plannedHours: Number(plannedHours.toFixed(2)),
      actualHours: Number(actualHours.toFixed(2)),
      delayHours: Number(legDelay.toFixed(2)),
      cumulativeDelayHours: Number(cumulativeDelay.toFixed(2)),
      inputSnapshot: {
        windSpeedKnots: wp.windSpeedKnots,
        windSpeedMs: Number((wp.windSpeedKnots * 0.514444).toFixed(2)),
        windFromDeg: wp.windFromDeg,
        waveHeightM: wp.waveHeightM,
        waveFromDeg: wp.waveFromDeg,
        visibilityMeters: wp.visibilityMeters,
        weatherCode: wp.weatherCode,
        forecastHorizonHours: wp.forecastHorizonHours || 0,
        isClimatologicalFallback: wp.isClimatologicalFallback || false,
      },
      beaufortForce: beaufort,
      seaCondition,
      relativeWindAngleDeg: relWindAngle,
      relativeWaveAngleDeg: relWaveAngle,
      speedLoss,
      colregsSpeedFactor: visFactor,
      primaryCause,
      etaAtWaypoint: new Date(cumulativeTime),
      summary,
    });
  }

  // Find waypoint with largest single delay impact
  let maxDelayWpIdx = 0;
  let maxDelayVal = 0;
  let activeThreats = 0;

  legs.forEach((leg, idx) => {
    if (leg.delayHours > maxDelayVal) {
      maxDelayVal = leg.delayHours;
      maxDelayWpIdx = idx;
    }
    if (leg.delayHours > 0.5 || leg.beaufortForce >= 7) {
      activeThreats++;
    }
  });

  return {
    totalPlannedHours: Number(totalPlannedHours.toFixed(1)),
    totalActualHours: Number(totalActualHours.toFixed(1)),
    totalDelayHours: Number(cumulativeDelay.toFixed(1)),
    initialDepartureTime: departureTime,
    finalEta: new Date(cumulativeTime),
    maxDelayWaypointIndex: maxDelayWpIdx,
    legs,
    activeThreatCount: activeThreats,
  };
}
