import assert from "node:assert/strict";
import {
  densifyRoute,
  slerpGreatCircle,
  haversineNm,
} from "../route-decomposition.ts";
import {
  bracketIndices,
  lerp,
  lerpAngle,
  interpolateAtTime,
} from "../weather-ingestion.ts";
import { resolveRouteDelay } from "../route-delay-orchestrator.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";

console.log("🌐 Starting Route Decomposition & Weather Ingestion Test Suite...\n");

// =========================================================================
// 1. Slerp & Route Densification Tests
// =========================================================================
console.log("🧪 1. Testing Slerp Great-Circle & Route Densification...");

// Haversine Mumbai (18.95°N, 72.85°E) to Singapore (1.29°N, 103.85°E)
const distMumSin = haversineNm(18.95, 72.85, 1.29, 103.85);
console.log(`   📏 Distance Mumbai -> Singapore: ${distMumSin} nm`);
assert(distMumSin > 2100 && distMumSin < 2300, "Distance should be ~2150 nm");

// Test Slerp midpoint
const midPt = slerpGreatCircle(18.95, 72.85, 1.29, 103.85, 0.5);
assert(midPt.lat > 9.0 && midPt.lat < 11.5, "Midpoint latitude should be ~10°N");
assert(midPt.lng > 86.0 && midPt.lng < 89.0, "Midpoint longitude should be ~88°E in Bay of Bengal");
console.log(`   📍 Midpoint (50% slerp): ${midPt.lat}°N, ${midPt.lng}°E`);

// Test Route Densification from Mumbai through Malacca to Singapore
const rawTrack = [
  { lat: 18.95, lng: 72.85 },   // Mumbai Port
  { lat: 5.80, lng: 80.50 },    // Sri Lanka South (Dondra Head)
  { lat: 5.50, lng: 97.50 },    // Malacca North Entrance
  { lat: 1.29, lng: 103.85 },   // Singapore
];

const waypoints = densifyRoute(rawTrack);
console.log(`   🛳️ Densified ${rawTrack.length} control points into ${waypoints.length} navigation waypoints.`);
assert(waypoints.length >= 40, "Should generate ~45-60 waypoints for ~2400 nm route");

// Verify that waypoints inside Malacca Strait are tagged as 'chokepoint_channel'
const malaccaWaypoints = waypoints.filter((wp) => wp.chokepoint?.id === "Strait_of_Malacca" || wp.chokepoint?.id === "Singapore_Strait");
console.log(`   🚧 Tagged ${malaccaWaypoints.length} waypoints in Malacca/Singapore Strait TSS.`);
assert(malaccaWaypoints.length > 0, "Must identify and tag Malacca chokepoint waypoints");
assert.equal(malaccaWaypoints[0].legType, "chokepoint_channel", "Leg type must be chokepoint_channel");

console.log("   ✅ Route decomposition & chokepoint classification passed!");

// =========================================================================
// 2. Binary Search & Circular Angle Interpolation Tests
// =========================================================================
console.log("🧪 2. Testing Binary Search & Circular Angular Interpolation...");

const times = [1000, 2000, 3000, 4000, 5000];
assert.deepEqual(bracketIndices(times, 500), [0, 0], "Before start -> [0, 0]");
assert.deepEqual(bracketIndices(times, 2500), [1, 2], "Between 2000 & 3000 -> [1, 2]");
assert.deepEqual(bracketIndices(times, 6000), [4, 4], "After end -> [4, 4]");

// Circular Lerp Angle: 350° to 10° at 50% fraction should be 0° (North), NOT 180° (South)!
const interpolatedNorth = lerpAngle(350, 10, 0.5);
assert.equal(interpolatedNorth, 0, `350° -> 10° at f=0.5 should be 0°, got ${interpolatedNorth}°`);

// Circular Lerp Angle: 10° to 350° at 50% fraction should be 0°
const interpolatedNorthRev = lerpAngle(10, 350, 0.5);
assert.equal(interpolatedNorthRev, 0, `10° -> 350° at f=0.5 should be 0°, got ${interpolatedNorthRev}°`);

// Regular Lerp Angle: 90° to 180° at 50% -> 135°
assert.equal(lerpAngle(90, 180, 0.5), 135);

console.log("   ✅ Binary search & circular angle interpolation passed!");

// =========================================================================
// 3. Hourly Weather Interpolation Tests
// =========================================================================
console.log("🧪 3. Testing Hourly Weather Series Interpolation & WMO Snapping...");

