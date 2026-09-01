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
  { id: 'p_nhavasheva', name: 'JNPA / Nhava Sheva', country: 'India', lat: 18.9453, lng: 72.9400, type: 'port', seaRouteWaypoints: [[18.92, 72.90], [18.88, 72.82], [18.80, 72.75]] }, // Mumbai port exit
  { id: 'p_haldia', name: 'Haldia Dock Complex', country: 'India', lat: 22.0333, lng: 88.0833, type: 'port' },
  { id: 'p_cochin', name: 'Cochin Port', country: 'India', lat: 9.9667, lng: 76.2667, type: 'port' },
  { id: 'p_krishnapatnam', name: 'Krishnapatnam Port', country: 'India', lat: 14.2528, lng: 80.1347, type: 'port' },
  { id: 'p_visakhapatnam', name: 'Visakhapatnam Port', country: 'India', lat: 17.6833, lng: 83.2833, type: 'port' },
  { id: 'p_chennai', name: 'Chennai Port', country: 'India', lat: 13.1000, lng: 80.3000, type: 'port' },
  { id: 'p_mangaluru', name: 'New Mangalore Port', country: 'India', lat: 12.9184, lng: 74.7716, type: 'port' },
  { id: 'p_nynj', name: 'Port Newark-Elizabeth', country: 'United States', lat: 40.6700, lng: -74.1500, type: 'port', seaRouteWaypoints: [[40.60, -74.04], [40.54, -73.98], [40.48, -73.85]] },
  { id: 'p_houston', name: 'Port of Houston', country: 'United States', lat: 29.743, lng: -95.271, type: 'port', seaRouteWaypoints: [[29.65, -95.00], [29.35, -94.75], [29.25, -94.60]] }, // Galveston Bay exit
  { id: 'p_shanghai', name: 'Yangshan Deep-Water Port', country: 'China', lat: 30.6300, lng: 122.0600, type: 'port' },
  { id: 'p_singapore', name: 'Port of Singapore', country: 'Singapore', lat: 1.266, lng: 103.829, type: 'port' },
  { id: 'p_rotterdam', name: 'Port of Rotterdam', country: 'Netherlands', lat: 51.949, lng: 4.145, type: 'port' },
  { id: 'p_losangeles', name: 'Port of Los Angeles', country: 'United States', lat: 33.729, lng: -118.262, type: 'port' },
  { id: 'p_hamburg', name: 'Port of Hamburg', country: 'Germany', lat: 53.5400, lng: 9.9300, type: 'port', seaRouteWaypoints: [[53.60, 9.50], [53.85, 9.00], [54.00, 8.50]] }, // Elbe river exit
  { id: 'p_genoa', name: 'Port of Genoa', country: 'Italy', lat: 44.4056, lng: 8.9463, type: 'port' },
  { id: 'p_lehavre', name: 'HAROPA Port - Le Havre', country: 'France', lat: 49.4820, lng: 0.1080, type: 'port' },
  { id: 'p_felixstowe', name: 'Port of Felixstowe', country: 'United Kingdom', lat: 51.9600, lng: 1.3500, type: 'port' },
  { id: 'p_yokohama', name: 'Port of Yokohama', country: 'Japan', lat: 35.4500, lng: 139.6400, type: 'port' },
  { id: 'p_khorfakkan', name: 'Port of Khor Fakkan', country: 'United Arab Emirates', lat: 25.359, lng: 56.359, type: 'port', seaRouteWaypoints: [[25.31, 56.48], [25.20, 56.70], [25.05, 57.05]] },
  { id: 'p_jebelali', name: 'Jebel Ali Port', country: 'United Arab Emirates', lat: 24.985, lng: 55.061, type: 'port', seaRouteWaypoints: [[24.92, 55.02], [24.75, 54.85], [24.55, 54.65]] },
  { id: 'p_colombo', name: 'Port of Colombo', country: 'Sri Lanka', lat: 6.953, lng: 79.844, type: 'port' },
  { id: 'p_portklang', name: 'Port Klang', country: 'Malaysia', lat: 2.999, lng: 101.392, type: 'port' },
  { id: 'p_portsaid', name: 'Port Said', country: 'Egypt', lat: 31.265, lng: 32.302, type: 'port' },

  // Major Airports
  { id: 'a_jfk', name: 'John F. Kennedy International Airport', country: 'United States', lat: 40.6413, lng: -73.7781, type: 'airport' },
  { id: 'a_dxb', name: 'Dubai International Airport', country: 'United Arab Emirates', lat: 25.253, lng: 55.365, type: 'airport' },
  { id: 'a_fra', name: 'Frankfurt Airport', country: 'Germany', lat: 50.0379, lng: 8.5622, type: 'airport' },
  { id: 'a_hkg', name: 'Hong Kong International Airport', country: 'Hong Kong', lat: 22.308, lng: 113.914, type: 'airport' },
  { id: 'a_ord', name: 'O\'Hare International Airport', country: 'United States', lat: 41.974, lng: -87.907, type: 'airport' },
  { id: 'a_bom', name: 'Chhatrapati Shivaji Maharaj International Airport', country: 'India', lat: 19.0916, lng: 72.8660, type: 'airport' },
  { id: 'a_pnq', name: 'Pune Airport', country: 'India', lat: 18.5825, lng: 73.9194, type: 'airport' },
  { id: 'a_ccu', name: 'Netaji Subhas Chandra Bose International Airport', country: 'India', lat: 22.6539, lng: 88.4467, type: 'airport' },
  { id: 'a_cok', name: 'Cochin International Airport', country: 'India', lat: 10.1520, lng: 76.4019, type: 'airport' },
  { id: 'a_hyd', name: 'Rajiv Gandhi International Airport', country: 'India', lat: 17.2403, lng: 78.4294, type: 'airport' },
  { id: 'a_vtz', name: 'Visakhapatnam Airport', country: 'India', lat: 17.7212, lng: 83.2246, type: 'airport' },
  { id: 'a_blr', name: 'Kempegowda International Airport', country: 'India', lat: 13.1986, lng: 77.7066, type: 'airport' },
  { id: 'a_ixe', name: 'Mangaluru International Airport', country: 'India', lat: 12.9621, lng: 74.8909, type: 'airport' },
  { id: 'a_pvg', name: 'Shanghai Pudong International Airport', country: 'China', lat: 31.1443, lng: 121.8083, type: 'airport' },
  { id: 'a_mxp', name: 'Milan Malpensa Airport', country: 'Italy', lat: 45.6306, lng: 8.7281, type: 'airport' },
  { id: 'a_cdg', name: 'Paris Charles de Gaulle Airport', country: 'France', lat: 49.0097, lng: 2.5479, type: 'airport' },
  { id: 'a_lhr', name: 'London Heathrow Airport', country: 'United Kingdom', lat: 51.4700, lng: -0.4543, type: 'airport' },
  { id: 'a_nrt', name: 'Narita International Airport', country: 'Japan', lat: 35.7720, lng: 140.3929, type: 'airport' },

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
