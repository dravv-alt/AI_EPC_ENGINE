/**
 * ============================================================================
 * REAL-WORLD LIVE AIS INGESTION & REALIZATION TRACKING ADAPTER
 * ============================================================================
 * Normalizes multi-vendor AIS streaming pings (MarineTraffic, Spire Maritime, AISHub),
 * projects vessel positions onto decomposed route waypoints, detects berth arrival, 
 * and automatically triggers actual-vs-predicted drift records.
 */

import { ResolvedRouteAssessment } from "../route-delay-orchestrator";
import { QuantilePrediction } from "../ml/quantile-regression";
import { recordVoyageRealization, VoyageRealizationRecord } from "../jobs/drift-monitor";

export interface NormalizedAisPing {
  mmsi: string;
  imo?: string;
  vesselName?: string;
  latitude: number;
  longitude: number;
  speedOverGroundKnots: number;
  courseOverGroundDeg: number;
  headingDeg?: number;
  navigationalStatus: "under_way" | "at_anchor" | "moored" | "restricted_manoeuvrability" | "unknown";
  draughtMeters?: number;
  destinationPort?: string;
  etaUtc?: Date;
  timestampUtc: Date;
  vendor: "marinetraffic" | "spire" | "aishub" | "generic_nmea";
}

export interface MarineTrafficAisPayload {
  MMSI: string | number;
  IMO?: string | number;
  SHIPNAME?: string;
  LAT: string | number;
  LON: string | number;
  SPEED: string | number; // tenths of knot or knot
  HEADING?: string | number;
  COURSE?: string | number;
  STATUS?: string | number; // 0=under way, 1=at anchor, 5=moored
  DRAUGHT?: string | number;
  DESTINATION?: string;
  ETA?: string;
  TIMESTAMP: string;
}

export interface SpireAisPayload {
  mmsi: number | string;
  imo?: number | string;
  ship_name?: string;
  latitude: number;
  longitude: number;
  speed_over_ground: number;
  course_over_ground: number;
  heading?: number;
  navigational_status?: number | string;
  draught?: number;
  destination?: string;
  eta_utc?: string;
  timestamp_utc: string;
}

export interface AisTrackingStatus {
  shipmentId: string;
  mmsi: string;
  currentPing: NormalizedAisPing;
  closestWaypointIndex: number;
  distanceToDestinationNm: number;
  crossTrackErrorNm: number;
  isOffCourseRerouted: boolean;
  elapsedHours: number;
  realizedProgressPercent: number;
  currentRealizedDelayHours: number;
  hasArrivedAtDestination: boolean;
  realizationRecord?: VoyageRealizationRecord;
}

const NM_PER_KM = 0.539957;
const R_EARTH_KM = 6371.0088;

/**
 * Great-circle haversine distance in nautical miles.
 */
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH_KM * c * NM_PER_KM;
}

/**
 * Normalizes MarineTraffic JSON payload into standard format.
 */
export function normalizeMarineTrafficPing(payload: MarineTrafficAisPayload): NormalizedAisPing {
  const lat = Number(payload.LAT);
  const lon = Number(payload.LON);
  const sog = Number(payload.SPEED);
  const cog = Number(payload.COURSE ?? 0);
  const statusNum = Number(payload.STATUS ?? 0);

  let status: NormalizedAisPing["navigationalStatus"] = "under_way";
  if (statusNum === 1) status = "at_anchor";
  else if (statusNum === 5) status = "moored";
  else if (statusNum === 2) status = "restricted_manoeuvrability";

  return {
    mmsi: String(payload.MMSI),
    imo: payload.IMO ? String(payload.IMO) : undefined,
    vesselName: payload.SHIPNAME,
    latitude: lat,
    longitude: lon,
    speedOverGroundKnots: sog > 50 ? sog / 10 : sog, // handles tenths of knot format
    courseOverGroundDeg: cog,
    headingDeg: payload.HEADING ? Number(payload.HEADING) : undefined,
    navigationalStatus: status,
    draughtMeters: payload.DRAUGHT ? Number(payload.DRAUGHT) : undefined,
    destinationPort: payload.DESTINATION,
    etaUtc: payload.ETA ? new Date(payload.ETA) : undefined,
    timestampUtc: new Date(payload.TIMESTAMP),
    vendor: "marinetraffic",
  };
}

