export interface OceanRegion {
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const oceanRegions: OceanRegion[] = [
  { name: 'Indian Ocean', minLat: -40, maxLat: 30, minLng: 20, maxLng: 110 },
  { name: 'North Atlantic Ocean', minLat: 0, maxLat: 60, minLng: -80, maxLng: 10 },
  { name: 'South Atlantic Ocean', minLat: -60, maxLat: 0, minLng: -70, maxLng: 20 },
  { name: 'North Pacific Ocean', minLat: 0, maxLat: 60, minLng: 110, maxLng: 180 }, // simplified, ignoring anti-meridian crossing for now
  { name: 'North Pacific Ocean (East)', minLat: 0, maxLat: 60, minLng: -180, maxLng: -70 },
  { name: 'South Pacific Ocean', minLat: -60, maxLat: 0, minLng: 140, maxLng: 180 },
  { name: 'South Pacific Ocean (East)', minLat: -60, maxLat: 0, minLng: -180, maxLng: -70 },
  { name: 'Mediterranean Sea', minLat: 30, maxLat: 45, minLng: -5, maxLng: 35 },
  { name: 'Gulf of Mexico', minLat: 18, maxLat: 30, minLng: -98, maxLng: -81 },
];

export function getOceanRegion(lat: number, lng: number): string | null {
  for (const region of oceanRegions) {
    if (lat >= region.minLat && lat <= region.maxLat && lng >= region.minLng && lng <= region.maxLng) {
      return region.name;
    }
  }
  return null;
}
