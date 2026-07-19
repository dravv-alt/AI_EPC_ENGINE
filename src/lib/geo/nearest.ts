import { places, Place, PlaceType } from './places';

// Haversine formula to calculate distance in km between two coordinates
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

// Find nearest place of specific types
export function findNearest(lat: number, lng: number, types: PlaceType[]): Place | null {
  let nearest: Place | null = null;
  let minDistance = Infinity;

  const validPlaces = places.filter(p => types.includes(p.type));
  
  for (const place of validPlaces) {
    const dist = getDistance(lat, lng, place.lat, place.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = place;
    }
  }
  
  return nearest;
}

export function findNearestPort(lat: number, lng: number): Place | null {
  return findNearest(lat, lng, ['port']);
}

export function findNearestAirport(lat: number, lng: number): Place | null {
  return findNearest(lat, lng, ['airport']);
}

// Simple text search for the autocomplete
export function searchPlaces(query: string): Place[] {
  if (!query || query.trim() === '') return [];
  const q = query.toLowerCase().trim();
  
  return places.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.country.toLowerCase().includes(q)
  ).slice(0, 5); // return top 5
}
