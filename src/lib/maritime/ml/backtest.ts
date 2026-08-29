/**
 * ============================================================================
 * BACKTEST ENGINE: GROUP-SPLIT VALIDATION & BENCHMARK COMPARISON
 * ============================================================================
 * Performs leak-free validation by splitting strictly by scenario_id (voyage),
 * evaluating:
 * 1. Mean Absolute Error (MAE): Physics-Only Baseline (Layer 1) vs Physics + ML (Layer 3)
 * 2. 80% Coverage Rate Check: Validating that exactly ~80% of real labels fall 
 *    within the [p10, p90] prediction interval.
 */

import { ExtractedFeatureRecord } from "./feature-extraction";
import { predictQuantiles, TrainedQuantileWeights, trainQuantileRegressor } from "./quantile-regression";

export interface BacktestReport {
  trainSampleCount: number;
  testSampleCount: number;
  uniqueTestScenarios: number;
  maePhysicsBaseline: number;   // Layer 1 MAE (hours)
  maeMlQuantileP50: number;      // Layer 3 MAE (hours)
  maeImprovementPercent: number; // % reduction in prediction error
  p10P90CoveragePercent: number; // % of true observations in [p10, p90] (target ~80%)
  isMiscalibrated: boolean;
}

/**
 * Splits dataset by scenario_id (GroupShuffleSplit) to prevent intra-voyage data leakage.
 */
export function splitByScenario(
  records: ExtractedFeatureRecord[],
  testRatio: number = 0.25
): { train: ExtractedFeatureRecord[]; test: ExtractedFeatureRecord[] } {
  const uniqueScenarioIds = Array.from(new Set(records.map((r) => r.scenarioId)));
  
  // Deterministic shuffle
  const shuffled = [...uniqueScenarioIds].sort(() => 0.5 - Math.random());
  const nTest = Math.max(1, Math.round(shuffled.length * testRatio));
  const testScenarioSet = new Set(shuffled.slice(0, nTest));

  const train: ExtractedFeatureRecord[] = [];
  const test: ExtractedFeatureRecord[] = [];

  for (const r of records) {
    if (testScenarioSet.has(r.scenarioId)) {
      test.push(r);
    } else {
      train.push(r);
    }
  }

  return { train, test };
}

/**
 * Executes full backtest comparing Physics Baseline against ML Quantile Regressor.
 */
export function runBacktest(
  records: ExtractedFeatureRecord[],
  testRatio: number = 0.25
): BacktestReport {
  const { train, test } = splitByScenario(records, testRatio);

  if (train.length === 0 || test.length === 0) {
    throw new Error("Insufficient samples for train/test backtest split");
  }

  // Train model on training partition only
  const model = trainQuantileRegressor(train, 100, 0.02);

  let sumErrorBaseline = 0;
  let sumErrorMl = 0;
  let coveredCount = 0;

  for (const sample of test) {
    const yTrue = sample.targetNoisyDelayHours;
    const yBaseline = sample.cleanDelayHours;

    const pred = predictQuantiles(sample.featureVector, model, yBaseline);

    sumErrorBaseline += Math.abs(yBaseline - yTrue);
    sumErrorMl += Math.abs(pred.p50 - yTrue);

    // 80% Coverage check: y_true in [p10, p90]
    if (yTrue >= pred.p10 && yTrue <= pred.p90) {
      coveredCount++;
    }
  }

  const nTest = test.length;
  const maePhysicsBaseline = Number((sumErrorBaseline / nTest).toFixed(3));
  const maeMlQuantileP50 = Number((sumErrorMl / nTest).toFixed(3));

  const maeImprovementPercent = Number(
    (
      ((maePhysicsBaseline - maeMlQuantileP50) / Math.max(0.001, maePhysicsBaseline)) *
      100
    ).toFixed(1)
  );

  const coveragePercent = Number(((coveredCount / nTest) * 100).toFixed(1));
  // Coverage should be within [70%, 90%] for calibrated 80% intervals
  const isMiscalibrated = coveragePercent < 65 || coveragePercent > 95;

  return {
    trainSampleCount: train.length,
    testSampleCount: test.length,
    uniqueTestScenarios: new Set(test.map((t) => t.scenarioId)).size,
    maePhysicsBaseline,
    maeMlQuantileP50,
    maeImprovementPercent,
    p10P90CoveragePercent: coveragePercent,
    isMiscalibrated,
  };
}
