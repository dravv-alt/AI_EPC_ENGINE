// Generated from the EPC Multimodal Route & Weather Master Dataset Specification.
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

export const MASTER_INTERNATIONAL_ROUTES: MasterRoute[] = [
  {
    "id": "SEA-01-01",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-02",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-03",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Genoa approach",
        "lat": 44,
        "lng": 8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-04",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ushant / western Channel",
        "lat": 48.5,
        "lng": -5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-05",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-06",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-01-07",
    "mode": "sea",
    "origin": "Mumbai",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-01",
    "mode": "sea",
    "origin": "Pune",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-02",
    "mode": "sea",
    "origin": "Pune",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-03",
    "mode": "sea",
    "origin": "Pune",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Genoa approach",
        "lat": 44,
        "lng": 8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-04",
    "mode": "sea",
    "origin": "Pune",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ushant / western Channel",
        "lat": 48.5,
        "lng": -5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-05",
    "mode": "sea",
    "origin": "Pune",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-06",
    "mode": "sea",
    "origin": "Pune",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-02-07",
    "mode": "sea",
    "origin": "Pune",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "JNPA / Nhava Sheva (road feeder)",
        "lat": 18.9453,
        "lng": 72.94,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-01",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "East China Sea",
        "lat": 28,
        "lng": 123,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-02",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-03",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-04",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-05",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-06",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-03-07",
    "mode": "sea",
    "origin": "Kolkata",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Haldia Dock Complex / SMP Kolkata",
        "lat": 22.0333,
        "lng": 88.0833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Kyushu east offshore",
        "lat": 31,
        "lng": 132,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-01",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-02",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-03",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Genoa approach",
        "lat": 44,
        "lng": 8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-04",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ushant / western Channel",
        "lat": 48.5,
        "lng": -5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-05",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-06",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-04-07",
    "mode": "sea",
    "origin": "Kerala (Kochi)",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Cochin Port",
        "lat": 9.9667,
        "lng": 76.2667,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-01",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "East China Sea",
        "lat": 28,
        "lng": 123,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-02",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-03",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-04",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-05",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-06",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-05-07",
    "mode": "sea",
    "origin": "Hyderabad",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Krishnapatnam Port (road feeder)",
        "lat": 14.2528,
        "lng": 80.1347,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Kyushu east offshore",
        "lat": 31,
        "lng": 132,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-01",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "East China Sea",
        "lat": 28,
        "lng": 123,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-02",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-03",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-04",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-05",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-06",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-06-07",
    "mode": "sea",
    "origin": "Visakhapatnam",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Visakhapatnam Port",
        "lat": 17.6833,
        "lng": 83.2833,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Kyushu east offshore",
        "lat": 31,
        "lng": 132,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-01",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "East China Sea",
        "lat": 28,
        "lng": 123,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-02",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-03",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-04",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-05",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-06",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-07-07",
    "mode": "sea",
    "origin": "Bengaluru",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "Chennai Port (road feeder)",
        "lat": 13.1,
        "lng": 80.3,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Southern Bay of Bengal",
        "lat": 10,
        "lng": 86,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Kyushu east offshore",
        "lat": 31,
        "lng": 132,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-01",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "China",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Malacca Strait - west approach",
        "lat": 4,
        "lng": 98.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "South China Sea - north",
        "lat": 18,
        "lng": 117,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Taiwan Strait - south",
        "lat": 22,
        "lng": 119,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Yangshan approach",
        "lat": 30.4,
        "lng": 122.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Yangshan Deep-Water Port / Shanghai",
        "lat": 30.63,
        "lng": 122.06,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-02",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "Germany",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Elbe / German Bight approach",
        "lat": 53.9,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Hamburg",
        "lat": 53.54,
        "lng": 9.93,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-03",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "Italy",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Eastern Mediterranean",
        "lat": 34,
        "lng": 28,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Sicily Channel",
        "lat": 36,
        "lng": 13,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Tyrrhenian Sea",
        "lat": 40,
        "lng": 11,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ligurian Sea",
        "lat": 43.5,
        "lng": 8.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Genoa approach",
        "lat": 44,
        "lng": 8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Genoa",
        "lat": 44.4056,
        "lng": 8.9463,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-04",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "France",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Ushant / western Channel",
        "lat": 48.5,
        "lng": -5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Seine Bay approach",
        "lat": 49.6,
        "lng": -0.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "HAROPA Port - Le Havre",
        "lat": 49.482,
        "lng": 0.108,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-05",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "United Kingdom",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Bay of Biscay",
        "lat": 45,
        "lng": -7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "English Channel",
        "lat": 50,
        "lng": -1.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Felixstowe / southern North Sea approach",
        "lat": 51.8,
        "lng": 1.8,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Felixstowe",
        "lat": 51.96,
        "lng": 1.35,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-06",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "USA",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - west",
        "lat": 13,
        "lng": 60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "Gulf of Aden - east",
        "lat": 12,
        "lng": 52,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Bab el-Mandeb",
        "lat": 12.6,
        "lng": 43.3,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Red Sea - south",
        "lat": 17,
        "lng": 40,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "Suez south approach",
        "lat": 29.7,
        "lng": 32.55,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "Central Mediterranean",
        "lat": 35,
        "lng": 18,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Strait of Gibraltar",
        "lat": 35.9,
        "lng": -5.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Mid-Atlantic east",
        "lat": 35,
        "lng": -22,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Western Atlantic",
        "lat": 40,
        "lng": -60,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "New York offshore approach",
        "lat": 40.3,
        "lng": -72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port Newark-Elizabeth / Port of New York & New Jersey",
        "lat": 40.67,
        "lng": -74.15,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "SEA-08-07",
    "mode": "sea",
    "origin": "Mangaluru",
    "destination": "Japan",
    "provenance": "REPRESENTATIVE_MARITIME_CORRIDOR",
    "waypoints": [
      {
        "sequence": 1,
        "name": "New Mangalore Port",
        "lat": 12.9184,
        "lng": 74.7716,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Arabian Sea - east",
        "lat": 12,
        "lng": 72,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 3,
        "name": "South of Sri Lanka",
        "lat": 5.5,
        "lng": 80,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 4,
        "name": "Andaman Sea",
        "lat": 8.5,
        "lng": 95,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 5,
        "name": "Singapore Strait",
        "lat": 1.2,
        "lng": 103.7,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 6,
        "name": "South China Sea - south",
        "lat": 5,
        "lng": 108,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 7,
        "name": "South China Sea - central",
        "lat": 12,
        "lng": 113,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 8,
        "name": "Luzon east",
        "lat": 20,
        "lng": 124,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 9,
        "name": "Ryukyu chain offshore",
        "lat": 26,
        "lng": 129,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 10,
        "name": "Honshu Pacific offshore",
        "lat": 33,
        "lng": 138,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 11,
        "name": "Tokyo Bay approach",
        "lat": 35,
        "lng": 139.5,
        "classification": "REPRESENTATIVE_MARITIME_CORRIDOR"
      },
      {
        "sequence": 12,
        "name": "Port of Yokohama",
        "lat": 35.45,
        "lng": 139.64,
        "classification": "OFFICIAL/REAL GATEWAY ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-01",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 20.816,
        "lng": 76.8706,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.4454,
        "lng": 80.9653,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 23.9691,
        "lng": 85.1541,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 25.3765,
        "lng": 89.4391,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 26.657,
        "lng": 93.8206,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 27.8003,
        "lng": 98.296,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 28.7965,
        "lng": 102.8603,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 29.6365,
        "lng": 107.5056,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 30.3121,
        "lng": 112.2213,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.8164,
        "lng": 116.9941,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-02",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.0125,
        "lng": 68.932,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.8305,
        "lng": 64.7655,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.5181,
        "lng": 60.3133,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 34.0427,
        "lng": 55.518,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.3652,
        "lng": 50.3192,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.4398,
        "lng": 44.6577,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.2127,
        "lng": 38.4819,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.6233,
        "lng": 31.7587,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.6063,
        "lng": 24.4882,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.0969,
        "lng": 16.7196,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-03",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.633,
        "lng": 68.6151,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.0565,
        "lng": 64.1432,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 29.3342,
        "lng": 59.4079,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 32.4338,
        "lng": 54.367,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 35.3189,
        "lng": 48.9801,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 37.948,
        "lng": 43.2133,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 40.2756,
        "lng": 37.0444,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 42.2536,
        "lng": 30.4703,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 43.8336,
        "lng": 23.5155,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 44.9713,
        "lng": 16.2373,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-04",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.1569,
        "lng": 68.5545,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 27.0977,
        "lng": 63.9772,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.8796,
        "lng": 59.0729,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 34.4617,
        "lng": 53.7765,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.7954,
        "lng": 48.0226,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.8239,
        "lng": 41.7513,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.4817,
        "lng": 34.919,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.6976,
        "lng": 27.5135,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.3988,
        "lng": 19.572,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.5193,
        "lng": 11.1948,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-05",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.4753,
        "lng": 68.6323,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 27.7369,
        "lng": 64.1115,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 31.8398,
        "lng": 59.2295,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 35.7393,
        "lng": 53.9047,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 39.3807,
        "lng": 48.0507,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 42.6975,
        "lng": 41.5829,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 45.6113,
        "lng": 34.4329,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 48.0331,
        "lng": 26.5703,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 49.87,
        "lng": 18.032,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 51.0365,
        "lng": 8.9477,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-06",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 28.1496,
        "lng": 67.6316,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 36.9721,
        "lng": 61.4367,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 45.3895,
        "lng": 53.6502,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 53.0982,
        "lng": 43.2648,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 59.5342,
        "lng": 28.8057,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 63.7291,
        "lng": 9.0065,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 64.5411,
        "lng": -14.542,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 61.6764,
        "lng": -36.4254,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 56.0575,
        "lng": -53.1005,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.8037,
        "lng": -65.0295,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-01-07",
    "mode": "air",
    "origin": "Mumbai",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BOM / Chhatrapati Shivaji Maharaj Intl",
        "lat": 19.0916,
        "lng": 72.866,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.8788,
        "lng": 77.9886,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 24.5015,
        "lng": 83.3091,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.9301,
        "lng": 88.8475,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 29.1334,
        "lng": 94.6179,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 31.0794,
        "lng": 100.6257,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 32.7359,
        "lng": 106.8652,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 34.0725,
        "lng": 113.3174,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 35.0623,
        "lng": 119.9489,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 35.6836,
        "lng": 126.7123,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.922,
        "lng": 133.5488,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-01",
    "mode": "air",
    "origin": "Pune",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 20.3183,
        "lng": 77.8336,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 21.965,
        "lng": 81.8342,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 23.5127,
        "lng": 85.9258,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 24.951,
        "lng": 90.1111,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 26.2698,
        "lng": 94.3911,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 27.4588,
        "lng": 98.7646,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 28.5085,
        "lng": 103.2276,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 29.4096,
        "lng": 107.7739,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 30.1539,
        "lng": 112.3944,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.734,
        "lng": 117.0772,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-02",
    "mode": "air",
    "origin": "Pune",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.5806,
        "lng": 69.9368,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.4747,
        "lng": 65.7191,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.2364,
        "lng": 61.2109,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 33.8317,
        "lng": 56.3521,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.2202,
        "lng": 51.0795,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.3535,
        "lng": 45.3307,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.1756,
        "lng": 39.0512,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.6225,
        "lng": 32.2063,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.6258,
        "lng": 24.7968,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.1174,
        "lng": 16.8763,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-03",
    "mode": "air",
    "origin": "Pune",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.201,
        "lng": 69.6149,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 25.7005,
        "lng": 65.0864,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 29.0519,
        "lng": 60.2895,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 32.2216,
        "lng": 55.1795,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 35.1713,
        "lng": 49.7138,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 37.8576,
        "lng": 43.8559,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 40.2328,
        "lng": 37.582,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 42.246,
        "lng": 30.8886,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 43.8463,
        "lng": 23.8014,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 44.987,
        "lng": 16.3817,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-04",
    "mode": "air",
    "origin": "Pune",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.728,
        "lng": 69.5619,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.7482,
        "lng": 64.936,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.6074,
        "lng": 59.9778,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 34.2634,
        "lng": 54.6194,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.6656,
        "lng": 48.7918,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.7545,
        "lng": 42.4317,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.4618,
        "lng": 35.4926,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.7127,
        "lng": 27.9614,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.4306,
        "lng": 19.8773,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.5466,
        "lng": 11.3472,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-05",
    "mode": "air",
    "origin": "Pune",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.0476,
        "lng": 69.6446,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 27.3899,
        "lng": 65.0804,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 31.5719,
        "lng": 60.1501,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 35.5472,
        "lng": 54.7685,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 39.259,
        "lng": 48.8451,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 42.6385,
        "lng": 42.291,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 45.6033,
        "lng": 35.0339,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 48.0606,
        "lng": 27.0414,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 49.9128,
        "lng": 18.3529,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 51.0708,
        "lng": 9.1068,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-06",
    "mode": "air",
    "origin": "Pune",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 27.7679,
        "lng": 68.7757,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 36.728,
        "lng": 62.6892,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 45.2973,
        "lng": 55.0246,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 53.1766,
        "lng": 44.7506,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 59.7994,
        "lng": 30.3081,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 64.1644,
        "lng": 10.2473,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 65.0485,
        "lng": -13.8963,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 62.117,
        "lng": -36.3009,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 56.3569,
        "lng": -53.172,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.9494,
        "lng": -65.0993,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-02-07",
    "mode": "air",
    "origin": "Pune",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "PNQ / Pune Airport",
        "lat": 18.5825,
        "lng": 73.9194,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.3615,
        "lng": 78.964,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 23.9842,
        "lng": 84.1981,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.4223,
        "lng": 89.6417,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 28.6457,
        "lng": 95.3097,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 30.6235,
        "lng": 101.2091,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 32.3246,
        "lng": 107.3368,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 33.719,
        "lng": 113.6771,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 34.7799,
        "lng": 120.2011,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 35.4848,
        "lng": 126.8659,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.8181,
        "lng": 133.6172,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-01",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.7336,
        "lng": 91.2583,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 24.7617,
        "lng": 94.1157,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 25.7347,
        "lng": 97.0194,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 26.6492,
        "lng": 99.9697,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 27.5019,
        "lng": 102.9659,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 28.2894,
        "lng": 106.0072,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 29.0086,
        "lng": 109.0917,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 29.6564,
        "lng": 112.2173,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 30.23,
        "lng": 115.3811,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.7267,
        "lng": 118.5795,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-02",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 26.9598,
        "lng": 83.775,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 31.0998,
        "lng": 78.7391,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 35.0265,
        "lng": 73.2564,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 38.6825,
        "lng": 67.2406,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 41.9983,
        "lng": 60.6092,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 44.8924,
        "lng": 53.2985,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 47.2739,
        "lng": 45.2866,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 49.0492,
        "lng": 36.6218,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 50.1341,
        "lng": 27.4458,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.4701,
        "lng": 17.9945,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-03",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 26.6191,
        "lng": 83.3565,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 30.3905,
        "lng": 77.9097,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 33.9182,
        "lng": 72.0403,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 37.1443,
        "lng": 65.6868,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 40.0025,
        "lng": 58.8016,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 42.4197,
        "lng": 51.3641,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 44.3206,
        "lng": 43.3975,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.6347,
        "lng": 34.9835,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.3066,
        "lng": 26.2671,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 46.3052,
        "lng": 17.4437,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-04",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 27.1872,
        "lng": 83.4505,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 31.5288,
        "lng": 78.0401,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 35.621,
        "lng": 72.1178,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 39.393,
        "lng": 65.5833,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 42.7595,
        "lng": 58.3451,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 45.6207,
        "lng": 50.3423,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 47.8677,
        "lng": 41.578,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 49.3941,
        "lng": 32.1541,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 50.1143,
        "lng": 22.2912,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.9833,
        "lng": 12.3068,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-05",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 27.5086,
        "lng": 83.6266,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 32.1821,
        "lng": 78.3698,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 36.6151,
        "lng": 72.5591,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 40.7326,
        "lng": 66.0663,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 44.44,
        "lng": 58.7629,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 47.6224,
        "lng": 50.5462,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 50.1476,
        "lng": 41.3836,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 51.8804,
        "lng": 31.3709,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 52.7073,
        "lng": 20.7746,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 52.5669,
        "lng": 10.0113,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-06",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 32.6947,
        "lng": 85.3095,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 42.6376,
        "lng": 81.3729,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 52.3942,
        "lng": 75.9401,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 61.7615,
        "lng": 67.4749,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 70.1703,
        "lng": 52.1193,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 75.7939,
        "lng": 21.4191,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 75.0566,
        "lng": -20.7738,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 68.6065,
        "lng": -47.6367,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 59.9197,
        "lng": -61.0794,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.4464,
        "lng": -68.7319,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-03-07",
    "mode": "air",
    "origin": "Kolkata",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "CCU / Netaji Subhas Chandra Bose Intl",
        "lat": 22.6539,
        "lng": 88.4467,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 24.6237,
        "lng": 92.5448,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.4791,
        "lng": 96.7702,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 28.2061,
        "lng": 101.1292,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 29.7906,
        "lng": 105.6253,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 31.2184,
        "lng": 110.2587,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 32.4752,
        "lng": 115.0254,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 33.5476,
        "lng": 119.917,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 34.4231,
        "lng": 124.92,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 35.0911,
        "lng": 130.0161,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.5427,
        "lng": 135.1825,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-01",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 12.4854,
        "lng": 80.047,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 14.7691,
        "lng": 83.7576,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 16.9922,
        "lng": 87.5461,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 19.1437,
        "lng": 91.4239,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 21.2118,
        "lng": 95.4021,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 23.1842,
        "lng": 99.4907,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 25.0479,
        "lng": 103.6981,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 26.7895,
        "lng": 108.031,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 28.3954,
        "lng": 112.4936,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 29.8516,
        "lng": 117.0869,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-02",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 14.871,
        "lng": 72.301,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 19.514,
        "lng": 68.0179,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 24.0503,
        "lng": 63.4843,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 28.4435,
        "lng": 58.6236,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 32.6493,
        "lng": 53.3509,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 36.6134,
        "lng": 47.5732,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 40.2693,
        "lng": 41.1952,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 43.5366,
        "lng": 34.1299,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.3218,
        "lng": 26.3194,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.5224,
        "lng": 17.7653,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-03",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 14.4715,
        "lng": 71.9787,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 18.7052,
        "lng": 67.3815,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 22.8213,
        "lng": 62.5517,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 26.7828,
        "lng": 57.4264,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 30.5469,
        "lng": 51.94,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 34.0631,
        "lng": 46.0263,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 37.2724,
        "lng": 39.6243,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 40.1076,
        "lng": 32.6875,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 42.4952,
        "lng": 25.1979,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 44.3595,
        "lng": 17.1826,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-04",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 15.0011,
        "lng": 71.9257,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 19.7588,
        "lng": 67.2435,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 24.3874,
        "lng": 62.2771,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 28.8421,
        "lng": 56.9402,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 33.0683,
        "lng": 51.1385,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 36.9995,
        "lng": 44.7728,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 40.5552,
        "lng": 37.7485,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 43.6401,
        "lng": 29.9925,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.1478,
        "lng": 21.4812,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 47.9694,
        "lng": 12.2757,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-05",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 15.3283,
        "lng": 72.0096,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 20.4145,
        "lng": 67.3958,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 25.371,
        "lng": 62.4705,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 30.1499,
        "lng": 57.1311,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 34.6911,
        "lng": 51.2619,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 38.9191,
        "lng": 44.7362,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 42.7396,
        "lng": 37.4264,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 46.0373,
        "lng": 29.228,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 48.6798,
        "lng": 20.101,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.53,
        "lng": 10.1257,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-06",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 20.0438,
        "lng": 71.152,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 29.7599,
        "lng": 65.1969,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 39.1524,
        "lng": 57.9765,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 47.9649,
        "lng": 48.5983,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 55.7142,
        "lng": 35.6354,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 61.4939,
        "lng": 17.2915,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 63.9419,
        "lng": -6.5111,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 62.1597,
        "lng": -30.8693,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 56.8253,
        "lng": -50.205,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.3215,
        "lng": -63.928,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-04-07",
    "mode": "air",
    "origin": "Kerala (Kochi)",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "COK / Cochin International",
        "lat": 10.152,
        "lng": 76.4019,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 13.4102,
        "lng": 81.2196,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 16.5746,
        "lng": 86.1678,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 19.6183,
        "lng": 91.2781,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 22.5125,
        "lng": 96.5806,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 25.226,
        "lng": 102.1026,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 27.7253,
        "lng": 107.8661,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 29.9751,
        "lng": 113.8861,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 31.9393,
        "lng": 120.1665,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 33.5818,
        "lng": 126.6979,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 34.869,
        "lng": 133.4544,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-01",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 18.9724,
        "lng": 81.9703,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 20.6357,
        "lng": 85.584,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 22.2224,
        "lng": 89.2758,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 23.7238,
        "lng": 93.0497,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 25.1317,
        "lng": 96.9087,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 26.4374,
        "lng": 100.8544,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 27.6323,
        "lng": 104.8866,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 28.7082,
        "lng": 109.0032,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 29.6571,
        "lng": 113.2003,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.4714,
        "lng": 117.4715,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-02",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.5092,
        "lng": 74.2369,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 25.6673,
        "lng": 69.7939,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 29.6812,
        "lng": 65.0354,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 33.5113,
        "lng": 59.8903,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.1095,
        "lng": 54.2838,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.4182,
        "lng": 48.1418,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.3697,
        "lng": 41.4012,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 45.887,
        "lng": 34.0252,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.888,
        "lng": 26.0255,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.2933,
        "lng": 17.4836,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-03",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.1318,
        "lng": 73.8914,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 24.8959,
        "lng": 69.1128,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 28.4986,
        "lng": 64.0402,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 31.8999,
        "lng": 58.6194,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 35.0541,
        "lng": 52.7985,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 37.9087,
        "lng": 46.5334,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 40.4057,
        "lng": 39.7961,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 42.4834,
        "lng": 32.5858,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 44.0808,
        "lng": 24.9401,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 45.1433,
        "lng": 16.9439,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-04",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.6725,
        "lng": 73.8737,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 25.9725,
        "lng": 69.0333,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.0996,
        "lng": 63.833,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 34.0045,
        "lng": 58.1921,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 37.6278,
        "lng": 52.0282,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.8989,
        "lng": 45.2653,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.7358,
        "lng": 37.8488,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 46.0488,
        "lng": 29.7675,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.7471,
        "lng": 21.0792,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.7517,
        "lng": 11.9294,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-05",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.9965,
        "lng": 73.9795,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.6245,
        "lng": 69.2247,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 31.0813,
        "lng": 64.076,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 35.3138,
        "lng": 58.4339,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 39.2561,
        "lng": 52.1912,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 42.8268,
        "lng": 45.2422,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 45.9284,
        "lng": 37.5017,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 48.4496,
        "lng": 28.9369,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 50.2754,
        "lng": 19.609,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 51.3041,
        "lng": 9.7073,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-06",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 26.9164,
        "lng": 73.7455,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 36.409,
        "lng": 68.1845,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 45.5725,
        "lng": 61.0939,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 54.1297,
        "lng": 51.3327,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 61.5087,
        "lng": 36.9266,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 66.5528,
        "lng": 15.4345,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 67.6146,
        "lng": -11.8822,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 64.1963,
        "lng": -36.6849,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 57.6935,
        "lng": -54.0778,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.5751,
        "lng": -65.6533,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-05-07",
    "mode": "air",
    "origin": "Hyderabad",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "HYD / Rajiv Gandhi Intl",
        "lat": 17.2403,
        "lng": 78.4294,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 19.9429,
        "lng": 83.1495,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.5165,
        "lng": 88.03,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 24.9378,
        "lng": 93.0899,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 27.1815,
        "lng": 98.345,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 29.2218,
        "lng": 103.8056,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 31.0317,
        "lng": 109.4751,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 32.5848,
        "lng": 115.3481,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 33.8558,
        "lng": 121.4088,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 34.8221,
        "lng": 127.6301,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.4651,
        "lng": 133.9739,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-01",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 19.313,
        "lng": 86.3901,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 20.8492,
        "lng": 89.6168,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 22.3237,
        "lng": 92.9087,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 23.7304,
        "lng": 96.2692,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 25.0629,
        "lng": 99.7011,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 26.3148,
        "lng": 103.2061,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 27.4798,
        "lng": 106.7849,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 28.5514,
        "lng": 110.4372,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 29.5233,
        "lng": 114.1609,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.3895,
        "lng": 117.9529,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-02",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.149,
        "lng": 78.8125,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.4506,
        "lng": 74.1177,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 30.587,
        "lng": 69.0656,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 34.5114,
        "lng": 63.5751,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 38.1664,
        "lng": 57.5615,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 41.4836,
        "lng": 50.9444,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 44.3826,
        "lng": 43.6615,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 46.7736,
        "lng": 35.691,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 48.5645,
        "lng": 27.0786,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.6722,
        "lng": 17.96,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-03",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 21.7801,
        "lng": 78.4375,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 25.6934,
        "lng": 73.3765,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 29.4204,
        "lng": 67.98,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 32.9138,
        "lng": 62.1859,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 36.1188,
        "lng": 55.9366,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 38.9727,
        "lng": 49.1862,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 41.4069,
        "lng": 41.9133,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 43.3502,
        "lng": 34.1345,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 44.735,
        "lng": 25.9185,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 45.5063,
        "lng": 17.3914,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-04",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.3358,
        "lng": 78.4648,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 26.8021,
        "lng": 73.3843,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 31.0725,
        "lng": 67.8965,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 35.0893,
        "lng": 61.9086,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 38.7822,
        "lng": 55.3269,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 42.0673,
        "lng": 48.0688,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 44.848,
        "lng": 40.0839,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 47.0204,
        "lng": 31.3838,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 48.4844,
        "lng": 22.0726,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.1609,
        "lng": 12.3618,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-05",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.6625,
        "lng": 78.5993,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 27.4613,
        "lng": 73.6333,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 32.0682,
        "lng": 68.2242,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 36.4215,
        "lng": 62.2577,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 40.4437,
        "lng": 55.611,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 44.0389,
        "lng": 48.1669,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 47.0917,
        "lng": 39.8397,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 49.4734,
        "lng": 30.6201,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 51.0563,
        "lng": 20.6262,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 51.7381,
        "lng": 10.1339,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-06",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 27.7688,
        "lng": 79.1854,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 37.675,
        "lng": 74.3225,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 47.3201,
        "lng": 67.9698,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 56.4595,
        "lng": 58.8498,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 64.5263,
        "lng": 44.3825,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 70.1523,
        "lng": 20.3935,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 71.0186,
        "lng": -12.127,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 66.59,
        "lng": -39.476,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 59.0655,
        "lng": -56.3748,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.1678,
        "lng": -66.7621,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-06-07",
    "mode": "air",
    "origin": "Visakhapatnam",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "VTZ / Visakhapatnam Airport",
        "lat": 17.7212,
        "lng": 83.2246,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 20.2275,
        "lng": 87.6158,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.6212,
        "lng": 92.1475,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 24.8833,
        "lng": 96.8352,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 26.9936,
        "lng": 101.6917,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 28.9314,
        "lng": 106.726,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 30.675,
        "lng": 111.9422,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 32.2031,
        "lng": 117.3379,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 33.4947,
        "lng": 122.9032,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 34.5305,
        "lng": 128.6199,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.294,
        "lng": 134.4614,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-01",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 15.2667,
        "lng": 81.2651,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 17.2776,
        "lng": 84.8935,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 19.2219,
        "lng": 88.6005,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 21.0899,
        "lng": 92.3946,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 22.8715,
        "lng": 96.2829,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 24.5562,
        "lng": 100.2717,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 26.1331,
        "lng": 104.3656,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 27.5913,
        "lng": 108.5672,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 28.9197,
        "lng": 112.8769,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.1075,
        "lng": 117.2924,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-02",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.7396,
        "lng": 73.5544,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.1888,
        "lng": 69.1881,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.5142,
        "lng": 64.54,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 30.6773,
        "lng": 59.5349,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 34.6317,
        "lng": 54.0907,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 38.3206,
        "lng": 48.1206,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 41.6755,
        "lng": 41.5414,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 44.6159,
        "lng": 34.2865,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 47.0511,
        "lng": 26.3291,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.887,
        "lng": 17.71,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-03",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.3497,
        "lng": 73.2202,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 21.3964,
        "lng": 68.5286,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 25.3052,
        "lng": 63.5745,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 29.0377,
        "lng": 58.2977,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 32.5489,
        "lng": 52.6372,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 35.7865,
        "lng": 46.5348,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 38.6907,
        "lng": 39.9424,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 41.1951,
        "lng": 32.833,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 43.23,
        "lng": 25.214,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 44.7276,
        "lng": 17.1415,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-04",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.8861,
        "lng": 73.1861,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.4638,
        "lng": 68.4231,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.8923,
        "lng": 63.3398,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 31.1243,
        "lng": 57.8511,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 35.1025,
        "lng": 51.866,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 38.7574,
        "lng": 45.2933,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 42.0061,
        "lng": 38.0533,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 44.7538,
        "lng": 30.0987,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.8986,
        "lng": 21.4431,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.3428,
        "lng": 12.1903,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-05",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 18.2127,
        "lng": 73.2816,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 23.1193,
        "lng": 68.5967,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 27.8773,
        "lng": 63.5613,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 32.436,
        "lng": 58.0731,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 36.7318,
        "lng": 52.0178,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.6857,
        "lng": 45.2752,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 44.2,
        "lng": 37.7331,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 47.1588,
        "lng": 29.3164,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 49.4345,
        "lng": 20.0304,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.9032,
        "lng": 10.0108,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-06",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 23.0533,
        "lng": 72.7687,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 32.7304,
        "lng": 67.0514,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 42.0852,
        "lng": 59.9566,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 50.8548,
        "lng": 50.4835,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 58.5196,
        "lng": 36.9563,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 64.0599,
        "lng": 17.2277,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 65.9469,
        "lng": -8.3985,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 63.3885,
        "lng": -33.3817,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 57.4191,
        "lng": -52.0252,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.5286,
        "lng": -64.7706,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-07-07",
    "mode": "air",
    "origin": "Bengaluru",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "BLR / Kempegowda Intl",
        "lat": 13.1986,
        "lng": 77.7066,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 16.207,
        "lng": 82.4415,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 19.1074,
        "lng": 87.3205,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 21.8748,
        "lng": 92.3695,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 24.4825,
        "lng": 97.6121,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 26.9019,
        "lng": 103.0684,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 29.1029,
        "lng": 108.7523,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 31.0542,
        "lng": 114.6699,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 32.7249,
        "lng": 120.8168,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 34.0851,
        "lng": 127.1759,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.108,
        "lng": 133.7162,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-01",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "China",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 15.109,
        "lng": 78.6674,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 17.192,
        "lng": 82.5199,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 19.2002,
        "lng": 86.4585,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 21.1223,
        "lng": 90.4922,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 22.9466,
        "lng": 94.6291,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 24.6608,
        "lng": 98.8755,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 26.2524,
        "lng": 103.2358,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 27.7089,
        "lng": 107.712,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 29.0177,
        "lng": 112.303,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 30.1666,
        "lng": 117.0044,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "PVG / Shanghai Pudong Intl",
        "lat": 31.1443,
        "lng": 121.8083,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-02",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "Germany",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.4202,
        "lng": 70.8762,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 21.794,
        "lng": 66.6622,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.0543,
        "lng": 62.1862,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 30.1664,
        "lng": 57.3783,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 34.0882,
        "lng": 52.1618,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 37.7687,
        "lng": 46.4549,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 41.1461,
        "lng": 40.1764,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 44.1471,
        "lng": 33.2567,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.6882,
        "lng": 25.6566,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.6802,
        "lng": 17.3926,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "FRA / Frankfurt Airport",
        "lat": 50.0379,
        "lng": 8.5622,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-03",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "Italy",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.0274,
        "lng": 70.5587,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 20.9969,
        "lng": 66.0363,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 24.8406,
        "lng": 61.2708,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 28.5238,
        "lng": 56.2062,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 32.0058,
        "lng": 50.7854,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 35.2397,
        "lng": 44.9525,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 38.1713,
        "lng": 38.6591,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 40.7403,
        "lng": 31.8728,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 42.8819,
        "lng": 24.5893,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 44.5313,
        "lng": 16.8453,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "MXP / Milan Malpensa",
        "lat": 45.6306,
        "lng": 8.7281,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-04",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "France",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.5538,
        "lng": 70.5008,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.0437,
        "lng": 65.8846,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 26.396,
        "lng": 60.9704,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 30.5675,
        "lng": 55.6793,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 34.5063,
        "lng": 49.9264,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 38.1495,
        "lng": 43.6255,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 41.4221,
        "lng": 36.6981,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 44.2373,
        "lng": 29.0906,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 46.5006,
        "lng": 20.7987,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 48.1179,
        "lng": 11.8952,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "CDG / Paris Charles de Gaulle",
        "lat": 49.0097,
        "lng": 2.5479,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-05",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "United Kingdom",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 17.8775,
        "lng": 70.5805,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 22.6928,
        "lng": 66.027,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 27.3701,
        "lng": 61.1463,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 31.863,
        "lng": 55.8433,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 36.1137,
        "lng": 50.0121,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 40.0505,
        "lng": 43.5397,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 43.5847,
        "lng": 36.3175,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 46.6105,
        "lng": 28.2646,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 49.0095,
        "lng": 19.3651,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 50.6623,
        "lng": 9.7138,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "LHR / London Heathrow",
        "lat": 51.47,
        "lng": -0.4543,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-06",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "USA",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 22.557,
        "lng": 69.6257,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 31.955,
        "lng": 63.5755,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 41.0013,
        "lng": 56.1651,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 49.4255,
        "lng": 46.4795,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 56.7228,
        "lng": 33.0996,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 61.9759,
        "lng": 14.4153,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 63.9059,
        "lng": -9.1395,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 61.8175,
        "lng": -32.5655,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 56.4566,
        "lng": -51.0146,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 49.0987,
        "lng": -64.2096,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "JFK / John F. Kennedy Intl",
        "lat": 40.6413,
        "lng": -73.7781,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  },
  {
    "id": "AIR-08-07",
    "mode": "air",
    "origin": "Mangaluru",
    "destination": "Japan",
    "provenance": "GREAT_CIRCLE_WEATHER_SAMPLING",
    "waypoints": [
      {
        "sequence": 1,
        "name": "IXE / Mangaluru Intl",
        "lat": 12.9621,
        "lng": 74.8909,
        "classification": "REAL AIRPORT ENDPOINT"
      },
      {
        "sequence": 2,
        "name": "Great-circle sample 01",
        "lat": 16.0824,
        "lng": 79.8168,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 3,
        "name": "Great-circle sample 02",
        "lat": 19.0864,
        "lng": 84.8969,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 4,
        "name": "Great-circle sample 03",
        "lat": 21.9463,
        "lng": 90.1601,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 5,
        "name": "Great-circle sample 04",
        "lat": 24.632,
        "lng": 95.6324,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 6,
        "name": "Great-circle sample 05",
        "lat": 27.1112,
        "lng": 101.3354,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 7,
        "name": "Great-circle sample 06",
        "lat": 29.3503,
        "lng": 107.2839,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 8,
        "name": "Great-circle sample 07",
        "lat": 31.3143,
        "lng": 113.4824,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 9,
        "name": "Great-circle sample 08",
        "lat": 32.9687,
        "lng": 119.9234,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 10,
        "name": "Great-circle sample 09",
        "lat": 34.281,
        "lng": 126.584,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 11,
        "name": "Great-circle sample 10",
        "lat": 35.2227,
        "lng": 133.4252,
        "classification": "REPRESENTATIVE_GREAT_CIRCLE_SAMPLE"
      },
      {
        "sequence": 12,
        "name": "NRT / Narita Intl",
        "lat": 35.772,
        "lng": 140.3929,
        "classification": "REAL AIRPORT ENDPOINT"
      }
    ]
  }
];

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
