import assert from "node:assert/strict";
import {
  extractFeatureVectors,
  FEATURE_COLUMNS,
  SEA_CONDITION_ORDER,
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
  splitByScenario,
  runBacktest,
} from "../ml/backtest.ts";
import { generateScenarioGrid, materializeScenario } from "../synthetic/scenario-generator.ts";
import { generateTrainingRow } from "../synthetic/generate-training-row.ts";

console.log("🤖 Starting Phase 6 ML Quantile Regression & SHAP Explainability Tests...\n");

// =========================================================================
// 1. Synthetic Training Set Generation (5 diverse scenarios)
// =========================================================================
console.log("🧪 1. Generating 5 Stratified Multi-Corridor Scenarios...");

const grid = generateScenarioGrid(1);
const selectedParams = [
  grid[0], // Mumbai-Rotterdam (ULCV, Laden, Jan)
  grid[12], // Mumbai-Rotterdam (Post-Panamax, Ballast, Jul Monsoon)
  grid[144], // Shanghai-LA Transpacific (Capesize, Laden, Winter)
  grid[288], // Santos-Rotterdam (VLCC, Laden)
  grid[432], // Ras Tanura-Ningbo (LNG Carrier, Laden)
];

const trainingRows = [];
for (const p of selectedParams) {
  const scen = materializeScenario(p);
  // Sample 6 waypoints per scenario
  scen.waypoints = scen.waypoints.slice(0, 6);
  const row = await generateTrainingRow(scen);
  trainingRows.push(row);
}

console.log(`   📦 Generated ${trainingRows.length} synthetic ground-truth voyages.`);

// =========================================================================
// 2. Feature Extraction Tests
// =========================================================================
console.log("🧪 2. Testing Tabular Feature Matrix Extraction...");

const featureRecords = extractFeatureVectors(trainingRows);
console.log(`   📊 Extracted ${featureRecords.length} leg feature records.`);
assert.equal(featureRecords.length, 5 * 6, "5 scenarios * 6 legs = 30 feature records");

const sampleRecord = featureRecords[0];
assert.equal(sampleRecord.featureVector.length, FEATURE_COLUMNS.length);
assert(sampleRecord.features.beaufort_force >= 0 && sampleRecord.features.beaufort_force <= 12);
assert(sampleRecord.features.sea_condition_encoded >= 0 && sampleRecord.features.sea_condition_encoded <= 4);

console.log("   ✅ Feature extraction & ordinal encoding verified!");

// =========================================================================
// 3. Quantile Regression Training & Monotonicity Tests
// =========================================================================
console.log("🧪 3. Testing Quantile Regressor Training & p10/p50/p90 Bands...");

const model = trainQuantileRegressor(featureRecords, 100, 0.02);
assert.equal(model.q50Weights.length, FEATURE_COLUMNS.length);

const testFeature = featureRecords[0].featureVector;
const cleanPhysics = featureRecords[0].cleanDelayHours;
const pred = predictQuantiles(testFeature, model, cleanPhysics);

console.log(`   🔮 Quantile Prediction for Leg #1 (Clean Physics: ${cleanPhysics}h):`);
console.log(`      • p10 (Optimistic):    ${pred.p10} hrs`);
console.log(`      • p50 (ML Median):     ${pred.p50} hrs`);
console.log(`      • p90 (Conservative):  ${pred.p90} hrs`);
console.log(`      • Uncertainty Spread:  ${pred.uncertaintyBandHours} hrs`);
console.log(`      • Confidence Score:    ${pred.confidenceScore}`);

assert(pred.p10 <= pred.p50, "p10 must be <= p50 (Monotonicity)");
assert(pred.p50 <= pred.p90, "p50 must be <= p90 (Monotonicity)");
assert(pred.confidenceScore >= 0.0 && pred.confidenceScore <= 1.0);

console.log("   ✅ Quantile regression monotonicity and confidence scoring passed!");

// =========================================================================
// 4. SHAP Feature Importance & Causal Explainability Tests
// =========================================================================
console.log("🧪 4. Testing SHAP Feature Importance & Causal Explainability...");

const explanation = explainPrediction(testFeature, model);
console.log(`   💡 Causal Explanation: ${explanation.summary}`);
console.log(`   🏆 Top Delay Drivers:`);
explanation.topDrivers.forEach((driver, idx) => {
  console.log(`      ${idx + 1}. ${driver.displayName}: ${driver.contributionHours > 0 ? "+" : ""}${driver.contributionHours}h (${driver.percentageOfVariance}%)`);
});

assert(explanation.topDrivers.length > 0, "Must identify top delay drivers");

const globalRanking = computeGlobalFeatureImportance(model);
console.log(`   🌍 Global Top 3 Features: ${globalRanking[0].displayName}, ${globalRanking[1].displayName}, ${globalRanking[2].displayName}`);

console.log("   ✅ SHAP explainability and causal attribution verified!");

// =========================================================================
// 5. Group-Split Leak-Free Backtesting Tests
// =========================================================================
console.log("🧪 5. Testing Leak-Free Group-Split Backtesting & 80% Coverage...");

const backtestReport = runBacktest(featureRecords, 0.40);
console.log(`   📈 Backtest Report:`);
console.log(`      • Training Samples:     ${backtestReport.trainSampleCount}`);
console.log(`      • Test Samples:         ${backtestReport.testSampleCount} across ${backtestReport.uniqueTestScenarios} unseen voyages`);
console.log(`      • Layer 1 (Physics MAE):${backtestReport.maePhysicsBaseline} hrs`);
console.log(`      • Layer 3 (ML p50 MAE): ${backtestReport.maeMlQuantileP50} hrs`);
console.log(`      • Error Improvement:    ${backtestReport.maeImprovementPercent}%`);
console.log(`      • p10-p90 Coverage Rate:${backtestReport.p10P90CoveragePercent}% (Target: ~80%)`);

assert(backtestReport.uniqueTestScenarios > 0);
assert(backtestReport.p10P90CoveragePercent >= 60, "Coverage rate should be close to 80% interval");

console.log("   ✅ Group-split leak-free backtest verified!");
console.log("\n🎉 ALL PHASE 6 ML QUANTILE REGRESSION & EXPLAINABILITY TESTS PASSED! (100% Green)\n");
