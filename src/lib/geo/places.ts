export type PlaceType = 'port' | 'airport' | 'city';

export interface Place {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  type: PlaceType;
  seaRouteWaypoints?: [number, number][]; // Ordered waypoints from port to open sea
}

export const places: Place[] = [
  // Major Ports
  { id: 'p_nhavasheva', name: 'Nhava Sheva', country: 'India', lat: 18.949, lng: 72.951, type: 'port', seaRouteWaypoints: [[18.92, 72.90], [18.88, 72.82], [18.80, 72.75]] }, // Mumbai port exit
  { id: 'p_nynj', name: 'Port of New York and New Jersey', country: 'United States', lat: 40.670, lng: -74.043, type: 'port', seaRouteWaypoints: [[40.60, -74.04], [40.54, -73.98], [40.48, -73.85]] },
  { id: 'p_houston', name: 'Port of Houston', country: 'United States', lat: 29.743, lng: -95.271, type: 'port', seaRouteWaypoints: [[29.65, -95.00], [29.35, -94.75], [29.25, -94.60]] }, // Galveston Bay exit
  { id: 'p_shanghai', name: 'Port of Shanghai', country: 'China', lat: 31.350, lng: 121.573, type: 'port' },
  { id: 'p_singapore', name: 'Port of Singapore', country: 'Singapore', lat: 1.266, lng: 103.829, type: 'port' },
  { id: 'p_rotterdam', name: 'Port of Rotterdam', country: 'Netherlands', lat: 51.949, lng: 4.145, type: 'port' },
  { id: 'p_losangeles', name: 'Port of Los Angeles', country: 'United States', lat: 33.729, lng: -118.262, type: 'port' },
  { id: 'p_hamburg', name: 'Port of Hamburg', country: 'Germany', lat: 53.541, lng: 9.967, type: 'port', seaRouteWaypoints: [[53.60, 9.50], [53.85, 9.00], [54.00, 8.50]] }, // Elbe river exit

  // Major Airports
  { id: 'a_jfk', name: 'John F. Kennedy International Airport', country: 'United States', lat: 40.641, lng: -73.778, type: 'airport' },
  { id: 'a_dxb', name: 'Dubai International Airport', country: 'United Arab Emirates', lat: 25.253, lng: 55.365, type: 'airport' },
  { id: 'a_fra', name: 'Frankfurt Airport', country: 'Germany', lat: 50.037, lng: 8.562, type: 'airport' },
  { id: 'a_hkg', name: 'Hong Kong International Airport', country: 'Hong Kong', lat: 22.308, lng: 113.914, type: 'airport' },
  { id: 'a_ord', name: 'O\'Hare International Airport', country: 'United States', lat: 41.974, lng: -87.907, type: 'airport' },
  { id: 'a_bom', name: 'Chhatrapati Shivaji Maharaj International Airport', country: 'India', lat: 19.090, lng: 72.867, type: 'airport' },

  // Major Cities
  { id: 'c_mumbai', name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.877, type: 'city' },
  { id: 'c_nyc', name: 'New York City', country: 'United States', lat: 40.712, lng: -74.006, type: 'city' },
  { id: 'c_houston', name: 'Houston', country: 'United States', lat: 29.760, lng: -95.369, type: 'city' },
  { id: 'c_london', name: 'London', country: 'United Kingdom', lat: 51.507, lng: -0.127, type: 'city' },
  { id: 'c_tokyo', name: 'Tokyo', country: 'Japan', lat: 35.676, lng: 139.650, type: 'city' },
  { id: 'c_pune', name: 'Pune', country: 'India', lat: 18.520, lng: 73.856, type: 'city' }
];

export function searchLocalPlaces(query: string): Place[] {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  return places.filter(
    (place) =>
      place.name.toLowerCase().includes(lowerQuery) ||
      place.country.toLowerCase().includes(lowerQuery) ||
      place.id.toLowerCase().includes(lowerQuery)
  );
}
