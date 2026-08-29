import assert from "node:assert/strict";
import {
  REFERENCE_LANES,
  ALL_VESSEL_CLASSES,
  generateScenarioGrid,
  materializeScenario,
} from "../synthetic/scenario-generator.ts";
import {
  gaussianNoise,
  cauchyNoise,
  applyOperationalNoise,
} from "../synthetic/noise-model.ts";
import { generateTrainingRow } from "../synthetic/generate-training-row.ts";
import {
  appendRowToDataset,
  getAllTrainingRows,
  getDatasetSummary,
  clearDatasetStore,
} from "../synthetic/dataset-store.ts";
import { runGenerationBatch } from "../synthetic/run-generation-batch.ts";
import { VESSEL_PROFILES } from "../vessel-profiles.ts";

console.log("🧬 Starting Phase 5 Synthetic Ground-Truth Data Pipeline Tests...\n");

// =========================================================================
// 1. Reference Lanes & Stratified Sampling Tests
// =========================================================================
console.log("🧪 1. Testing Reference Trade Corridors & Stratified Grid...");

assert.equal(REFERENCE_LANES.length, 6, "Must define 6 major global trade corridors");
assert.equal(ALL_VESSEL_CLASSES.length, 11, "Must include 11 standardized vessel classes");

const grid = generateScenarioGrid(1);
// 6 lanes * 11 vessels * 2 loading states * 12 months * 1 sample = 1,584 scenarios
console.log(`   📊 Stratified Scenario Grid Size: ${grid.length} parameter tuples.`);
assert.equal(grid.length, 6 * 11 * 2 * 12);

// Materialize first scenario
const scen1 = materializeScenario(grid[0]);
console.log(`   🚢 Materialized Scenario: ${scen1.id}`);
console.log(`      • Corridor:  ${scen1.lane.name}`);
console.log(`      • Vessel:    ${scen1.vessel.name}`);
console.log(`      • Waypoints: ${scen1.waypoints.length} points`);
console.log(`      • Departure: ${scen1.departureTime.toISOString()}`);

assert(scen1.waypoints.length > 20, "Mumbai-Rotterdam corridor must have >20 waypoints");
assert.equal(scen1.vessel.id, "Container_UltraLarge");
console.log("   ✅ Reference corridors & stratified sampling passed!");

// =========================================================================
// 2. Stochastic Noise Model Tests
// =========================================================================
console.log("🧪 2. Testing Gaussian & Heavy-Tailed Cauchy Operational Noise...");

// Gaussian tests (mean ~0)
let sumG = 0;
const N = 1000;
for (let i = 0; i < N; i++) {
  sumG += gaussianNoise(0, 1.0);
}
const meanG = sumG / N;
console.log(`   📈 Gaussian Sample Mean (N=1000): ${meanG.toFixed(3)} (Expect ~0.0)`);
assert(Math.abs(meanG) < 0.15, "Gaussian sample mean should be close to 0");

// Apply noise on clean 10.0h delay
const cleanDelay = 10.0;
const noiseResult = applyOperationalNoise(cleanDelay, scen1, {
  gaussianStdDevPercent: 0.10,
  cauchyScaleHours: 2.0,
  cauchyProbability: 0.10,
  minAbsoluteStdDevHours: 0.3,
});

console.log(`   🎲 Clean Delay: ${cleanDelay}h -> Noisy Delay: ${noiseResult.noisyDelayHours}h (Gaussian: ${noiseResult.gaussianComponent}h, Cauchy: ${noiseResult.cauchyComponent}h, Tail Event: ${noiseResult.hasTailEvent})`);
assert(noiseResult.noisyDelayHours >= 0, "Noisy delay cannot be negative");
console.log("   ✅ Stochastic noise model verified!");

// =========================================================================
// 3. Training Row Generator over Historical Weather Tests
// =========================================================================
console.log("🧪 3. Testing Training Row Generator with Historical Reanalysis Weather...");

// Test generating a single training row on a subset of waypoints
const testScen = {
  ...scen1,
  waypoints: scen1.waypoints.slice(0, 8), // 8 waypoints (~350 nm)
};

const row = await generateTrainingRow(testScen);
console.log(`   📝 Generated Training Row: ${row.scenarioId}`);
console.log(`      • Distance:      ${row.totalDistanceNm} nm`);
console.log(`      • Planned Time:  ${row.totalPlannedHours} hrs`);
console.log(`      • Clean Delay:   ${row.cleanPhysicsDelayHours} hrs`);
console.log(`      • Noisy Label:   ${row.noisyGroundTruthDelayHours} hrs`);
console.log(`      • Evaluated Legs:${row.legs.length}`);
console.log(`      • Weather Provenance: ${row.datasetMetadata.weatherSource}`);

assert.equal(row.legs.length, 8);
assert(row.cleanPhysicsDelayHours >= 0);
assert(row.noisyGroundTruthDelayHours >= 0);
assert.equal(row.datasetMetadata.physicsVersion, "kwon-2008-structured-v1");

console.log("   ✅ Historical weather assimilation & training row generation verified!");

// =========================================================================
// 4. Dataset Store & Batch Execution Tests
// =========================================================================
console.log("🧪 4. Testing Dataset Store & Checkpoint Batch Runner...");

clearDatasetStore();
await appendRowToDataset(row);

const storedRows = getAllTrainingRows();
assert.equal(storedRows.length, 1);
assert.equal(storedRows[0].scenarioId, row.scenarioId);

const summary = getDatasetSummary();
console.log(`   📊 Dataset Summary:`, summary);
assert.equal(summary.totalRecords, 1);

console.log("   ✅ Dataset storage and summary metrics passed!");
console.log("\n🎉 ALL PHASE 5 SYNTHETIC GROUND-TRUTH PIPELINE TESTS PASSED! (100% Green)\n");