/**
 * Normalizes Spire Maritime JSON payload into standard format.
 */
export function normalizeSpirePing(payload: SpireAisPayload): NormalizedAisPing {
  const statusRaw = String(payload.navigational_status || "").toLowerCase();
  let status: NormalizedAisPing["navigationalStatus"] = "under_way";
  if (statusRaw.includes("anchor") || statusRaw === "1") status = "at_anchor";
  else if (statusRaw.includes("moored") || statusRaw === "5") status = "moored";

  return {
    mmsi: String(payload.mmsi),
    imo: payload.imo ? String(payload.imo) : undefined,
    vesselName: payload.ship_name,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speedOverGroundKnots: payload.speed_over_ground,
    courseOverGroundDeg: payload.course_over_ground,
    headingDeg: payload.heading,
    navigationalStatus: status,
    draughtMeters: payload.draught,
    destinationPort: payload.destination,
    etaUtc: payload.eta_utc ? new Date(payload.eta_utc) : undefined,
    timestampUtc: new Date(payload.timestamp_utc),
    vendor: "spire",
  };
}

/**
 * Ingests an AIS ping against an active planned shipment route assessment,
 * snaps position to waypoints, checks off-course status, and triggers arrival realizations.
 */
export function ingestAisPing(
  shipmentId: string,
  ping: NormalizedAisPing,
  assessment: ResolvedRouteAssessment,
  mlPrediction: QuantilePrediction
): AisTrackingStatus {
  const legs = assessment.legs;
  const totalLegs = legs.length;
  if (totalLegs === 0) {
    throw new Error(`Assessment for shipment ${shipmentId} contains no route legs.`);
  }

  // 1. Find closest route waypoint and cross-track error
  let minDistanceNm = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < totalLegs; i++) {
    const d = haversineNm(ping.latitude, ping.longitude, legs[i].lat, legs[i].lng);
    if (d < minDistanceNm) {
      minDistanceNm = d;
      closestIndex = i;
    }
  }

  const crossTrackErrorNm = Number(minDistanceNm.toFixed(2));
  const isOffCourseRerouted = crossTrackErrorNm > 40.0; // >40nm deviation indicates reroute

  // 2. Distance to destination port (last waypoint)
  const lastLeg = legs[totalLegs - 1];
  const distanceToDestinationNm = Number(
    haversineNm(ping.latitude, ping.longitude, lastLeg.lat, lastLeg.lng).toFixed(2)
  );

  // 3. Realized progress and elapsed time
  const elapsedHours = Number(
    Math.max(
      0.0,
      (ping.timestampUtc.getTime() - assessment.initialDepartureTime.getTime()) / 3600_000
    ).toFixed(2)
  );

  // Planned cumulative hours to reach the closest waypoint
  let plannedHoursToCurrent = 0;
  for (let i = 0; i <= closestIndex; i++) {
    plannedHoursToCurrent += legs[i].plannedHours;
  }

  const currentRealizedDelayHours = Number(
    Math.max(0.0, elapsedHours - plannedHoursToCurrent).toFixed(2)
  );

  const realizedProgressPercent = Number(
    Math.min(100.0, ((closestIndex + 1) / totalLegs) * 100).toFixed(1)
  );

  // 4. Geofence Berth Arrival Detection:
  // Within 3.0nm of destination port AND (SOG < 1.5 kn OR Moored/Anchored OR at final waypoint)
  const isWithinPortRadius = distanceToDestinationNm <= 3.0;
  const isVesselStopped = ping.speedOverGroundKnots <= 1.5 || ping.navigationalStatus === "moored";
  const hasArrivedAtDestination = isWithinPortRadius && (isVesselStopped || closestIndex === totalLegs - 1);

  let realizationRecord: VoyageRealizationRecord | undefined;
  if (hasArrivedAtDestination) {
    realizationRecord = recordVoyageRealization(
      shipmentId,
      ping.timestampUtc,
      assessment,
      mlPrediction
    );
  }

  return {
    shipmentId,
    mmsi: ping.mmsi,
    currentPing: ping,
    closestWaypointIndex: closestIndex,
    distanceToDestinationNm,
    crossTrackErrorNm,
    isOffCourseRerouted,
    elapsedHours,
    realizedProgressPercent,
    currentRealizedDelayHours,
    hasArrivedAtDestination,
    realizationRecord,
  };
}
