/**
 * ============================================================================
 * LINEAR PINBALL-LOSS QUANTILE REGRESSION ENGINE (p10, p50, p90 BANDS)
 * ============================================================================
 * Implements Linear Pinball / Quantile Loss Regression with L2 Regularization:
 * L_q(y, y_hat) = max(q * (y - y_hat), (q - 1) * (y - y_hat))
 * 
 * Note: This is an in-process, lightweight TypeScript linear quantile estimator.
 * For high-dimensional non-linear feature interaction tree ensembles (TreeSHAP),
 * use the companion Python XGBoost Quantile pipeline (src/ml/train_quantile_xgboost.py).
 * 
 * Quantile Definitions:
 * - p10: Optimistic lower bound (90% chance actual delay exceeds this)
 * - p50: Median point prediction (Layer 3 ML-corrected delay)
 * - p90: Conservative upper bound (10% risk of exceeding this in heavy weather)
 */

import { ExtractedFeatureRecord, FEATURE_COLUMNS } from "./feature-extraction";

export interface QuantilePrediction {
  p10: number; // 10th percentile optimistic delay (hours)
  p50: number; // 50th percentile median ML delay (hours)
  p90: number; // 90th percentile conservative delay (hours)
  uncertaintyBandHours: number; // (p90 - p10) spread
  confidenceScore: number;     // Normalized confidence metric [0.0 - 1.0]
}

export interface TrainedQuantileWeights {
  q10Weights: number[];
  q10Bias: number;
  q50Weights: number[];
  q50Bias: number;
  q90Weights: number[];
  q90Bias: number;
  featureMeans: number[];
  featureStdDevs: number[];
  trainedEpochs: number;
  trainedSampleCount: number;
}

/**
 * Trains a robust Gradient-Descent Quantile Regressor minimizing Pinball Loss.
 */
export function trainQuantileRegressor(
  records: ExtractedFeatureRecord[],
  epochs: number = 80,
  learningRate: number = 0.015
): TrainedQuantileWeights {
  const nFeatures = FEATURE_COLUMNS.length;
  const nSamples = records.length;

  if (nSamples === 0) {
    throw new Error("Cannot train model on empty feature dataset");
  }

  // 1. Compute feature means & standard deviations for standardization
  const featureMeans = Array(nFeatures).fill(0);
  const featureStdDevs = Array(nFeatures).fill(1);

  for (let f = 0; f < nFeatures; f++) {
    const vals = records.map((r) => r.featureVector[f]);
    const mean = vals.reduce((a, b) => a + b, 0) / nSamples;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nSamples;
    const rawStd = Math.sqrt(variance);

    featureMeans[f] = mean;
    // If feature is constant or near-constant in training data, do not allow tiny division
    featureStdDevs[f] = rawStd > 0.05 ? rawStd : 1.0;
  }

  // Normalize input matrix X with [-4.0, +4.0] standard deviation clamping
  const X_norm: number[][] = records.map((r) =>
    r.featureVector.map((val, f) => {
      const rawNorm = (val - featureMeans[f]) / featureStdDevs[f];
      return Math.max(-4.0, Math.min(4.0, rawNorm));
    })
  );
  // Physics-Informed Target: Model learns residual operational offset (y_target - y_clean)
  const y_residual: number[] = records.map(
    (r) => r.targetNoisyDelayHours - r.cleanDelayHours
  );

  // Train weights for each quantile q in [0.10, 0.50, 0.90]
  function trainSingleQuantile(q: number): { weights: number[]; bias: number } {
    const weights = Array(nFeatures).fill(0.01);
    let bias = q === 0.1 ? -0.05 : q === 0.5 ? 0.0 : 0.08;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = learningRate / (1 + epoch * 0.01);
      for (let i = 0; i < nSamples; i++) {
        const x_i = X_norm[i];
        let y_pred = bias;
        for (let f = 0; f < nFeatures; f++) {
          y_pred += weights[f] * x_i[f];
        }

        const error = y_residual[i] - y_pred;
        // Subgradient of Pinball Loss: -q if error > 0 else (1 - q)
        const subgradient = error > 0 ? -q : 1.0 - q;

        // Gradient update with L2 regularization
        bias -= lr * subgradient;
        for (let f = 0; f < nFeatures; f++) {
          weights[f] -= lr * (subgradient * x_i[f] + 0.001 * weights[f]);
        }
      }
    }
    return { weights, bias };
  }

  const q10 = trainSingleQuantile(0.10);
  const q50 = trainSingleQuantile(0.50);
  const q90 = trainSingleQuantile(0.90);

  return {
    q10Weights: q10.weights,
    q10Bias: q10.bias,
    q50Weights: q50.weights,
    q50Bias: q50.bias,
    q90Weights: q90.weights,
    q90Bias: q90.bias,
    featureMeans,
    featureStdDevs,
    trainedEpochs: epochs,
    trainedSampleCount: nSamples,
  };
}

/**
 * Predicts p10, p50, p90 delay intervals for an extracted feature vector.
 */
export function predictQuantiles(
  featureVector: number[],
  model: TrainedQuantileWeights,
  cleanPhysicsDelay: number = 0
): QuantilePrediction {
  const norm = featureVector.map((val, f) => {
    const raw = (val - model.featureMeans[f]) / (model.featureStdDevs[f] || 1.0);
    return Math.max(-4.0, Math.min(4.0, raw));
  });

  let deltaP10 = model.q10Bias;
  let deltaP50 = model.q50Bias;
  let deltaP90 = model.q90Bias;

  for (let f = 0; f < featureVector.length; f++) {
    deltaP10 += model.q10Weights[f] * norm[f];
    deltaP50 += model.q50Weights[f] * norm[f];
    deltaP90 += model.q90Weights[f] * norm[f];
  }

  // Physics-Informed Anchor: y_hat = y_clean + delta_hat
  const rawP10 = Math.max(0.0, cleanPhysicsDelay + deltaP10);
  const rawP50 = Math.max(0.0, cleanPhysicsDelay + deltaP50);
  const rawP90 = Math.max(rawP50 + 0.05, cleanPhysicsDelay + deltaP90);

  // Enforce monotonicity: p10 <= p50 <= p90
  const p10 = Number(Math.min(rawP10, rawP50).toFixed(2));
  const p50 = Number(rawP50.toFixed(2));
  const p90 = Number(Math.max(p50, rawP90).toFixed(2));

  const uncertaintyBand = Number((p90 - p10).toFixed(2));
  // Confidence score: Tight spread = high confidence; wide spread = low confidence
  const confidenceScore = Number(
    Math.max(0.2, Math.min(0.98, 1.0 - uncertaintyBand / (p50 + 4.0))).toFixed(2)
  );

  return {
    p10,
    p50,
    p90,
    uncertaintyBandHours: uncertaintyBand,
    confidenceScore,
  };
}
