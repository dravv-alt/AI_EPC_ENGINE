import assert from "node:assert/strict";
import {
  normalizeMarineTrafficPing,
  normalizeSpirePing,
  ingestAisPing,
} from "../adapters/ais-ingestion-adapter.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";
import { DELAY_TAXONOMY } from "../delay-taxonomy.ts";

console.log("🛰️ Starting Live AIS Streaming & Real Data Ingestion Adapter Tests...\n");

// =========================================================================
// 1. MarineTraffic AIS Payload Normalization Test
// =========================================================================
console.log("🧪 1. Testing MarineTraffic AIS Payload Parsing...");

const mtPayload = {
  MMSI: "477995400",
  IMO: "9839438",
  SHIPNAME: "EVER GIVEN",
  LAT: "29.936",
  LON: "32.559",
  SPEED: "145", // 14.5 knots (in tenths of knot)
  COURSE: "350",
  HEADING: "349",
  STATUS: "0", // under way
  DRAUGHT: "15.7",
  DESTINATION: "ROTTERDAM",
  ETA: "2026-09-10T12:00:00Z",
  TIMESTAMP: "2026-09-02T14:30:00Z",
};

const normalizedMt = normalizeMarineTrafficPing(mtPayload);
console.log(`   📦 Normalized MarineTraffic Ping:`, {
  vessel: normalizedMt.vesselName,
  mmsi: normalizedMt.mmsi,
  lat: normalizedMt.latitude,
  lon: normalizedMt.longitude,
  sog: normalizedMt.speedOverGroundKnots,
  status: normalizedMt.navigationalStatus,
});

assert.equal(normalizedMt.mmsi, "477995400");
assert.equal(normalizedMt.vesselName, "EVER GIVEN");
assert.equal(normalizedMt.speedOverGroundKnots, 14.5);
assert.equal(normalizedMt.navigationalStatus, "under_way");
assert.equal(normalizedMt.vendor, "marinetraffic");
console.log("   ✅ MarineTraffic normalization passed!");

// =========================================================================
// 2. Spire Maritime AIS Payload Normalization Test
// =========================================================================
console.log("🧪 2. Testing Spire Maritime AIS Payload Parsing...");

const spirePayload = {
  mmsi: 636019827,
  imo: 9811000,
  ship_name: "CMA CGM ANTOINE DE SAINT EXUPERY",
  latitude: 51.95,
  longitude: 4.02,
  speed_over_ground: 0.8,
  course_over_ground: 110,
  navigational_status: "moored",
  draught: 16.0,
  destination: "NLRTM",
  eta_utc: "2026-09-05T08:00:00Z",
  timestamp_utc: "2026-09-05T08:15:00Z",
};

const normalizedSpire = normalizeSpirePing(spirePayload);
console.log(`   📦 Normalized Spire Ping:`, {
  vessel: normalizedSpire.vesselName,
  mmsi: normalizedSpire.mmsi,
  sog: normalizedSpire.speedOverGroundKnots,
  status: normalizedSpire.navigationalStatus,
});

assert.equal(normalizedSpire.mmsi, "636019827");
assert.equal(normalizedSpire.speedOverGroundKnots, 0.8);
assert.equal(normalizedSpire.navigationalStatus, "moored");
assert.equal(normalizedSpire.vendor, "spire");
console.log("   ✅ Spire Maritime normalization passed!");

// =========================================================================
// 3. Live Route Snapping & Delay Tracking Test
// =========================================================================
console.log("🧪 3. Testing Real-Time Route Snapping & Realized Delay Integration...");

const departure = new Date("2026-09-01T00:00:00Z");
const mockAssessment = {
  shipmentId: "SHP-MUM-RTM-001",
  vessel: VESSEL_PROFILES.Container_PostPanamax,
  totalDistanceNm: 6400,
  totalPlannedHours: 320,
  totalActualHours: 328.5,
  totalDelayHours: 8.5,
  initialDepartureTime: departure,
  finalEta: new Date(departure.getTime() + 328.5 * 3600_000),
  legs: [
    { waypointIndex: 0, lat: 18.93, lng: 72.82, plannedHours: 10, actualHours: 10, delayHours: 0, relativeWaveAngleDeg: 180, primaryCause: DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS },
    { waypointIndex: 1, lat: 12.50, lng: 45.00, plannedHours: 80, actualHours: 82, delayHours: 2, relativeWaveAngleDeg: 180, primaryCause: DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS },
    { waypointIndex: 2, lat: 29.93, lng: 32.55, plannedHours: 140, actualHours: 146, delayHours: 6, relativeWaveAngleDeg: 0, primaryCause: DELAY_TAXONOMY.SUEZ_CONVOY_QUEUE },
    { waypointIndex: 3, lat: 51.95, lng: 4.02, plannedHours: 90, actualHours: 90.5, delayHours: 0.5, relativeWaveAngleDeg: 90, primaryCause: DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS }, // Destination Port (Rotterdam)
  ],
};

