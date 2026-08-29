import assert from "node:assert/strict";
import {
  generateGridCacheKey,
  fetchWeatherSeriesCached,
  getCacheStats,
} from "../weather-cache.ts";
import {
  recordDelayCalculation,
  getShipmentAuditHistory,
  getAuditRecordById,
  MARITIME_FORMULA_VERSION,
} from "../jobs/audit-log.ts";
import {
  evaluateDeltaAndAlert,
  summarizeAssessment,
} from "../jobs/delta-alerting.ts";
import {
  executeShipmentReeval,
  scheduleRecurringReeval,
  stopRecurringReeval,
  getActiveReevalCount,
} from "../jobs/reevaluate-shipment.ts";
import { densifyRoute } from "../route-decomposition.ts";
import { resolveRouteDelay } from "../route-delay-orchestrator.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";

console.log("⚡ Starting Phase 4 Orchestration, Caching & Audit Logging Test Suite...\n");

// =========================================================================
// 1. Spatial-Temporal Grid Caching Tests
// =========================================================================
console.log("🧪 1. Testing Spatial-Temporal Grid Caching & 0.25° Mesh...");

const t1 = 1756500000000;
const key1 = generateGridCacheKey(18.93, 72.82, t1);
const key2 = generateGridCacheKey(18.94, 72.84, t1); // Within same 0.25° grid
const key3 = generateGridCacheKey(19.20, 73.10, t1); // Distinct 0.25° grid

console.log(`   🔑 Key 1 (18.93°, 72.82°): ${key1}`);
console.log(`   🔑 Key 2 (18.94°, 72.84°): ${key2}`);
console.log(`   🔑 Key 3 (19.20°, 73.10°): ${key3}`);

assert.equal(key1, key2, "Coordinates in the same 0.25° cell must generate identical cache keys");
assert.notEqual(key1, key3, "Coordinates in different grid cells must generate different cache keys");

const stats = getCacheStats();
assert.equal(stats.gridPrecisionDeg, 0.25);
assert.equal(stats.ttlHours, 5);
console.log("   ✅ Spatial grid caching & epoch bucketing passed!");

// =========================================================================
// 2. Immutable Calculation Audit Log Tests
// =========================================================================
console.log("🧪 2. Testing Immutable Calculation Audit Snapshots...");

const departure = new Date("2026-09-01T00:00:00Z");
const controlPoints = [
  { lat: 18.95, lng: 72.85 },
  { lat: 15.00, lng: 68.00 },
  { lat: 12.78, lng: 45.02 },
];
const waypoints = densifyRoute(controlPoints);

// Mock weather series
const mockFetcher = async () => ({
  times: Array.from({ length: 72 }, (_, i) => departure.getTime() + i * 3600_000),
  windSpeedMs: Array(72).fill(12.0),
  windDirectionDeg: Array(72).fill(260),
  precipitationMmH: Array(72).fill(2.0),
  weatherCode: Array(72).fill(65),
  waveHeightM: Array(72).fill(3.2),
  waveDirectionDeg: Array(72).fill(260),
  swellHeightM: Array(72).fill(2.5),
  visibilityM: Array(72).fill(8000),
  forecastRunTime: departure.getTime(),
});

const assessment = await resolveRouteDelay(
  waypoints.slice(0, 5),
  VESSEL_PROFILES.Container_PostPanamax,
  20.0,
  true,
  departure,
  mockFetcher
);

const shipmentId = "SHP-MUM-ADEN-001";
const auditId = await recordDelayCalculation(shipmentId, assessment, {
  triggeredBy: "scheduled_reeval",
  jobId: "job-test-123",
});

console.log(`   📝 Recorded Audit Record: ${auditId} (Formula: ${MARITIME_FORMULA_VERSION})`);
const auditRecord = getAuditRecordById(auditId);
assert(auditRecord !== null, "Audit record must be retrievable by ID");
assert.equal(auditRecord.formulaVersion, "kwon-2008-structured-v1");
assert.equal(auditRecord.legs.length, 5);
assert.equal(auditRecord.legs[0].inputSnapshot.windSpeedKnots, 23.3);
assert.equal(auditRecord.legs[0].inputSnapshot.waveHeightM, 3.2);

