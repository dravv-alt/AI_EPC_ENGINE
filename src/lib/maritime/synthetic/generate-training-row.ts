/**
 * ============================================================================
 * SYNTHETIC TRAINING ROW GENERATOR
 * ============================================================================
 * Runs the sequential two-pass physics engine over real historical reanalysis 
 * weather (ERA5), extracts clean leg telemetry, and applies structured 
 * operational noise to generate ground-truth training records.
 */

import { GeneratedScenario } from "./scenario-generator";
import { fetchHistoricalWeatherSeries } from "./historical-weather-client";
import { interpolateAtTime } from "../weather-ingestion";
import { computeRouteDelay, LegDelayResult, WaypointWeatherSample } from "../delay-integrator";
import { applyOperationalNoise } from "./noise-model";

export interface SyntheticLegRecord extends LegDelayResult {
  cleanDelayHours: number;
  noisyLegDelayHours: number;
}

export interface SyntheticTrainingRow {
  scenarioId: string;
  laneId: string;
  laneName: string;
  vesselClass: string;
  isLaden: boolean;
  departureTime: string;
  totalDistanceNm: number;
  totalPlannedHours: number;
  cleanPhysicsDelayHours: number;
  noisyGroundTruthDelayHours: number;
  noiseDeltaHours: number;
  hasOperationalDisruption: boolean;
  activeThreatCount: number;
  legs: SyntheticLegRecord[];
  datasetMetadata: {
    generatedAt: string;
    physicsVersion: string;
    weatherSource: string;
  };
}

/**
 * Generates a full ground-truth training record for a single scenario.
 */
export async function generateTrainingRow(
  scenario: GeneratedScenario
): Promise<SyntheticTrainingRow> {
  const { waypoints, vessel, isLaden, departureTime } = scenario;
  const weatherSamples: WaypointWeatherSample[] = [];
  let cumulativeTime = new Date(departureTime);

  // Sequential Two-Pass Physics Run over Real Historical Weather
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const nextWp = waypoints[i + 1];

    // Query real historical weather archive at this spatial coordinate
    const series = await fetchHistoricalWeatherSeries(wp.lat, wp.lng, cumulativeTime);
    const weather = interpolateAtTime(series, cumulativeTime);

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
      forecastHorizonHours: weather.forecastHorizonHours,
      isClimatologicalFallback: weather.isClimatologicalFallback,
      chokepoint: wp.chokepoint,
      isCanalLock: wp.isCanalLock,
    };

    weatherSamples.push(sample);

    // Single-leg advance to update timestamp for next waypoint's historical lookup
    const singleLeg = computeRouteDelay(
      [sample],
      vessel,
      vessel.serviceSpeedKnots,
      isLaden,
      cumulativeTime
    );

    if (singleLeg.legs.length > 0) {
      cumulativeTime = singleLeg.legs[0].etaAtWaypoint;
    }
  }

  // Full integration summary
  const summary = computeRouteDelay(
    weatherSamples,
    vessel,
    vessel.serviceSpeedKnots,
    isLaden,
    departureTime
  );

  const cleanDelay = summary.totalDelayHours;
  const noiseResult = applyOperationalNoise(cleanDelay, scenario);

  // Distribute operational noise proportionately across legs
  let maxDelayLegIdx = 0;
  let maxLegDelay = 0;
  summary.legs.forEach((l, idx) => {
    if (l.delayHours > maxLegDelay) {
      maxLegDelay = l.delayHours;
      maxDelayLegIdx = idx;
    }
  });

  const enrichedLegs: SyntheticLegRecord[] = summary.legs.map((leg, idx) => {
    const share = cleanDelay > 0 ? leg.delayHours / cleanDelay : 1 / summary.legs.length;
    const gaussianShare = noiseResult.gaussianComponent * share;
    const cauchyShare = noiseResult.hasTailEvent && idx === maxDelayLegIdx ? noiseResult.cauchyComponent : 0;
    const noisyLegDelay = Number(Math.max(0.0, leg.delayHours + gaussianShare + cauchyShare).toFixed(2));

    return {
      ...leg,
      cleanDelayHours: leg.delayHours,
      noisyLegDelayHours: noisyLegDelay,
    };
  });

  return {
    scenarioId: scenario.id,
    laneId: scenario.lane.id,
    laneName: scenario.lane.name,
    vesselClass: scenario.vesselClass,
    isLaden: scenario.isLaden,
    departureTime: scenario.departureTime.toISOString(),
    totalDistanceNm: waypoints[waypoints.length - 1]?.cumulativeDistanceNm || 0,
    totalPlannedHours: summary.totalPlannedHours,
    cleanPhysicsDelayHours: cleanDelay,
    noisyGroundTruthDelayHours: noiseResult.noisyDelayHours,
    noiseDeltaHours: Number((noiseResult.noisyDelayHours - cleanDelay).toFixed(2)),
    hasOperationalDisruption: noiseResult.hasTailEvent,
    activeThreatCount: summary.activeThreatCount,
    legs: enrichedLegs,
    datasetMetadata: {
      generatedAt: new Date().toISOString(),
      physicsVersion: "kwon-2008-structured-v1",
      weatherSource: "Open-Meteo ERA5 / NOAA Reanalysis Archive",
    },
  };
}
