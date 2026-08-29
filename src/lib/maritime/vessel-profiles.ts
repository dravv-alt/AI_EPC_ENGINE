/**
 * ============================================================================
 * MARITIME DOMAIN FOUNDATIONS: VESSEL PROFILES & NAVAL ARCHITECTURE COEFFICIENTS
 * ============================================================================
 * Sourced from IMO GISIS standards, MarineTraffic vessel registries, 
 * and MAN Energy Solutions marine propulsion empirical design handbooks.
 */

export type VesselClass =
  | "Container_UltraLarge"     // 18,000 - 24,000 TEU (Megamax)
  | "Container_PostPanamax"    // 8,000 - 14,000 TEU
  | "Container_Feeder"         // 1,000 - 3,000 TEU
  | "Bulk_Capesize"            // 150,000 - 200,000 DWT
  | "Bulk_Panamax"             // 65,000 - 85,000 DWT
  | "Bulk_Handymax"            // 40,000 - 60,000 DWT (Supramax/Handymax)
  | "Tanker_VLCC"              // 200,000 - 320,000 DWT
  | "Tanker_Aframax"           // 80,000 - 120,000 DWT
  | "LNG_Carrier"              // 140,000 - 180,000 m³ Q-Flex / Conventional
  | "HeavyLift_ProjectCargo"   // 15,000 - 30,000 DWT EPC Modular Transporters
  | "RoRo_VehicleCarrier";     // 6,000 - 8,500 CEU Pure Car/Truck Carrier

export interface VesselProfile {
  id: VesselClass;
  name: string;
  category: "container" | "bulker" | "tanker" | "gas" | "specialized";
  
  // Principal Dimensions (Meters)
  lengthLpp: number;           // Length between perpendiculars (Lpp) in meters
  beam: number;                // Molded beam (B) in meters
  draftLaden: number;          // Full design load draft (T_laden) in meters
  draftBallast: number;        // Ballast/lightweight draft (T_ballast) in meters
  
  // Hydrodynamic & Form Coefficients
  blockCoefficient: number;    // Block Coefficient (Cb = Displacement / (Lpp * B * T))
  displacementLadenM3: number; // Molded volume displacement laden (m³)
  displacementBallastM3: number;// Molded volume displacement ballast (m³)
  
  // Aerodynamic & Windage Characteristics
  windageFrontalAreaM2: number;// Frontal projected windage area (A_F) in m²
  windageLateralAreaM2: number;// Lateral projected windage area (A_L) in m²
  
  // Operational Speeds & Propulsion
  serviceSpeedKnots: number;   // Design calm-water cruise speed (Vs) in knots
  minSteerageSpeedKnots: number;// Minimum speed to maintain rudder control in severe seas
  froudeNumberDesign: number;  // Froude number (Fn = Vs / sqrt(g * Lpp))
  
  // Kwon (2008) Empirical Resistance Parameters
  kwonSpeedLossExponentP: number; // Exponent p in Kwon formula (typically 1.0 - 2.0)
  kwonFormFactorCForm: number;    // C_Form parameter for ship geometry
}

/**
 * Standardized Global Vessel Profiles based on authentic naval architecture registries
 */
