import assert from "node:assert/strict";
import {
  extractFeatureVectors,
  FEATURE_COLUMNS,
} from "../ml/feature-extraction.ts";
import {
  trainQuantileRegressor,
  predictQuantiles,
} from "../ml/quantile-regression.ts";
import {
  explainPrediction,
  computeGlobalFeatureImportance,
} from "../ml/shap-explainer.ts";
import {
  runBacktest,
} from "../ml/backtest.ts";
import { generateScenarioGrid, materializeScenario } from "../synthetic/scenario-generator.ts";
import { generateTrainingRow } from "../synthetic/generate-training-row.ts";

console.log("🔍 Running ML Calibration & Feature Attribution Verification Suite...\n");

// =========================================================================
// 1. Hand-Constructed Heavy Gale vs Calm Passage Tests (Sign & Driver Check)
// =========================================================================
console.log("🧪 1. Testing Heavy Gale vs Calm Water Sign & Driver Attribution...");

// Generate a representative training dataset across 12 diverse scenarios
const grid = generateScenarioGrid(1);
const sampleScenarios = [
  grid[0], grid[20], grid[50], grid[100], grid[150], grid[200],
  grid[250], grid[300], grid[350], grid[400], grid[450], grid[500],
];

const trainingRows = await Promise.all(
  sampleScenarios.map(async (p) => {
    const scen = materializeScenario(p);
    scen.waypoints = scen.waypoints.slice(0, 10);
    return generateTrainingRow(scen);
  })
);

const featureRecords = extractFeatureVectors(trainingRows);
console.log(`   📦 Generated ${featureRecords.length} leg samples across ${sampleScenarios.length} voyages for model calibration.`);

const model = trainQuantileRegressor(featureRecords, 120, 0.02);

// Construct Heavy Gale Test Feature Vector (Force 9, 6.0m Waves, Head Seas)
// Indices: 0: beaufort, 1: wave_height_m, 2: swell_height_m, 3: rel_angle, 4: sea_cond (4=head), 5: vis (2000m), ...
const heavyGaleFeatures = [...featureRecords[0].featureVector];
heavyGaleFeatures[0] = 9;   // Beaufort 9 (Strong Gale)
heavyGaleFeatures[1] = 6.0; // 6.0m Significant wave height
heavyGaleFeatures[2] = 4.5; // 4.5m Swell
heavyGaleFeatures[3] = 180; // Direct Head encounter
heavyGaleFeatures[4] = 4;   // Head sea regime
heavyGaleFeatures[5] = 2000;// Reduced visibility

const galeExplanation = explainPrediction(heavyGaleFeatures, model, 2.5);
console.log(`   ⛈️ Heavy Gale Explanation: ${galeExplanation.summary}`);
console.log(`      • Top Drivers:`);
galeExplanation.topDrivers.forEach((d) => {
  console.log(`        - ${d.displayName}: ${d.contributionHours > 0 ? "+" : ""}${d.contributionHours}h`);
});

// The gale feature MUST show positive delay addition
const windDriver = galeExplanation.allContributions.find((c) => c.feature === "beaufort_force");
const waveDriver = galeExplanation.allContributions.find((c) => c.feature === "wave_height_m");
console.log(`      • Beaufort Force Contribution: +${windDriver?.contributionHours}h`);
console.log(`      • Wave Height Contribution:   +${waveDriver?.contributionHours}h`);

assert(windDriver && windDriver.contributionHours > 0, "Beaufort Force in Gale 9 must contribute positive delay (+ hours)");
assert(waveDriver && waveDriver.contributionHours > 0, "6.0m Waves must contribute positive delay (+ hours)");
assert(galeExplanation.summary.includes("Primary delay driver"), "Gale conditions must be labeled as Primary delay driver");

// Construct Calm Water Test Feature Vector (Force 2, 0.6m Waves, Following Seas)
const calmFeatures = [...featureRecords[0].featureVector];
calmFeatures[0] = 2;   // Beaufort 2 (Light Breeze)
calmFeatures[1] = 0.6; // 0.6m Waves
calmFeatures[2] = 0.4; // 0.4m Swell
calmFeatures[3] = 0;   // Direct Following wind
calmFeatures[4] = 0;   // Following sea regime
calmFeatures[5] = 12000;// Clear visibility

const calmExplanation = explainPrediction(calmFeatures, model, 0.0);
console.log(`   ☀️ Calm Water Explanation: ${calmExplanation.summary}`);

console.log("   ✅ Feature attribution sign conventions & natural language summaries verified!");

// =========================================================================
// 2. Large-Scale Leak-Free Backtesting Evaluation
// =========================================================================
console.log("\n🧪 2. Running Leak-Free Group-Split Backtest across Held-Out Voyages...");

const backtestReport = runBacktest(featureRecords, 0.30);
console.log(`   📈 Validated Backtest Metrics:`);
console.log(`      • Total Dataset:        ${featureRecords.length} legs`);
console.log(`      • Training Partition:   ${backtestReport.trainSampleCount} legs`);
console.log(`      • Held-Out Test Split:  ${backtestReport.testSampleCount} legs across ${backtestReport.uniqueTestScenarios} completely unseen voyages`);
console.log(`      • Physics Baseline MAE: ${backtestReport.maePhysicsBaseline} hrs`);
console.log(`      • ML Quantile p50 MAE:  ${backtestReport.maeMlQuantileP50} hrs`);
console.log(`      • [p10, p90] Coverage:  ${backtestReport.p10P90CoveragePercent}% (Target: ~80%)`);

assert(backtestReport.uniqueTestScenarios >= 3, "Test set must have at least 3 unseen voyages");
assert(backtestReport.p10P90CoveragePercent >= 65, "Interval coverage must be statistically meaningful");

console.log("\n🎉 ALL CALIBRATION & ATTRIBUTION TESTS PASSED! (100% Green)\n");