const mockMl = {
  p10: 7.0,
  p50: 8.9,
  p90: 11.2,
  uncertaintyBandHours: 4.2,
  confidenceScore: 0.88,
};

// Vessel ping midway at Suez (29.93°, 32.55°) 235 hours into voyage (planned: 230h -> +5.0h realized delay)
const midVoyagePing = {
  mmsi: "477995400",
  latitude: 29.935,
  longitude: 32.558,
  speedOverGroundKnots: 8.5,
  courseOverGroundDeg: 350,
  navigationalStatus: "under_way",
  timestampUtc: new Date(departure.getTime() + 235 * 3600_000),
  vendor: "marinetraffic",
};

const midStatus = ingestAisPing("SHP-MUM-RTM-001", midVoyagePing, mockAssessment, mockMl);
console.log(`   📍 Mid-Voyage Ingestion Status:`, {
  closestWaypoint: midStatus.closestWaypointIndex,
  crossTrackErrorNm: midStatus.crossTrackErrorNm,
  progress: `${midStatus.realizedProgressPercent}%`,
  elapsedHours: midStatus.elapsedHours,
  currentRealizedDelayHours: midStatus.currentRealizedDelayHours,
  hasArrived: midStatus.hasArrivedAtDestination,
});

assert.equal(midStatus.closestWaypointIndex, 2); // Suez
assert.equal(midStatus.isOffCourseRerouted, false);
assert.equal(midStatus.hasArrivedAtDestination, false);
assert(midStatus.currentRealizedDelayHours >= 4.5);
console.log("   ✅ Mid-voyage projection & delay tracking verified!");

// =========================================================================
// 4. Berth Arrival Detection & Automated Realization Trigger Test
// =========================================================================
console.log("🧪 4. Testing Port Geofence Arrival & Auto-Realization Record Trigger...");

// Vessel arrives at Rotterdam (51.951°, 4.022°) and moors (SOG 0.5 kn) at 328.7 hours
const arrivalPing = {
  mmsi: "477995400",
  latitude: 51.951,
  longitude: 4.022,
  speedOverGroundKnots: 0.5,
  courseOverGroundDeg: 90,
  navigationalStatus: "moored",
  timestampUtc: new Date(departure.getTime() + 328.7 * 3600_000),
  vendor: "spire",
};

const arrivalStatus = ingestAisPing("SHP-MUM-RTM-001", arrivalPing, mockAssessment, mockMl);
console.log(`   ⚓ Destination Arrival Status:`, {
  hasArrived: arrivalStatus.hasArrivedAtDestination,
  distanceToDestinationNm: arrivalStatus.distanceToDestinationNm,
  realizationId: arrivalStatus.realizationRecord?.id,
  realizedDelay: `${arrivalStatus.realizationRecord?.actualRealizedDelayHours}h`,
  physicsError: `${arrivalStatus.realizationRecord?.physicsErrorHours}h`,
  mlP50Error: `${arrivalStatus.realizationRecord?.mlP50ErrorHours}h`,
  insideP10P90Band: arrivalStatus.realizationRecord?.isWithinP10P90Band,
});

assert.equal(arrivalStatus.hasArrivedAtDestination, true);
assert(arrivalStatus.realizationRecord !== undefined);
assert.equal(arrivalStatus.realizationRecord.actualRealizedDelayHours, 8.7);
assert.equal(arrivalStatus.realizationRecord.physicsErrorHours, 0.2); // |8.7 - 8.5|
assert.equal(arrivalStatus.realizationRecord.mlP50ErrorHours, 0.2);   // |8.7 - 8.9|
assert.equal(arrivalStatus.realizationRecord.isWithinP10P90Band, true);

console.log("   ✅ Destination arrival geofence & automated realization logging verified!");
console.log("\n🎉 ALL AIS ADAPTER & REAL-DATA INGESTION TESTS PASSED! (100% Green)\n");
