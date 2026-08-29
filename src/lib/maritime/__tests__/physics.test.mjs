import assert from "node:assert/strict";
import {
  windSpeedToBeaufort,
  windKnotsToBeaufort,
  beaufortToMeanKnots,
  BEAUFORT_TABLE,
} from "../beaufort.ts";
import {
  relativeEncounterAngle,
  classifySeaCondition,
  forwardAzimuth,
} from "../relative-angle.ts";
import {
  kwonSpeedLoss,
  froudeNumber,
  calculateDirectionCoefficient,
} from "../kwon-speed-loss.ts";
import {
  computeRouteDelay,
  colregsVisibilitySpeedFactor,
} from "../delay-integrator.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";
import { MARITIME_CHOKEPOINTS } from "../chokepoints.ts";

console.log("⚓ Starting Maritime Physics Engine Unit Test Suite...\n");

// =========================================================================
// 1. Beaufort Scale Boundary Tests
// =========================================================================
console.log("🧪 1. Testing Beaufort Conversion & Clamping Boundaries...");
assert.equal(windSpeedToBeaufort(0), 0, "0 m/s should be Force 0");
assert.equal(windSpeedToBeaufort(-10), 0, "Negative speed clamped to 0");
assert.equal(windSpeedToBeaufort(0.5), 1, "0.5 m/s should be Force 1");
assert.equal(windSpeedToBeaufort(8.5), 5, "8.5 m/s should be Force 5");
assert.equal(windSpeedToBeaufort(15.0), 7, "15.0 m/s should be Force 7");
assert.equal(windSpeedToBeaufort(26.0), 10, "26.0 m/s should be Force 10");
assert.equal(windSpeedToBeaufort(35.0), 12, "35.0 m/s should be Force 12 (Hurricane)");
assert.equal(windSpeedToBeaufort(120.0), 12, "Extreme speeds clamped to 12");

// Test Knots conversion
assert.equal(windKnotsToBeaufort(15), 4, "15 kn should be Force 4");
assert.equal(windKnotsToBeaufort(30), 7, "30 kn should be Force 7 (Near Gale)");
assert.equal(windKnotsToBeaufort(50), 10, "50 kn should be Force 10 (Storm)");

console.log("   ✅ Beaufort conversions passed!");

// =========================================================================
// 2. Relative Encounter Angle & Vector Trigonometry Tests
// =========================================================================
console.log("🧪 2. Testing Vector Encounter Trigonometry & Sea Regimes...");

// Ship heading North (0°), Wind from North (0°) -> Head Wind (0°)
assert.equal(relativeEncounterAngle(0, 0), 0);
assert.equal(classifySeaCondition(0), "head");

// Ship heading North (0°), Wind from East (90°) -> Beam Wind (90°)
assert.equal(relativeEncounterAngle(0, 90), 90);
assert.equal(classifySeaCondition(90), "beam");

// Ship heading North (0°), Wind from South (180°) -> Following Wind (180°)
assert.equal(relativeEncounterAngle(0, 180), 180);
assert.equal(classifySeaCondition(180), "following");

// Ship heading West (270°), Wind from North (0°) -> 90°
assert.equal(relativeEncounterAngle(270, 0), 90);

// Ship heading 350°, Wind from 10° -> 20° (Head)
assert.equal(relativeEncounterAngle(350, 10), 20);
assert.equal(classifySeaCondition(20), "head");

// Geodesic Forward Azimuth: Mumbai (18.95°N, 72.85°E) to Aden (12.78°N, 45.02°E) -> ~261.2° (WSW)
const bearingMumAden = forwardAzimuth(18.95, 72.85, 12.78, 45.02);
assert(bearingMumAden >= 255 && bearingMumAden <= 265, `Mumbai->Aden bearing ${bearingMumAden}° should be ~261.2°`);
console.log(`   ✅ Forward azimuth (Mumbai -> Aden): ${bearingMumAden}°`);
console.log("   ✅ Relative angle trigonometry passed!");

// =========================================================================
// 3. Kwon (2008) Added-Resistance & Speed-Loss Tests
// =========================================================================
console.log("🧪 3. Testing Kwon (2008) Added Resistance Directionality...");

const vessel = VESSEL_PROFILES.Container_PostPanamax; // 10k TEU, Lpp=320m, Vs=20kn
const plannedSpeed = 20.0;

// Test A: Force 8 Gale in Head Seas (0°)
const headGale = kwonSpeedLoss(vessel, plannedSpeed, 8, "head", true);
// Test B: Force 8 Gale in Beam Seas (90°)
const beamGale = kwonSpeedLoss(vessel, plannedSpeed, 8, "beam", true);
// Test C: Force 8 Gale in Following Seas (180°)
const followingGale = kwonSpeedLoss(vessel, plannedSpeed, 8, "following", true);

console.log(`   📊 Force 8 Gale on 10k TEU Container Ship (Planned: ${plannedSpeed} kn):`);
console.log(`      • Head Seas:      Achieved ${headGale.effectiveSpeedKnots} kn (${(headGale.percentSpeedLoss * 100).toFixed(1)}% loss)`);
console.log(`      • Beam Seas:      Achieved ${beamGale.effectiveSpeedKnots} kn (${(beamGale.percentSpeedLoss * 100).toFixed(1)}% loss)`);
console.log(`      • Following Seas: Achieved ${followingGale.effectiveSpeedKnots} kn (${(followingGale.percentSpeedLoss * 100).toFixed(1)}% loss)`);

