import assert from "node:assert/strict";
import {
  recordVoyageRealization,
  computeDriftMetrics,
} from "../jobs/drift-monitor.ts";
import {
  buildComprehensiveExplanation,
} from "../causal-explainability.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";
import { DELAY_TAXONOMY } from "../delay-taxonomy.ts";

console.log("🚢 Starting Phase 7 & 8 Production Telemetry & Causal Explainability Tests...\n");

// =========================================================================
// 1. Two-Tier Causal Explainability Tests (Kwon Physical Decomposition + ML Residual)
// =========================================================================
console.log("🧪 1. Testing Two-Tier Causal Explainability Decomposition...");

const departure = new Date("2026-09-01T00:00:00Z");
const mockAssessment = {
  shipmentId: "SHP-MUM-RTM-001",
  vessel: VESSEL_PROFILES.Container_PostPanamax,
  totalDistanceNm: 6420,
  totalPlannedHours: 320,
  totalActualHours: 328.5,
  totalDelayHours: 8.5,
  initialDepartureTime: departure,
  finalEta: new Date(departure.getTime() + 328.5 * 3600_000),
  maxDelayWaypointIndex: 2,
  activeThreatCount: 2,
  dataProvenance: {
    source: "Open-Meteo Multi-Grid NWP",
    forecastHorizonHours: 72,
    hasClimatologicalFallback: false,
  },
  legs: [
    {
      waypointIndex: 1,
      lat: 18.0,
      lng: 70.0,
      legDistanceNm: 250,
      plannedSpeedKnots: 20.0,
      effectiveSpeedKnots: 16.5,
      plannedHours: 12.5,
      actualHours: 15.2,
      delayHours: 2.7,
      cumulativeDelayHours: 2.7,
      relativeWaveAngleDeg: 170, // Direct Head Seas
      primaryCause: DELAY_TAXONOMY.WIND_WAVE_HEAD_SEAS,
      inputSnapshot: {
        windSpeedKnots: 34,
        windSpeedMs: 17.5,
        windFromDeg: 260,
        waveHeightM: 4.2,
        waveFromDeg: 260,
        visibilityMeters: 8000,
        weatherCode: 65,
        forecastHorizonHours: 24,
        isClimatologicalFallback: false,
      },
      beaufortForce: 8,
      seaCondition: "head",
      relativeWindAngleDeg: 170,
      speedLoss: { speedLossKnots: 3.5, percentSpeedLoss: 17.5, effectiveSpeedKnots: 16.5, isSteerageRestricted: false, froudeNumber: 0.19, deltaVVsPercent: 17.5 },
      colregsSpeedFactor: 1.0,
      etaAtWaypoint: new Date(departure.getTime() + 15.2 * 3600_000),
      summary: "Gale Force 8 Head Seas",
    },
    {
      waypointIndex: 2,
      lat: 29.9,
      lng: 32.55, // Suez Canal
      legDistanceNm: 100,
      plannedSpeedKnots: 10.0,
      effectiveSpeedKnots: 5.0,
      plannedHours: 10.0,
      actualHours: 15.8,
      delayHours: 5.8,
      cumulativeDelayHours: 8.5,
      relativeWaveAngleDeg: 0,
      primaryCause: DELAY_TAXONOMY.SUEZ_CONVOY_QUEUE,
      inputSnapshot: {
        windSpeedKnots: 12,
        windSpeedMs: 6.0,
        windFromDeg: 180,
        waveHeightM: 0.5,
        waveFromDeg: 180,
        visibilityMeters: 10000,
        weatherCode: 0,
        forecastHorizonHours: 120,
        isClimatologicalFallback: false,
      },
      beaufortForce: 4,
      seaCondition: "following",
      relativeWindAngleDeg: 0,
      speedLoss: { speedLossKnots: 0, percentSpeedLoss: 0, effectiveSpeedKnots: 10.0, isSteerageRestricted: false, froudeNumber: 0.1, deltaVVsPercent: 0 },
      colregsSpeedFactor: 1.0,
      etaAtWaypoint: new Date(departure.getTime() + 31.0 * 3600_000),
      summary: "Suez Canal Transit Convoy Queue",
    },
  ],
};

const mockMlPrediction = {
  p10: 7.2,
  p50: 8.9, // +0.4h ML operational adjustment over physics 8.5h
  p90: 11.5,
  uncertaintyBandHours: 4.3,
  confidenceScore: 0.88,
};

