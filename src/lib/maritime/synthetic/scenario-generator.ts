/**
 * ============================================================================
 * SYNTHETIC SCENARIO GENERATOR (STRATIFIED TRADE-LANE SAMPLING)
 * ============================================================================
 * Samples across real maritime trade lanes, vessel classes, draft loading 
 * states, and historical seasonal weather windows (2019-2024).
 */

import { VesselClass, VesselProfile, VESSEL_PROFILES, resolveVesselProfile } from "../vessel-profiles";
import { densifyRoute, DecomposedWaypoint } from "../route-decomposition";

export interface ReferenceLane {
  id: string;
  name: string;
  category: "asia_europe" | "transpacific" | "transatlantic" | "middle_east_asia" | "south_atlantic" | "australasia";
  points: { lat: number; lng: number }[];
}

export const ALL_VESSEL_CLASSES: VesselClass[] = [
  "Container_UltraLarge",
  "Container_PostPanamax",
  "Container_Feeder",
  "Bulk_Capesize",
  "Bulk_Panamax",
  "Bulk_Handymax",
  "Tanker_VLCC",
  "Tanker_Aframax",
  "LNG_Carrier",
  "HeavyLift_ProjectCargo",
  "RoRo_VehicleCarrier",
];

export const REFERENCE_LANES: ReferenceLane[] = [
  {
    id: "MUMBAI_ROTTERDAM_SUEZ",
    name: "Mumbai to Rotterdam (via Suez Canal & Bab-el-Mandeb)",
    category: "asia_europe",
    points: [
      { lat: 18.95, lng: 72.85 },   // Mumbai Port
      { lat: 12.00, lng: 44.00 },   // Gulf of Aden
      { lat: 12.60, lng: 43.30 },   // Bab-el-Mandeb Strait
      { lat: 27.50, lng: 34.00 },   // Red Sea North
      { lat: 29.95, lng: 32.55 },   // Suez Canal
      { lat: 31.50, lng: 32.30 },   // Port Said (Med Entrance)
      { lat: 36.10, lng: -5.35 },   // Strait of Gibraltar
      { lat: 48.50, lng: -5.50 },   // English Channel West
      { lat: 51.95, lng: 4.10 },    // Port of Rotterdam
    ],
  },
  {
    id: "SHANGHAI_LOS_ANGELES",
    name: "Shanghai to Los Angeles (Great-Circle Transpacific)",
    category: "transpacific",
    points: [
      { lat: 31.20, lng: 121.60 },  // Port of Shanghai
      { lat: 34.00, lng: 130.00 },  // East China Sea
      { lat: 42.00, lng: 170.00 },  // Mid North Pacific GC Apex
      { lat: 35.00, lng: -125.00 }, // US West Coast Approach
      { lat: 33.74, lng: -118.25 }, // Port of Los Angeles
    ],
  },
  {
    id: "SANTOS_ROTTERDAM",
    name: "Santos to Rotterdam (South-North Atlantic)",
    category: "south_atlantic",
    points: [
      { lat: -23.96, lng: -46.30 }, // Port of Santos, Brazil
      { lat: -5.00, lng: -34.00 },  // Cape Sao Roque
      { lat: 15.00, lng: -25.00 },  // Cape Verde Basin
      { lat: 36.00, lng: -10.00 },  // Cape St. Vincent
      { lat: 51.95, lng: 4.10 },    // Rotterdam
    ],
  },
  {
    id: "RAS_TANURA_NINGBO",
    name: "Ras Tanura to Ningbo (Middle East - China VLCC Corridor)",
    category: "middle_east_asia",
    points: [
      { lat: 26.65, lng: 50.15 },   // Ras Tanura Terminal
      { lat: 26.20, lng: 56.40 },   // Strait of Hormuz
      { lat: 6.00, lng: 80.00 },    // Sri Lanka South
      { lat: 5.50, lng: 97.50 },    // Malacca Entrance
      { lat: 1.25, lng: 103.85 },   // Singapore Strait
      { lat: 12.00, lng: 112.00 },  // South China Sea
      { lat: 29.88, lng: 122.00 },  // Port of Ningbo-Zhoushan
    ],
  },
  {
    id: "DAMPIER_QINGDAO",
    name: "Dampier to Qingdao (Australia - China Capesize Ore Route)",
    category: "australasia",
    points: [
      { lat: -20.65, lng: 116.70 }, // Dampier Port (Pilbara Iron Ore)
      { lat: -8.50, lng: 115.50 },  // Lombok Strait
      { lat: 3.00, lng: 119.00 },   // Makassar Strait
      { lat: 20.00, lng: 121.50 },  // Luzon Strait
      { lat: 36.05, lng: 120.30 },  // Port of Qingdao
    ],
  },
  {
    id: "HOUSTON_ROTTERDAM",
    name: "Houston to Rotterdam (Transatlantic Chemical/Energy Route)",
    category: "transatlantic",
    points: [
      { lat: 29.75, lng: -95.35 },  // Port of Houston
      { lat: 24.50, lng: -83.00 },  // Florida Straits
      { lat: 38.00, lng: -50.00 },  // Mid-North Atlantic
      { lat: 49.50, lng: -6.00 },   // English Channel West
      { lat: 51.95, lng: 4.10 },    // Rotterdam
    ],
  },
];

export interface ScenarioParams {
  laneIndex: number;
  vesselClass: VesselClass;
  isLaden: boolean;
  departureMonth: number; // 1-12 (seasonal monsoon / winter storm variation)
  departureYear: number;  // 2019-2024 historical ERA5 archive
}

export interface GeneratedScenario extends ScenarioParams {
  id: string;
  lane: ReferenceLane;
  waypoints: DecomposedWaypoint[];
  vessel: VesselProfile;
  departureTime: Date;
}

/**
 * Generates a Latin hypercube-stratified parameter grid covering all major trade 
 * corridors, ship types, seasons, and loading conditions.
 */
export function generateScenarioGrid(samplesPerCell: number = 1): ScenarioParams[] {
  const grid: ScenarioParams[] = [];

  for (let laneIdx = 0; laneIdx < REFERENCE_LANES.length; laneIdx++) {
    for (const vesselClass of ALL_VESSEL_CLASSES) {
      for (const isLaden of [true, false]) {
        for (let month = 1; month <= 12; month++) {
          for (let s = 0; s < samplesPerCell; s++) {
            const departureYear = 2019 + (s % 5); // Spread across 5 years of historical weather
            grid.push({
              laneIndex: laneIdx,
              vesselClass,
              isLaden,
              departureMonth: month,
              departureYear,
            });
          }
        }
      }
    }
  }

  return grid;
}

/**
 * Materializes full route waypoints and vessel physics profiles for a scenario.
 */
export function materializeScenario(
  params: ScenarioParams,
  getVessel: (cls: string) => VesselProfile = resolveVesselProfile
): GeneratedScenario {
  const lane = REFERENCE_LANES[params.laneIndex] || REFERENCE_LANES[0];
  const waypoints = densifyRoute(lane.points);
  const departureTime = new Date(Date.UTC(params.departureYear, params.departureMonth - 1, 1, 0, 0, 0));
  const id = `scen_${lane.id}_${params.vesselClass}_${params.isLaden ? "laden" : "ballast"}_${params.departureYear}_m${params.departureMonth}`;

  return {
    ...params,
    id,
    lane,
    waypoints,
    vessel: getVessel(params.vesselClass),
    departureTime,
  };
}
