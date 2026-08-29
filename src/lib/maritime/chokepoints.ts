/**
 * ============================================================================
 * MARITIME CHOKEPOINT CATALOG & CONGESTION/RESTRICTION DYNAMICS
 * ============================================================================
 * Strategic global shipping straits and canal waterways with distinct 
 * hydrodynamic constraints, pilotage delays, safe speeds, and queue distributions.
 */

export type ChokepointId =
  | "Suez_Canal"
  | "Panama_Canal"
  | "Strait_of_Malacca"
  | "Singapore_Strait"
  | "Bab_el_Mandeb"
  | "Strait_of_Hormuz"
  | "Dover_Strait"
  | "Strait_of_Gibraltar"
  | "Bosphorus_Strait"
  | "Danish_Straits";

export interface MaritimeChokepoint {
  id: ChokepointId;
  name: string;
  category: "canal" | "strait" | "restricted_channel";
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  
  // Navigation & Operational Constraints
  speedLimitKnots: number;        // Maximum mandated safe transit speed
  typicalTransitHours: number;    // Standard canal transit time excluding wait
  averageQueuingHours: number;    // Baseline anchorage / convoy wait time
  isConvoysScheduled: boolean;    // Whether transit occurs in timed convoys (e.g. Suez)
  colregsSpeedRestricted: boolean;// Strict speed reduction under low visibility
  
  // Risk & Disruption Factors
  geopoliticalRiskLevel: "low" | "medium" | "high" | "critical";
  rerouteAlternativeName?: string;
  rerouteExtraDays?: number;
}

export const MARITIME_CHOKEPOINTS: Record<ChokepointId, MaritimeChokepoint> = {
  Suez_Canal: {
    id: "Suez_Canal",
    name: "Suez Canal (Port Said to Port Tewfik)",
    category: "canal",
    bounds: { minLat: 29.85, maxLat: 31.35, minLng: 32.25, maxLng: 32.65 },
    speedLimitKnots: 8.5,
    typicalTransitHours: 14.0,
    averageQueuingHours: 18.0,
    isConvoysScheduled: true,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "high",
    rerouteAlternativeName: "Cape of Good Hope",
    rerouteExtraDays: 10.5,
  },

  Panama_Canal: {
    id: "Panama_Canal",
    name: "Panama Canal (Colon to Balboa)",
    category: "canal",
    bounds: { minLat: 8.85, maxLat: 9.40, minLng: -80.05, maxLng: -79.50 },
    speedLimitKnots: 6.0,
    typicalTransitHours: 10.0,
    averageQueuingHours: 36.0,
    isConvoysScheduled: true,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "medium",
    rerouteAlternativeName: "Cape Horn / Magellan Strait",
    rerouteExtraDays: 14.0,
  },

  Strait_of_Malacca: {
    id: "Strait_of_Malacca",
    name: "Strait of Malacca Traffic Separation Scheme",
    category: "strait",
    bounds: { minLat: 1.20, maxLat: 5.80, minLng: 97.50, maxLng: 103.50 },
    speedLimitKnots: 12.0,
    typicalTransitHours: 24.0,
    averageQueuingHours: 2.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "medium",
    rerouteAlternativeName: "Sunda Strait / Lombok Strait",
    rerouteExtraDays: 2.5,
  },

  Singapore_Strait: {
    id: "Singapore_Strait",
    name: "Singapore Strait TSS & Anchorage Fairway",
    category: "restricted_channel",
    bounds: { minLat: 1.10, maxLat: 1.45, minLng: 103.50, maxLng: 104.40 },
    speedLimitKnots: 10.0,
    typicalTransitHours: 4.5,
    averageQueuingHours: 6.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "low",
  },

  Bab_el_Mandeb: {
    id: "Bab_el_Mandeb",
    name: "Bab-el-Mandeb Strait (Red Sea Gateway)",
    category: "strait",
    bounds: { minLat: 12.40, maxLat: 13.50, minLng: 43.10, maxLng: 43.65 },
    speedLimitKnots: 16.0, // High-speed transit for security
    typicalTransitHours: 5.0,
    averageQueuingHours: 0.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: false,
    geopoliticalRiskLevel: "critical",
    rerouteAlternativeName: "Cape of Good Hope",
    rerouteExtraDays: 11.0,
  },

  Strait_of_Hormuz: {
    id: "Strait_of_Hormuz",
    name: "Strait of Hormuz (Persian Gulf TSS)",
    category: "strait",
    bounds: { minLat: 25.90, maxLat: 26.90, minLng: 55.80, maxLng: 56.90 },
    speedLimitKnots: 15.0,
    typicalTransitHours: 6.0,
    averageQueuingHours: 4.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "high",
  },

  Dover_Strait: {
    id: "Dover_Strait",
    name: "Dover Strait / Pas-de-Calais TSS",
    category: "strait",
    bounds: { minLat: 50.80, maxLat: 51.30, minLng: 1.00, maxLng: 1.90 },
    speedLimitKnots: 12.0,
    typicalTransitHours: 3.5,
    averageQueuingHours: 0.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "low",
  },

  Strait_of_Gibraltar: {
    id: "Strait_of_Gibraltar",
    name: "Strait of Gibraltar (Atlantic-Med Portal)",
    category: "strait",
    bounds: { minLat: 35.80, maxLat: 36.20, minLng: -5.90, maxLng: -5.20 },
    speedLimitKnots: 15.0,
    typicalTransitHours: 3.0,
    averageQueuingHours: 0.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "low",
  },

  Bosphorus_Strait: {
    id: "Bosphorus_Strait",
    name: "Turkish Straits (Bosphorus & Dardanelles)",
    category: "restricted_channel",
    bounds: { minLat: 40.90, maxLat: 41.30, minLng: 28.90, maxLng: 29.20 },
    speedLimitKnots: 10.0,
    typicalTransitHours: 5.0,
    averageQueuingHours: 14.0,
    isConvoysScheduled: true,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "medium",
  },

  Danish_Straits: {
    id: "Danish_Straits",
    name: "Danish Straits (Great Belt & The Sound)",
    category: "restricted_channel",
    bounds: { minLat: 54.80, maxLat: 56.20, minLng: 10.50, maxLng: 12.80 },
    speedLimitKnots: 11.0,
    typicalTransitHours: 8.0,
    averageQueuingHours: 2.0,
    isConvoysScheduled: false,
    colregsSpeedRestricted: true,
    geopoliticalRiskLevel: "low",
  },
};

/**
 * Checks whether a given coordinate falls inside a known maritime chokepoint.
 */
export function identifyChokepoint(lat: number, lng: number): MaritimeChokepoint | null {
  for (const key of Object.keys(MARITIME_CHOKEPOINTS) as ChokepointId[]) {
    const cp = MARITIME_CHOKEPOINTS[key];
    if (
      lat >= cp.bounds.minLat &&
      lat <= cp.bounds.maxLat &&
      lng >= cp.bounds.minLng &&
      lng <= cp.bounds.maxLng
    ) {
      return cp;
    }
  }
  return null;
}