const explanation = buildComprehensiveExplanation(
  mockAssessment.shipmentId,
  mockAssessment,
  mockMlPrediction
);

console.log(`   💡 Total Calibrated Delay: +${explanation.totalPredictedDelayHours}h`);
console.log(`   📐 Physics Baseline:        +${explanation.physicsBaselineHours}h`);
console.log(`   🧠 ML Operational Adjust:   ${explanation.mlOperationalAdjustmentHours >= 0 ? "+" : ""}${explanation.mlOperationalAdjustmentHours}h`);
console.log(`   🎯 Confidence Score:        ${Math.round(explanation.confidenceScore * 100)}%`);
console.log(`   📊 Factor Breakdown (${explanation.factors.length} components):`);
explanation.factors.forEach((f) => {
  console.log(`      • ${f.label}: ${f.delayHours > 0 ? "+" : ""}${f.delayHours}h (${f.percentageOfTotal}%) - ${f.description}`);
});

assert.equal(explanation.totalPredictedDelayHours, 8.9);
assert.equal(explanation.physicsBaselineHours, 8.5);
assert.equal(explanation.mlOperationalAdjustmentHours, 0.4);
assert(explanation.factors.length >= 3, "Must include physical factors and ML adjustment");

console.log("   ✅ Two-tier causal decomposition verified!");

// =========================================================================
// 2. Production Drift Monitoring & Actual-vs-Predicted Tracking Tests
// =========================================================================
console.log("🧪 2. Testing Production Drift Tracking & Realized Errors...");

// Simulate 5 completed voyages
const actualArrival = new Date(departure.getTime() + (320 + 8.7) * 3600_000); // Actual realized delay: 8.7h
const realization = recordVoyageRealization(
  mockAssessment.shipmentId,
  actualArrival,
  mockAssessment,
  mockMlPrediction
);

console.log(`   📝 Logged Voyage Realization:`);
console.log(`      • Realized Delay: ${realization.actualRealizedDelayHours} hrs`);
console.log(`      • Physics Error:  ${realization.physicsErrorHours} hrs`);
console.log(`      • ML p50 Error:   ${realization.mlP50ErrorHours} hrs`);
console.log(`      • Inside [p10, p90] Band: ${realization.isWithinP10P90Band}`);

assert.equal(realization.actualRealizedDelayHours, 8.7);
assert.equal(realization.physicsErrorHours, 0.2); // |8.7 - 8.5|
assert.equal(realization.mlP50ErrorHours, 0.2);   // |8.7 - 8.9|
assert(realization.isWithinP10P90Band, "8.7h must be inside [7.2h, 11.5h]");

const drift = computeDriftMetrics();
console.log(`   📈 Fleet Drift Metrics:`, drift);
assert.equal(drift.totalCompletedVoyages, 1);
assert.equal(drift.driftStatus, "healthy");

console.log("   ✅ Production drift tracking and realization logging verified!");

// =========================================================================
// 3. Robust Error-Handling & Incomplete Fixture Safety Tests
// =========================================================================
console.log("🧪 3. Testing Incomplete/Corrupt Data & Missing Property Safety...");

const corruptAssessment = {
  shipmentId: "SHP-CORRUPT-001",
  totalDelayHours: 3.2,
  // vessel is undefined
  // legs contains item with missing primaryCause and null fields
  legs: [
    {
      delayHours: 1.5,
      // primaryCause is undefined!
      // relativeWaveAngleDeg is undefined!
    },
    {
      delayHours: 0,
    }
  ]
};

// mlPrediction is completely omitted
const safeExplanation = buildComprehensiveExplanation(
  corruptAssessment.shipmentId,
  corruptAssessment,
  undefined
);

console.log(`   🛡️ Handled Incomplete Fixture:`);
console.log(`      • Total Predicted: +${safeExplanation.totalPredictedDelayHours}h`);
console.log(`      • Factor Count:    ${safeExplanation.factors.length}`);
console.log(`      • Primary Driver:  ${safeExplanation.primaryDriverSummary}`);
console.log(`      • Recommendation:  ${safeExplanation.recommendation}`);

assert.equal(safeExplanation.shipmentId, "SHP-CORRUPT-001");
assert(safeExplanation.totalPredictedDelayHours >= 0);
assert(safeExplanation.factors.length >= 1, "Must generate safe factors without crashing");

console.log("   ✅ Runtime error boundary and missing property fallbacks verified!");
console.log("\n🎉 ALL PHASE 7 & 8 PRODUCTION TELEMETRY TESTS PASSED! (100% Green)\n");
