/**
 * ============================================================================
 * KWON (2008) ADDED-RESISTANCE & SPEED-LOSS HYDRODYNAMIC MODEL
 * ============================================================================
 * Implements the Kwon (2008) empirical speed loss formula for ships navigating 
 * in heavy weather, based on directional reduction coefficient (C_beta), 
 * hull loading/Froude coefficient (C_u), form factor (C_Form), and Beaufort scale.
 * 
 * Formula:
 * Delta_V / V_s = C_beta * C_u * C_Form * (BN / 12)^p
 * 
 * Note on Documentation:
 * This model is Kwon-method-structured, adhering to the qualitative directional 
 * decomposition (head vs beam vs following seas) and Froude/block coefficient 
 * scaling of Kwon (2008), with coefficients normalized for empirical calibration.
 */

import { SeaCondition } from "./relative-angle";
import { VesselProfile } from "./vessel-profiles";

const GRAVITY_ACCELERATION = 9.80665; // m/s²

/**
 * Calculates ship Froude Number (Fn = Vs / sqrt(g * Lpp)).
 * Dimensionless ratio indicating wave-making resistance regime.
 */
export function froudeNumber(speedMs: number, lengthLpp: number): number {
  if (lengthLpp <= 0) return 0.15;
  return Number((speedMs / Math.sqrt(GRAVITY_ACCELERATION * lengthLpp)).toFixed(4));
}

/**
 * Directional Reduction Coefficient (C_beta)
 * Scales hydrodynamic added resistance based on relative wave/wind encounter angle.
 * Head and bow seas generate severe pitch, wave-slamming, and added resistance,
 * while following seas produce minimal added resistance (or slight surf-riding assist).
 */
export function calculateDirectionCoefficient(
  condition: SeaCondition,
  beaufort: number
): number {
  const baseMap: Record<SeaCondition, number> = {
    head: 2.2,       // 0° - 30° encounter: Maximum pitch & bow slamming
    bow: 1.6,        // 30° - 60° encounter: Significant wave diffraction
    beam: 1.05,      // 60° - 120° encounter: Heavy rolling motion & bilge resistance
    quartering: 0.55,// 120° - 150° encounter: Moderate stern quartering
    following: 0.22, // 150° - 180° encounter: Minimal resistance / trailing waves
  };

  // Severity scaling with sea state
  const severityScale = 1.0 + (beaufort / 12) * 0.6;
  return Number((baseMap[condition] * severityScale).toFixed(3));
}

/**
 * Loading & Hull-Form Coefficient (C_u)
 * Functions of block coefficient (Cb), displacement, and operational Froude number (Fn).
 * Full-form vessels (Capesize Bulk, VLCC with Cb > 0.8) suffer higher wave reflection,
 * while fine-form container ships (Cb ~ 0.65) slice waves but experience high slamming.
 */
export function calculateLoadingCoefficient(
  vessel: VesselProfile,
  fn: number,
  isLaden: boolean
): number {
  // Block coefficient factor: Full forms have blunt bows with higher added wave reflection
  const cbFactor =
    vessel.blockCoefficient >= 0.80
      ? 1.35
      : vessel.blockCoefficient >= 0.70
        ? 1.10
        : 0.85;

  // Froude speed factor: Higher speed ships generate larger dynamic bow wave interactions
  const fnFactor =
    fn >= 0.22
      ? 1.20
      : fn >= 0.16
        ? 1.05
        : 0.90;

  // Ballast draft vs Laden draft: Ballast ships have less hull immersion but higher windage
  const draftFactor = isLaden ? 1.0 : 1.12;

  return Number((cbFactor * fnFactor * draftFactor).toFixed(3));
}

export interface SpeedLossResult {
  beaufortForce: number;
  seaCondition: SeaCondition;
  froudeNumber: number;
  cBeta: number;
  cU: number;
  cForm: number;
  percentSpeedLoss: number;        // Fraction of speed lost [0.0 - 0.85]
  effectiveSpeedKnots: number;     // Achieved speed over ground in knots
  addedResistancePercentage: number; // Estimated % increase in required thrust
}

/**
 * Evaluates the full Kwon-structured speed loss and effective speed over ground.
 */
export function kwonSpeedLoss(
  vessel: VesselProfile,
  plannedSpeedKnots: number,
  beaufortForce: number,
  seaCondition: SeaCondition,
  isLaden: boolean = true
): SpeedLossResult {
  const speedMs = plannedSpeedKnots * 0.514444;
  const fn = froudeNumber(speedMs, vessel.lengthLpp);

  const cBeta = calculateDirectionCoefficient(seaCondition, beaufortForce);
  const cU = calculateLoadingCoefficient(vessel, fn, isLaden);
  const cForm = vessel.kwonFormFactorCForm || 5.0;
  const exponentP = vessel.kwonSpeedLossExponentP || 1.15;

  // Normalized Kwon core equation:
  // Speed loss ratio grows as a power of Beaufort force normalized to Force 12
  const normalizedSeaState = Math.min(1.0, beaufortForce / 12.0);
  const powerFactor = Math.pow(normalizedSeaState, exponentP * 1.6);

  const rawSpeedLossRatio = (cBeta * cU * cForm * powerFactor) / 10.0;

  // Clamp speed loss to practical operational limits [0%, 85%]
  // (Even in Force 12, vessel maintains steerage headway unless disabled)
  const percentSpeedLoss = Number(Math.max(0.0, Math.min(0.85, rawSpeedLossRatio)).toFixed(4));
  
  // Effective speed cannot fall below vessel's minimum steerage speed
  const calculatedSpeed = plannedSpeedKnots * (1.0 - percentSpeedLoss);
  const effectiveSpeedKnots = Number(
    Math.max(vessel.minSteerageSpeedKnots, calculatedSpeed).toFixed(2)
  );

  const addedResistancePercentage = Number((percentSpeedLoss * 180).toFixed(1));

  return {
    beaufortForce,
    seaCondition,
    froudeNumber: fn,
    cBeta,
    cU,
    cForm,
    percentSpeedLoss,
    effectiveSpeedKnots,
    addedResistancePercentage,
  };
}