const baseTime = Date.now();
const testSeries = {
  times: [baseTime, baseTime + 3600_000, baseTime + 7200_000],
  windSpeedMs: [5.0, 10.0, 15.0],
  windDirectionDeg: [350, 10, 30],
  precipitationMmH: [0.0, 2.0, 8.0],
  weatherCode: [1, 65, 95], // Fair -> Rain -> Thunderstorm
  waveHeightM: [1.0, 2.5, 4.0],
  waveDirectionDeg: [350, 10, 30],
  swellHeightM: [0.8, 1.8, 3.2],
  visibilityM: [10000, 6000, 1500],
  forecastRunTime: baseTime,
};

// Query at 30 minutes past baseTime (f = 0.5 between hour 0 and hour 1)
const queryTime1 = new Date(baseTime + 1800_000);
const inter1 = interpolateAtTime(testSeries, queryTime1);

assert.equal(inter1.windSpeedMs, 7.5, "Wind speed at f=0.5 should be 7.5 m/s");
assert.equal(inter1.windFromDeg, 0, "Wind angle 350°->10° at f=0.5 should be 0°");
assert.equal(inter1.waveHeightM, 1.75, "Wave height at f=0.5 should be 1.75m");
assert.equal(inter1.forecastHorizonHours, 0.5, "Horizon should be 0.5h");

console.log("   ✅ Hourly weather interpolation & horizon tagging passed!");

// =========================================================================
// 4. Sequential ETA Propagation & Orchestrator Tests
// =========================================================================
console.log("🧪 4. Testing Sequential Two-Pass ETA Orchestrator...");

const departure = new Date("2026-09-01T06:00:00Z");

// Mock series fetcher that injects a gale at +24h into voyage
const mockFetcher = async (lat, lng) => {
  const startMs = departure.getTime();
  const times = Array.from({ length: 120 }, (_, i) => startMs + i * 3600_000);
  
  // High gale in the middle of the Bay of Bengal
  const isBayOfBengal = lat > 8.0 && lat < 14.0 && lng > 82.0 && lng < 92.0;

  return {
    times,
    windSpeedMs: times.map(() => (isBayOfBengal ? 18.0 : 6.0)), // 18 m/s = ~35 kn (Force 8)
    windDirectionDeg: times.map(() => 260),
    precipitationMmH: times.map(() => (isBayOfBengal ? 12.0 : 0.0)),
    weatherCode: times.map(() => (isBayOfBengal ? 95 : 1)),
    waveHeightM: times.map(() => (isBayOfBengal ? 5.2 : 1.2)),
    waveDirectionDeg: times.map(() => 260),
    swellHeightM: times.map(() => (isBayOfBengal ? 4.0 : 0.8)),
    visibilityM: times.map(() => (isBayOfBengal ? 2000 : 10000)),
    forecastRunTime: startMs,
  };
};

const resolvedRoute = await resolveRouteDelay(
  waypoints.slice(0, 15), // First 15 waypoints (~600 nm)
  VESSEL_PROFILES.HeavyLift_ProjectCargo,
  13.5, // 13.5 kn planned
  true,
  departure,
  mockFetcher
);

console.log(`   ⏱️ Resolved Route Orchestrator Results (${resolvedRoute.legs.length} legs):`);
console.log(`      • Total Distance:       ${resolvedRoute.totalDistanceNm} nm`);
console.log(`      • Planned Passage Time: ${resolvedRoute.totalPlannedHours} hrs`);
console.log(`      • Actual Passage Time:  ${resolvedRoute.totalActualHours} hrs`);
console.log(`      • Dynamic Delay:        +${resolvedRoute.totalDelayHours} hrs`);
console.log(`      • Active Weather Threats:${resolvedRoute.activeThreatCount}`);
console.log(`      • Final Propagated ETA: ${resolvedRoute.finalEta.toISOString()}`);
console.log(`      • Data Provenance:      ${resolvedRoute.dataProvenance.source}`);

assert(resolvedRoute.legs.length === 15, "Should have 15 evaluated legs");
assert(resolvedRoute.totalDelayHours > 0, "Bay of Bengal gale must cause cumulative delay");
assert(resolvedRoute.finalEta > resolvedRoute.initialDepartureTime, "Final ETA must be in the future");

console.log("   ✅ Sequential two-pass ETA cascade verified!");
console.log("\n🎉 ALL PHASE 2 & 3 ROUTE DECOMPOSITION AND WEATHER INGESTION TESTS PASSED! (100% Green)\n");
