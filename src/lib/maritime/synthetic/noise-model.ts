/**
 * ============================================================================
 * MARITIME OPERATIONAL NOISE & STOCHASTIC PERTURBATION MODEL
 * ============================================================================
 * Simulates the physical & operational gap between pure theoretical hydrodynamic 
 * predictions and real-world observed shipping delay distributions:
 * 
 * 1. Continuous Gaussian Noise (Box-Muller Transform):
 *    Simulates crew throttle adjustments, unmodeled oceanic surface currents, 
 *    and minor biofouling hull friction variance.
 * 
 * 2. Heavy-Tailed Cauchy Noise:
 *    Simulates rare, discrete fat-tail operational disruptions (unscheduled 
 *    divergent course changes, minor auxiliary plant issues, previous port 
 *    turnaround spillover) that standard normal distributions underestimate.
 */

import { GeneratedScenario } from "./scenario-generator";

/**
 * Generates Gaussian random number using Box-Muller transform.
 */
export function gaussianNoise(mean: number = 0, stdDev: number = 1): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Generates heavy-tailed Cauchy random variable.
 */
export function cauchyNoise(scale: number = 3.0): number {
  const u = Math.random() - 0.5;
  return scale * Math.tan(Math.PI * u);
}

export interface NoiseConfig {
  gaussianStdDevPercent: number; // Continuous variance as % of clean delay (e.g. 0.10 = 10%)
  cauchyScaleHours: number;      // Heavy-tail scale parameter in hours (e.g. 2.0 hours)
  cauchyProbability: number;     // Probability of encountering a fat-tail operational event (e.g. 0.06 = 6%)
}

/**
 * Calibrated operational noise configuration.
 * Gaussian variance represents ±8-10% continuous operational variance (throttle/currents),
 * while Cauchy tail represents rare positive operational disruption additions.
 */
export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  gaussianStdDevPercent: 0.08,   // 8% continuous operational variance
  cauchyScaleHours: 2.0,         // 2.0 hour heavy-tail scale
  cauchyProbability: 0.05,       // 5% discrete operational event chance
};

/**
 * Applies structured operational noise to pure hydrodynamic delay.
 */
export function applyOperationalNoise(
  cleanDelayHours: number,
  scenario: GeneratedScenario,
  config: NoiseConfig = DEFAULT_NOISE_CONFIG
): {
  noisyDelayHours: number;
  gaussianComponent: number;
  cauchyComponent: number;
  hasTailEvent: boolean;
} {
  // 1. Continuous Gaussian perturbation proportional to clean delay
  const effectiveStdDev = Math.max(
    0.05,
    cleanDelayHours * config.gaussianStdDevPercent
  );
  const gaussianComponent = gaussianNoise(0, effectiveStdDev);

  // 2. Discrete fat-tail Cauchy disruption (positive addition only: disruptions add delay)
  const hasTailEvent = Math.random() < config.cauchyProbability;
  let cauchyComponent = 0;
  if (hasTailEvent) {
    // One-sided positive disruption: e.g. +1.5h to +24.0h delay
    const rawCauchy = Math.abs(cauchyNoise(config.cauchyScaleHours));
    cauchyComponent = Math.min(24.0, rawCauchy);
  }

  // 3. Composite delay (cannot be negative)
  const combined = cleanDelayHours + gaussianComponent + cauchyComponent;
  const noisyDelayHours = Number(Math.max(0.0, combined).toFixed(2));

  return {
    noisyDelayHours,
    gaussianComponent: Number(gaussianComponent.toFixed(2)),
    cauchyComponent: Number(cauchyComponent.toFixed(2)),
    hasTailEvent,
  };
}
