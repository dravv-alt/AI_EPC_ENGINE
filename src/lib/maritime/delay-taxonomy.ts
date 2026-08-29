/**
 * ============================================================================
 * MARITIME DELAY TAXONOMY & CAUSAL ATTRIBUTION SCHEMA
 * ============================================================================
 * Structured classification of delays across hydrodynamics, meteorology, 
 * canal queuing, terminal congestion, and security events.
 */

export type DelayCategory = 
  | "weather_hydrodynamic"    // Added resistance from wind, sea state, and swell
  | "weather_visibility"      // COLREGS safe-speed restrictions under fog/squall
  | "weather_ice"             // Polar/winter pack-ice and sub-zero accretion
  | "chokepoint_queuing"      // Canal convoy delays and strait pilotage queues
  | "port_congestion"         // Anchorage waiting time for berth availability
  | "security_rerouting"      // High-risk area diversion (e.g. Cape of Good Hope)
  | "customs_inspection";     // Regulatory / port state control hold

export type DelaySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface DelayTaxonomyEntry {
  code: string;
  category: DelayCategory;
  name: string;
  description: string;
  severity: DelaySeverity;
  isRecoverable: boolean;     // Whether vessel can make up time by increasing throttle
  epcMilestoneImpact: boolean;// Whether this delay shifts critical construction timelines
  attributionFormula: string; // Documented engineering formula or heuristic
}

export const DELAY_TAXONOMY: Record<string, DelayTaxonomyEntry> = {
  // 1. Weather Hydrodynamic Causes
  WIND_WAVE_HEAD_SEAS: {
    code: "WIND_WAVE_HEAD_SEAS",
    category: "weather_hydrodynamic",
    name: "Head Seas Added Resistance (Kwon 2008)",
    description: "Opposing wind and swell (relative angle < 45°) causing severe hydrodynamic speed loss and hull pitch/slamming.",
    severity: "WARNING",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "Kwon (2008) Directional Resistance: delta_V = C_beta * C_u * C_Form * (B/12)^p",
  },

  WIND_WAVE_BEAM_SEAS: {
    code: "WIND_WAVE_BEAM_SEAS",
    category: "weather_hydrodynamic",
    name: "Beam Seas & Roll Motion Mitigation",
    description: "Transverse winds and lateral wave action (relative angle 60°-120°) forcing course zig-zagging or speed reduction to prevent cargo shift.",
    severity: "WARNING",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "IMO Intact Stability Code 2008 & Kwon Beam Resistance Model",
  },

  WIND_WAVE_FOLLOWING_SEAS: {
    code: "WIND_WAVE_FOLLOWING_SEAS",
    category: "weather_hydrodynamic",
    name: "Following Seas & Surf-Riding Risk",
    description: "Overtaking wave trains requiring speed adjustment to prevent broaching-to or parametric rolling in high swell.",
    severity: "INFO",
    isRecoverable: true,
    epcMilestoneImpact: false,
    attributionFormula: "Hydrodynamic Surf-Riding / Broaching Boundary Equation",
  },

  TROPICAL_CYCLONE_DIVERSION: {
    code: "TROPICAL_CYCLONE_DIVERSION",
    category: "weather_hydrodynamic",
    name: "Tropical Cyclone / Typhoon Evasion Course",
    description: "Vessel forced into 50-150 nm lateral course deviation to avoid dangerous semi-circle of cyclonic storm.",
    severity: "CRITICAL",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "Mariners 1-2-3 Rule (34-knot wind radius evasion buffer)",
  },

  // 2. Weather Visibility & COLREGS Restrictions
  VISIBILITY_FOG_COLREGS: {
    code: "VISIBILITY_FOG_COLREGS",
    category: "weather_visibility",
    name: "COLREGS Rule 19 Safe-Speed Restriction",
    description: "Dense sea fog or low visibility (< 1.0 nm) in high-traffic fairways mandating speed reduction to steerage speed.",
    severity: "WARNING",
    isRecoverable: true,
    epcMilestoneImpact: true,
    attributionFormula: "COLREGS Safe Speed Model: V_safe = min(V_service, 6.0 + 2.0 * Visibility_nm)",
  },

  // 3. Chokepoint Queuing
  SUEZ_CONVOY_QUEUE: {
    code: "SUEZ_CONVOY_QUEUE",
    category: "chokepoint_queuing",
    name: "Suez Canal Convoy Anchorage Wait",
    description: "Anchorage waiting time at Port Said or Great Bitter Lakes awaiting timed south/northbound convoy entry.",
    severity: "WARNING",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "SCA Convoy Timetable Distribution (12-24h Poisson model)",
  },

  PANAMA_DRAFT_LOCK_RESTRICTION: {
    code: "PANAMA_DRAFT_LOCK_RESTRICTION",
    category: "chokepoint_queuing",
    name: "Panama Canal Gatun Lake Restriction",
    description: "Freshwater draft constraints or Neopanamax slot reservation queue holding vessel at anchorage.",
    severity: "WARNING",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "ACP Neopanamax Booking Slot & Queue Model",
  },

  // 4. Port Congestion & Operations
  PORT_BERTH_CONGESTION: {
    code: "PORT_BERTH_CONGESTION",
    category: "port_congestion",
    name: "Terminal Berth Waiting & Pilotage Delay",
    description: "Seaport terminal berth unavailability, crane maintenance, or pilot boarding delays at outer roadstead.",
    severity: "WARNING",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "M/M/c Port Queueing Theory (Berth Occupancy Ratio > 75%)",
  },

  // 5. Security & Geopolitical Rerouting
  SECURITY_RED_SEA_DIVERSION: {
    code: "SECURITY_RED_SEA_DIVERSION",
    category: "security_rerouting",
    name: "Bab-el-Mandeb Security Reroute via Cape of Good Hope",
    description: "Geopolitical threat avoidance diverting vessel around the African continent (+3,500 nm / +10-14 days).",
    severity: "CRITICAL",
    isRecoverable: false,
    epcMilestoneImpact: true,
    attributionFormula: "Geodesic Cape Route Distance Delta: delta_T = 3500 nm / Vs",
  },
};
