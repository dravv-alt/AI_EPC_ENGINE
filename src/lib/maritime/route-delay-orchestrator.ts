/**
 * ============================================================================
 * ROUTE DELAY ORCHESTRATOR & TWO-PASS ITERATIVE RESOLVER
 * ============================================================================
 * Closes the feedback loop between Route Decomposition (Phase 2), 
 * Dual Weather Ingestion (Phase 3), and Kwon Physics / Delay Integrator (Phase 1).
 * 
 * Two-Pass Execution:
 * Pass 1: Naive ETA estimation assuming calm water, establishing forecast query envelopes.
 * Pass 2: Sequential step-by-step propagation where Waypoint N+1 queries weather at its
 *         dynamically corrected ETA timestamp resulting from Waypoint N's speed loss.
 */

import { DecomposedWaypoint } from "./route-decomposition";
import { fetchHourlyWeatherSeries, HourlyWeatherSeries, interpolateAtTime, InterpolatedWeather } from "./weather-ingestion";
import { computeRouteDelay, LegDelayResult, RouteDelayIntegrationSummary, WaypointWeatherSample } from "./delay-integrator";
import { VesselProfile } from "./vessel-profiles";

export interface ResolvedRouteAssessment {
  vessel: VesselProfile;
  totalDistanceNm: number;
  totalPlannedHours: number;
  totalActualHours: number;
  totalDelayHours: number;
  initialDepartureTime: Date;
  finalEta: Date;
  activeThreatCount: number;
  maxDelayWaypointIndex: number;
  legs: LegDelayResult[];
  sampledWeather: InterpolatedWeather[];
  dataProvenance: {
    source: string;
    evaluatedAt: string;
    forecastHorizonHours: number;
    hasClimatologicalFallback: boolean;
  };
}

/**
 * Resolves full hydrodynamic delay with sequential ETA propagation across all waypoints.
 */
export async function resolveRouteDelay(
  waypoints: DecomposedWaypoint[],
  vessel: VesselProfile,
  plannedSpeedKnots: number = 14.5,
  isLaden: boolean = true,
  departureTime: Date = new Date(),
  customFetchSeries?: (lat: number, lng: number) => Promise<HourlyWeatherSeries>
): Promise<ResolvedRouteAssessment> {
  if (waypoints.length === 0) {
    return {
      vessel,
      totalDistanceNm: 0,
      totalPlannedHours: 0,
      totalActualHours: 0,
      totalDelayHours: 0,
      initialDepartureTime: departureTime,
      finalEta: departureTime,
      activeThreatCount: 0,
      maxDelayWaypointIndex: 0,
      legs: [],
      sampledWeather: [],
      dataProvenance: {
        source: "No waypoints provided",
        evaluatedAt: new Date().toISOString(),
        forecastHorizonHours: 0,
        hasClimatologicalFallback: false,
      },
    };
  }

  const fetcher = customFetchSeries || fetchHourlyWeatherSeries;
  const weatherSamples: WaypointWeatherSample[] = [];
  const interpolatedList: InterpolatedWeather[] = [];
  let cumulativeTime = new Date(departureTime);
  let hasClimatological = false;
  let maxHorizonHours = 0;

  // Pass 2: Sequential Step-by-Step Propagation
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const nextWp = waypoints[i + 1];

    // Fetch or cache-lookup hourly weather series for this spatial coordinate
    const series = await fetcher(wp.lat, wp.lng);

    // Interpolate exact atmospheric & oceanographic conditions at current cumulative ETA
    const weather = interpolateAtTime(series, cumulativeTime);
    interpolatedList.push(weather);

    if (weather.isClimatologicalFallback) hasClimatological = true;
    if (weather.forecastHorizonHours > maxHorizonHours) {
      maxHorizonHours = weather.forecastHorizonHours;
    }

    // Build the weather sample for the numerical delay integrator
    const sample: WaypointWeatherSample = {
      waypointIndex: i,
      lat: wp.lat,
      lng: wp.lng,
      nextLat: nextWp?.lat,
      nextLng: nextWp?.lng,
      legDistanceNm: wp.distanceToNextNm,
      windSpeedKnots: weather.windSpeedKnots,
      windFromDeg: weather.windFromDeg,
      waveHeightM: weather.waveHeightM,
      waveFromDeg: weather.waveFromDeg,
      visibilityMeters: weather.visibilityM,
      weatherCode: weather.weatherCode,
      chokepoint: wp.chokepoint,
      isCanalLock: wp.isCanalLock,
    };

    weatherSamples.push(sample);

    // Run single-leg delay calculation to determine arrival timestamp at next waypoint
    const singleLegSummary = computeRouteDelay(
      [sample],
      vessel,
      plannedSpeedKnots,
      isLaden,
      cumulativeTime
    );

    if (singleLegSummary.legs.length > 0) {
      const legRes = singleLegSummary.legs[0];
      // Propagate forward: next waypoint's weather will be queried at this exact updated timestamp
      cumulativeTime = legRes.etaAtWaypoint;
    }
  }

  // Full integration pass across all synchronized samples
  const finalSummary: RouteDelayIntegrationSummary = computeRouteDelay(
    weatherSamples,
    vessel,
    plannedSpeedKnots,
    isLaden,
    departureTime
  );

  return {
    vessel,
    totalDistanceNm: waypoints[waypoints.length - 1]?.cumulativeDistanceNm || 0,
    totalPlannedHours: finalSummary.totalPlannedHours,
    totalActualHours: finalSummary.totalActualHours,
    totalDelayHours: finalSummary.totalDelayHours,
    initialDepartureTime: departureTime,
    finalEta: finalSummary.finalEta,
    activeThreatCount: finalSummary.activeThreatCount,
    maxDelayWaypointIndex: finalSummary.maxDelayWaypointIndex,
    legs: finalSummary.legs,
    sampledWeather: interpolatedList,
    dataProvenance: {
      source: "Open-Meteo ECMWF/GFS Atmospheric & Marine NWP Models",
      evaluatedAt: new Date().toISOString(),
      forecastHorizonHours: maxHorizonHours,
      hasClimatologicalFallback: hasClimatological,
    },
  };
}