export const VESSEL_PROFILES: Record<VesselClass, VesselProfile> = {
  Container_UltraLarge: {
    id: "Container_UltraLarge",
    name: "Ultra Large Container Vessel (ULCV 20k+ TEU)",
    category: "container",
    lengthLpp: 385.0,
    beam: 59.0,
    draftLaden: 16.0,
    draftBallast: 10.5,
    blockCoefficient: 0.66,
    displacementLadenM3: 240000,
    displacementBallastM3: 155000,
    windageFrontalAreaM2: 1580,
    windageLateralAreaM2: 12500,
    serviceSpeedKnots: 21.5,
    minSteerageSpeedKnots: 6.0,
    froudeNumberDesign: 0.18,
    kwonSpeedLossExponentP: 1.15,
    kwonFormFactorCForm: 5.8,
  },

  Container_PostPanamax: {
    id: "Container_PostPanamax",
    name: "Post-Panamax Container Ship (10k TEU)",
    category: "container",
    lengthLpp: 320.0,
    beam: 48.2,
    draftLaden: 15.0,
    draftBallast: 9.8,
    blockCoefficient: 0.65,
    displacementLadenM3: 150000,
    displacementBallastM3: 98000,
    windageFrontalAreaM2: 1250,
    windageLateralAreaM2: 9200,
    serviceSpeedKnots: 20.0,
    minSteerageSpeedKnots: 5.5,
    froudeNumberDesign: 0.185,
    kwonSpeedLossExponentP: 1.18,
    kwonFormFactorCForm: 6.0,
  },

  Container_Feeder: {
    id: "Container_Feeder",
    name: "Regional Feeder Container (2.5k TEU)",
    category: "container",
    lengthLpp: 195.0,
    beam: 30.2,
    draftLaden: 11.5,
    draftBallast: 7.2,
    blockCoefficient: 0.63,
    displacementLadenM3: 42500,
    displacementBallastM3: 26000,
    windageFrontalAreaM2: 650,
    windageLateralAreaM2: 3800,
    serviceSpeedKnots: 18.0,
    minSteerageSpeedKnots: 4.5,
    froudeNumberDesign: 0.21,
    kwonSpeedLossExponentP: 1.25,
    kwonFormFactorCForm: 6.5,
  },

  Bulk_Capesize: {
    id: "Bulk_Capesize",
    name: "Capesize Bulk Carrier (180k DWT)",
    category: "bulker",
    lengthLpp: 282.0,
    beam: 45.0,
    draftLaden: 18.2,
    draftBallast: 9.2,
    blockCoefficient: 0.85,
    displacementLadenM3: 196000,
    displacementBallastM3: 98000,
    windageFrontalAreaM2: 720,
    windageLateralAreaM2: 3100,
    serviceSpeedKnots: 14.2,
    minSteerageSpeedKnots: 4.0,
    froudeNumberDesign: 0.14,
    kwonSpeedLossExponentP: 1.05,
    kwonFormFactorCForm: 4.8,
  },

  Bulk_Panamax: {
    id: "Bulk_Panamax",
    name: "Panamax Bulk Carrier (75k DWT)",
    category: "bulker",
    lengthLpp: 218.0,
    beam: 32.2,
    draftLaden: 14.4,
    draftBallast: 7.5,
    blockCoefficient: 0.84,
    displacementLadenM3: 84000,
    displacementBallastM3: 43000,
    windageFrontalAreaM2: 520,
    windageLateralAreaM2: 2400,
    serviceSpeedKnots: 14.0,
    minSteerageSpeedKnots: 3.8,
    froudeNumberDesign: 0.155,
    kwonSpeedLossExponentP: 1.10,
    kwonFormFactorCForm: 5.1,
  },

  Bulk_Handymax: {
    id: "Bulk_Handymax",
    name: "Supramax / Handymax Bulker (55k DWT)",
    category: "bulker",
    lengthLpp: 182.0,
    beam: 32.2,
    draftLaden: 12.8,
    draftBallast: 6.8,
    blockCoefficient: 0.82,
    displacementLadenM3: 61000,
    displacementBallastM3: 31500,
    windageFrontalAreaM2: 480,
    windageLateralAreaM2: 2100,
    serviceSpeedKnots: 14.0,
    minSteerageSpeedKnots: 3.5,
    froudeNumberDesign: 0.17,
    kwonSpeedLossExponentP: 1.12,
    kwonFormFactorCForm: 5.3,
  },

  Tanker_VLCC: {
    id: "Tanker_VLCC",
    name: "Very Large Crude Carrier (VLCC 300k DWT)",
    category: "tanker",
    lengthLpp: 324.0,
    beam: 60.0,
    draftLaden: 21.5,
    draftBallast: 10.2,
    blockCoefficient: 0.82,
    displacementLadenM3: 345000,
    displacementBallastM3: 160000,
    windageFrontalAreaM2: 890,
    windageLateralAreaM2: 4200,
    serviceSpeedKnots: 15.0,
    minSteerageSpeedKnots: 4.5,
    froudeNumberDesign: 0.138,
    kwonSpeedLossExponentP: 1.04,
    kwonFormFactorCForm: 4.6,
  },

  Tanker_Aframax: {
    id: "Tanker_Aframax",
    name: "Aframax Crude/Product Tanker (115k DWT)",
    category: "tanker",
    lengthLpp: 238.0,
    beam: 44.0,
    draftLaden: 15.0,
    draftBallast: 7.8,
    blockCoefficient: 0.81,
    displacementLadenM3: 128000,
    displacementBallastM3: 65000,
    windageFrontalAreaM2: 640,
    windageLateralAreaM2: 2900,
    serviceSpeedKnots: 14.5,
    minSteerageSpeedKnots: 4.0,
    froudeNumberDesign: 0.155,
    kwonSpeedLossExponentP: 1.08,
    kwonFormFactorCForm: 4.9,
  },

  LNG_Carrier: {
    id: "LNG_Carrier",
    name: "Liquefied Natural Gas Carrier (174k m³ Membrane)",
    category: "gas",
    lengthLpp: 285.0,
    beam: 45.8,
    draftLaden: 12.2,
    draftBallast: 9.5,
    blockCoefficient: 0.74,
    displacementLadenM3: 118000,
    displacementBallastM3: 92000,
    windageFrontalAreaM2: 1100,
    windageLateralAreaM2: 7200,
    serviceSpeedKnots: 19.5,
    minSteerageSpeedKnots: 5.0,
    froudeNumberDesign: 0.19,
    kwonSpeedLossExponentP: 1.20,
    kwonFormFactorCForm: 5.7,
  },

  HeavyLift_ProjectCargo: {
    id: "HeavyLift_ProjectCargo",
    name: "Heavy-Lift EPC Project Cargo / Module Carrier",
    category: "specialized",
    lengthLpp: 162.0,
    beam: 38.0,
    draftLaden: 9.2,
    draftBallast: 5.4,
    blockCoefficient: 0.78,
    displacementLadenM3: 44000,
    displacementBallastM3: 25000,
    windageFrontalAreaM2: 950, // High windage due to oversized modular topsides
    windageLateralAreaM2: 4600,
    serviceSpeedKnots: 13.5,
    minSteerageSpeedKnots: 3.5,
    froudeNumberDesign: 0.175,
    kwonSpeedLossExponentP: 1.30, // High sensitivity to beam seas & aerodynamic drag
    kwonFormFactorCForm: 6.2,
  },

  RoRo_VehicleCarrier: {
    id: "RoRo_VehicleCarrier",
    name: "Pure Car/Truck Carrier (PCTC 7,000 CEU)",
    category: "specialized",
    lengthLpp: 192.0,
    beam: 32.2,
    draftLaden: 10.0,
    draftBallast: 7.8,
    blockCoefficient: 0.58,
    displacementLadenM3: 38000,
    displacementBallastM3: 29000,
    windageFrontalAreaM2: 980, // Enormous slab-sided superstructure windage
    windageLateralAreaM2: 6800,
    serviceSpeedKnots: 19.0,
    minSteerageSpeedKnots: 4.5,
    froudeNumberDesign: 0.22,
    kwonSpeedLossExponentP: 1.35,
    kwonFormFactorCForm: 6.8,
  },
};

/**
 * Resolves the appropriate vessel profile for a given shipment mode, payload, and deadweight.
 */
export function resolveVesselProfile(
  vesselClass?: VesselClass | string | null,
  transportMode: "sea" | "air" | "land" = "sea"
): VesselProfile {
  if (vesselClass && vesselClass in VESSEL_PROFILES) {
    return VESSEL_PROFILES[vesselClass as VesselClass];
  }
  // Default to EPC Heavy-Lift / Post-Panamax for general maritime cargo
  return VESSEL_PROFILES.HeavyLift_ProjectCargo;
}