// Verification: Head seas must cause strictly higher speed loss than beam, which is strictly higher than following
assert(headGale.percentSpeedLoss > beamGale.percentSpeedLoss, "Head seas loss must exceed beam seas loss");
assert(beamGale.percentSpeedLoss > followingGale.percentSpeedLoss, "Beam seas loss must exceed following seas loss");
assert(headGale.effectiveSpeedKnots >= vessel.minSteerageSpeedKnots, "Speed must maintain minimum steerage");

console.log("   ✅ Kwon (2008) hydrodynamic directionality verified!");

// =========================================================================
// 4. Route Numerical Integrator & ETA Propagation Tests
// =========================================================================
console.log("🧪 4. Testing Route Leg Integration & Downstream ETA Propagation...");

const departure = new Date("2026-09-01T00:00:00Z");
const testWaypoints = [
  // Wp 0: Origin (Mumbai)
  {
    waypointIndex: 0,
    lat: 18.95,
    lng: 72.85,
    nextLat: 18.50,
    nextLng: 71.50,
    legDistanceNm: 0,
    windSpeedKnots: 12,
    windFromDeg: 270,
    waveHeightM: 1.2,
    waveFromDeg: 270,
    visibilityMeters: 10000,
    weatherCode: 1,
  },
  // Wp 1: Arabian Sea (Calm leg, 100nm)
  {
    waypointIndex: 1,
    lat: 18.50,
    lng: 71.50,
    nextLat: 16.00,
    nextLng: 65.00,
    legDistanceNm: 100,
    windSpeedKnots: 15,
    windFromDeg: 90, // Following wind
    waveHeightM: 1.5,
    waveFromDeg: 90,
    visibilityMeters: 10000,
    weatherCode: 2,
  },
  // Wp 2: Arabian Sea Gale Cell (Head seas, 200nm, Force 8 Gale)
  {
    waypointIndex: 2,
    lat: 16.00,
    lng: 65.00,
    nextLat: 13.00,
    nextLng: 50.00,
    legDistanceNm: 200,
    windSpeedKnots: 38, // Force 8 Gale
    windFromDeg: 255,   // Directly opposing ship heading (~255°)
    waveHeightM: 5.5,
    waveFromDeg: 255,
    visibilityMeters: 6000,
    weatherCode: 65,
  },
  // Wp 3: Gulf of Aden Approach (Dense Sea Fog COLREGS restriction, 150nm)
  {
    waypointIndex: 3,
    lat: 13.00,
    lng: 50.00,
    nextLat: 12.78,
    nextLng: 45.02,
    legDistanceNm: 150,
    windSpeedKnots: 10,
    windFromDeg: 200,
    waveHeightM: 1.0,
    waveFromDeg: 200,
    visibilityMeters: 600, // Dense Fog -> COLREGS safe speed reduction
    weatherCode: 45,
  },
  // Wp 4: Destination Pilot Station (Aden)
  {
    waypointIndex: 4,
    lat: 12.78,
    lng: 45.02,
    legDistanceNm: 50,
    windSpeedKnots: 12,
    windFromDeg: 180,
    waveHeightM: 1.2,
    waveFromDeg: 180,
    visibilityMeters: 10000,
    weatherCode: 1,
  },
];

const routeResult = computeRouteDelay(
  testWaypoints,
  VESSEL_PROFILES.Container_PostPanamax,
  20.0, // 20 kn planned
  true,
  departure
);

console.log(`   ⏱️ Route Delay Integration Results (Total Distance: 500 nm):`);
console.log(`      • Total Planned Passage Time: ${routeResult.totalPlannedHours} hrs`);
console.log(`      • Total Actual Passage Time:  ${routeResult.totalActualHours} hrs`);
console.log(`      • Total Dynamic Delay:        +${routeResult.totalDelayHours} hrs`);
console.log(`      • Scheduled Departure:        ${routeResult.initialDepartureTime.toISOString()}`);
console.log(`      • Propagated Final ETA:       ${routeResult.finalEta.toISOString()}`);

assert(routeResult.totalDelayHours > 0, "Severe gale and fog legs must produce cumulative delay");
assert(routeResult.legs.length === 5, "Must produce 5 leg evaluation results");

// Check leg 2 (Gale) cause
const galeLeg = routeResult.legs[2];
assert.equal(galeLeg.seaCondition, "head", "Gale leg must be classified as head seas");
assert.equal(galeLeg.primaryCause.code, "WIND_WAVE_HEAD_SEAS", "Gale leg primary cause must be WIND_WAVE_HEAD_SEAS");

// Check leg 3 (Fog) cause
const fogLeg = routeResult.legs[3];
assert.equal(fogLeg.primaryCause.code, "VISIBILITY_FOG_COLREGS", "Fog leg primary cause must be VISIBILITY_FOG_COLREGS");

console.log("   ✅ Route delay integration and causal classification verified!");
console.log("\n🎉 ALL MARITIME PHYSICS BASELINE TESTS PASSED SUCCESSFULLY! (100% Green)\n");