const history = getShipmentAuditHistory(shipmentId);
assert.equal(history.length, 1);
assert.equal(history[0].id, auditId);
console.log("   ✅ Audit logging with raw input snapshots verified!");

// =========================================================================
// 3. Delta-Based EPC Milestone Alerting Tests
// =========================================================================
console.log("🧪 3. Testing Delta-Based Alerting & Noise Filtering...");

// Scenario A: First evaluation -> Triggers initial alert
const alert1 = evaluateDeltaAndAlert(shipmentId, null, assessment, auditId);
assert(alert1 !== null, "First evaluation must emit initial alert");
assert.equal(alert1.type, "initial_estimate");
console.log(`   🔔 Initial Alert: ${alert1.summary}`);

// Scenario B: Minor wobble (+0.3h delta on 50h voyage) -> Filtered out (NO alert)
const assessmentWobble = {
  ...assessment,
  totalDelayHours: assessment.totalDelayHours + 0.3,
};
const alertWobble = evaluateDeltaAndAlert(shipmentId, assessment, assessmentWobble, auditId);
assert.equal(alertWobble, null, "Minor forecast wobble below 5% threshold must NOT fire an alert");
console.log("   🛡️ Filtered minor forecast wobble (+0.3h) with zero spam.");

// Scenario C: Meaningful delay increase (+6.5h delta) -> Triggers delay variance alert
const assessmentMajorDelay = {
  ...assessment,
  totalDelayHours: assessment.totalDelayHours + 6.5,
  finalEta: new Date(assessment.finalEta.getTime() + 6.5 * 3600_000),
};
const alertMajor = evaluateDeltaAndAlert(shipmentId, assessment, assessmentMajorDelay, auditId);
assert(alertMajor !== null, "Meaningful change must fire alert");
assert.equal(alertMajor.type, "delay_variance");
assert.equal(alertMajor.deltaHours, 6.5);
console.log(`   ⚠️ Major Delay Alert: ${alertMajor.summary}`);

// Scenario D: Delay recovery (storms clear from +8h to +0.2h) -> Triggers recovery alert
const assessmentRecovered = {
  ...assessment,
  totalDelayHours: 0.2,
};
const assessmentHeavyPast = {
  ...assessment,
  totalDelayHours: 8.5,
};
const alertRecovery = evaluateDeltaAndAlert(shipmentId, assessmentHeavyPast, assessmentRecovered, auditId);
assert(alertRecovery !== null, "Recovery must fire delay_cleared alert");
assert.equal(alertRecovery.type, "delay_cleared");
console.log(`   ✅ Recovery Alert: ${alertRecovery.summary}`);

console.log("   ✅ Delta alerting engine verified!");

// =========================================================================
// 4. Re-evaluation Manager & Idempotent Scheduler Tests
// =========================================================================
console.log("🧪 4. Testing Re-evaluation Manager & Terminal Guardrails...");

const context = {
  shipmentId: "SHP-DELIVERED-002",
  routeId: "RT-002",
  vessel: VESSEL_PROFILES.Bulk_Capesize,
  plannedSpeedKnots: 14.0,
  isLaden: true,
  departureTime: departure,
  status: "delivered", // Terminal state!
  waypoints: waypoints.slice(0, 5),
};

const execResult = await executeShipmentReeval(context);
assert(execResult.skipped, "Delivered shipment must be skipped to save compute");
console.log(`   🛑 Terminal State Guard: ${execResult.skipReason}`);

// Test Idempotent Scheduler
scheduleRecurringReeval(context, 10000);
assert.equal(getActiveReevalCount(), 1, "Scheduler must have 1 active repeater");
// Schedule again for same shipment -> Should overwrite without creating second repeater
scheduleRecurringReeval(context, 10000);
assert.equal(getActiveReevalCount(), 1, "Duplicate schedule must overwrite existing timer");

stopRecurringReeval(context.shipmentId);
assert.equal(getActiveReevalCount(), 0, "Timer successfully stopped");
console.log("   ✅ Idempotent re-evaluation scheduler verified!");

console.log("\n🎉 ALL PHASE 4 ORCHESTRATION, CACHING & AUDIT LOGGING TESTS PASSED! (100% Green)\n");
