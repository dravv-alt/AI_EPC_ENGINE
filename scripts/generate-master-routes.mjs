import fs from "node:fs";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error("Expected source and output paths");

const routes = [];
let active;
const finish = () => {
  if (!active) return;
  if (active.waypoints.length !== 12) throw new Error(`${active.id} has ${active.waypoints.length} waypoints; expected 12`);
  routes.push(active);
  active = undefined;
};

for (const line of fs.readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
  const heading = line.match(/^### ((?:SEA|AIR)-\d{2}-\d{2}) — (.+) → (.+) by (sea|air)$/);
  if (heading) {
    finish();
    active = {
      id: heading[1], mode: heading[4], origin: heading[2], destination: heading[3],
      provenance: heading[4] === "sea" ? "REPRESENTATIVE_MARITIME_CORRIDOR" : "GREAT_CIRCLE_WEATHER_SAMPLING",
      waypoints: [],
    };
    continue;
  }
  if (!active) continue;
  if (/^### /.test(line)) { finish(); continue; }
  const columns = line.split("|").slice(1, -1).map((part) => part.trim());
  if (columns.length !== 5 || !/^\d+$/.test(columns[0])) continue;
  const lat = Number(columns[2]);
  const lng = Number(columns[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  active.waypoints.push({ sequence: Number(columns[0]), name: columns[1], lat, lng, classification: columns[4] });
}
finish();

const seaCount = routes.filter((route) => route.mode === "sea").length;
const airCount = routes.filter((route) => route.mode === "air").length;
if (seaCount !== 56 || airCount !== 56) throw new Error(`Expected 56 sea and 56 air routes; found ${seaCount} sea and ${airCount} air`);

const beforeData = `// Generated from the EPC Multimodal Route & Weather Master Dataset Specification.
// Sea corridors are representative weather-sampling paths, not AIS-certified tracks.
// Air corridors are weather-sampling paths, not filed ATC flight plans.

export type MasterRouteMode = "sea" | "air";
export type MasterRouteProvenance = "REPRESENTATIVE_MARITIME_CORRIDOR" | "GREAT_CIRCLE_WEATHER_SAMPLING";

export interface MasterRouteWaypoint {
  sequence: number;
  name: string;
  lat: number;
  lng: number;
  classification: string;
}

export interface MasterRoute {
  id: string;
  mode: MasterRouteMode;
  origin: string;
  destination: string;
  provenance: MasterRouteProvenance;
  waypoints: MasterRouteWaypoint[];
}

export const MASTER_INTERNATIONAL_ROUTES: MasterRoute[] = `;

const afterData = `;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Resolve only exact gateway pairs. Reverse journeys reuse the controlled geometry. */
export function findMasterInternationalRoute(
  mode: MasterRouteMode,
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
  endpointToleranceKm = 8,
): MasterRoute | null {
  for (const route of MASTER_INTERNATIONAL_ROUTES) {
    if (route.mode !== mode) continue;
    const first = route.waypoints[0];
    const last = route.waypoints.at(-1);
    if (!first || !last) continue;
    const forward = haversineKm(originLat, originLng, first.lat, first.lng) <= endpointToleranceKm &&
      haversineKm(destinationLat, destinationLng, last.lat, last.lng) <= endpointToleranceKm;
    if (forward) return route;
    const reverse = haversineKm(originLat, originLng, last.lat, last.lng) <= endpointToleranceKm &&
      haversineKm(destinationLat, destinationLng, first.lat, first.lng) <= endpointToleranceKm;
    if (reverse) {
      return {
        ...route,
        id: route.id + "-R",
        origin: route.destination,
        destination: route.origin,
        waypoints: [...route.waypoints].reverse().map((waypoint, index) => ({ ...waypoint, sequence: index + 1 })),
      };
    }
  }
  return null;
}
`;

fs.writeFileSync(outputPath, beforeData + JSON.stringify(routes, null, 2) + afterData);
console.log(`Generated ${routes.length} routes (${seaCount} sea, ${airCount} air)`);
