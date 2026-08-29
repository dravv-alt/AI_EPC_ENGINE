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
  // =========================================================================
  // INDIA - Major Seaports (East & West Coast)
  // Charts follow official nautical pilotage channels into deep water
  // =========================================================================
  {
    id: 'p_nhavasheva',
    name: 'Nhava Sheva (JNPT / Mumbai)',
    country: 'India',
    lat: 18.949,
    lng: 72.951,
    type: 'port',
    seaRouteWaypoints: [
      [18.949, 72.951], // JNPT Berth
      [18.920, 72.890], // Central Harbour Fairway
      [18.860, 72.830], // South Mumbai Harbour Channel
      [18.800, 72.780], // South of Prongs Reef / Colaba Point
      [18.720, 72.650], // Deep Water Approach Buoy
      [18.650, 72.500], // Open Arabian Sea Pilot Station
    ],
  },
  {
    id: 'p_mumbai_port',
    name: 'Mumbai Port Trust',
    country: 'India',
    lat: 18.933,
    lng: 72.850,
    type: 'port',
    seaRouteWaypoints: [
      [18.933, 72.850], // Indira / Victoria Docks
      [18.860, 72.830], // South Mumbai Channel
      [18.800, 72.780], // South of Prongs Reef
      [18.720, 72.650], // Deep Water Approach
      [18.650, 72.500], // Open Arabian Sea Pilot Station
    ],
  },
  {
    id: 'p_chennai',
    name: 'Chennai Port',
    country: 'India',
    lat: 13.084,
    lng: 80.298,
    type: 'port',
    seaRouteWaypoints: [
      [13.084, 80.298],
      [13.084, 80.380],
      [13.080, 80.550],
      [13.050, 80.800],
    ],
  },
  {
    id: 'p_ennore',
    name: 'Kamarajar Port (Ennore)',
    country: 'India',
    lat: 13.262,
    lng: 80.334,
    type: 'port',
    seaRouteWaypoints: [
      [13.262, 80.334],
      [13.262, 80.450],
      [13.250, 80.650],
      [13.200, 80.900],
    ],
  },
  {
    id: 'p_krishnapatnam',
    name: 'Krishnapatnam Port (Nellore)',
    country: 'India',
    lat: 14.254,
    lng: 80.126,
    type: 'port',
    seaRouteWaypoints: [
      [14.254, 80.126],
      [14.254, 80.250],
      [14.250, 80.500],
      [14.200, 80.800],
    ],
  },
  {
    id: 'p_machilipatnam',
    name: 'Machilipatnam Port',
    country: 'India',
    lat: 16.187,
    lng: 81.164,
    type: 'port',
    seaRouteWaypoints: [
      [16.187, 81.164],
      [16.150, 81.250],
      [16.050, 81.450],
      [15.850, 81.750],
    ],
  },
  {
    id: 'p_kakinada',
    name: 'Kakinada Deep Water Port',
    country: 'India',
    lat: 16.973,
    lng: 82.282,
    type: 'port',
    seaRouteWaypoints: [
      [16.973, 82.282],
      [16.973, 82.380],
      [16.950, 82.600],
      [16.800, 82.900],
    ],
  },
  {
    id: 'p_vizag',
    name: 'Visakhapatnam Port (Vizag)',
    country: 'India',
    lat: 17.686,
    lng: 83.298,
    type: 'port',
    seaRouteWaypoints: [
      [17.686, 83.298],
      [17.680, 83.400],
      [17.650, 83.650],
      [17.500, 84.000],
    ],
  },
  {
    id: 'p_gangavaram',
    name: 'Gangavaram Port',
    country: 'India',
    lat: 17.625,
    lng: 83.238,
    type: 'port',
    seaRouteWaypoints: [
      [17.625, 83.238],
      [17.600, 83.350],
      [17.550, 83.600],
      [17.400, 83.900],
    ],
  },
  {
    id: 'p_paradip',
    name: 'Paradip Port',
    country: 'India',
    lat: 20.264,
    lng: 86.671,
    type: 'port',
    seaRouteWaypoints: [
      [20.264, 86.671],
      [20.240, 86.780],
      [20.150, 87.000],
      [20.000, 87.300],
    ],
  },
  {
    id: 'p_haldia',
    name: 'Haldia Port',
    country: 'India',
    lat: 22.025,
    lng: 88.083,
    type: 'port',
    seaRouteWaypoints: [
      [22.025, 88.083],
      [21.800, 88.100],
      [21.400, 88.150],
      [21.000, 88.300],
      [20.500, 88.500],
    ],
  },
  {
    id: 'p_kolkata',
    name: 'Syama Prasad Mookerjee Port (Kolkata)',
    country: 'India',
    lat: 22.548,
    lng: 88.318,
    type: 'port',
    seaRouteWaypoints: [
      [22.548, 88.318],
      [22.200, 88.200],
      [21.600, 88.150],
      [21.000, 88.300],
      [20.500, 88.500],
    ],
  },
  {
    id: 'p_cochin',
    name: 'Cochin Port (Vallarpadam)',
    country: 'India',
    lat: 9.966,
    lng: 76.267,
    type: 'port',
    seaRouteWaypoints: [
      [9.966, 76.267],
      [9.966, 76.150],
      [9.950, 75.900],
      [9.900, 75.600],
    ],
  },
  {
    id: 'p_tuticorin',
    name: 'V.O. Chidambaranar Port (Tuticorin)',
    country: 'India',
    lat: 8.754,
    lng: 78.182,
    type: 'port',
    seaRouteWaypoints: [
      [8.754, 78.182],
      [8.750, 78.300],
      [8.700, 78.550],
      [8.500, 78.850],
    ],
  },
  {
    id: 'p_mangalore',
    name: 'New Mangalore Port',
    country: 'India',
    lat: 12.926,
    lng: 74.818,
    type: 'port',
    seaRouteWaypoints: [
      [12.926, 74.818],
      [12.920, 74.700],
      [12.900, 74.450],
      [12.800, 74.150],
    ],
  },
  {
    id: 'p_mormugao',
    name: 'Mormugao Port (Goa)',
    country: 'India',
    lat: 15.414,
    lng: 73.801,
    type: 'port',
    seaRouteWaypoints: [
      [15.414, 73.801],
      [15.410, 73.700],
      [15.400, 73.500],
      [15.350, 73.200],
    ],
  },
  {
    id: 'p_mundra',
    name: 'Mundra Port (Adani)',
    country: 'India',
    lat: 22.748,
    lng: 69.704,
    type: 'port',
    seaRouteWaypoints: [
      [22.748, 69.704],
      [22.650, 69.700],
      [22.450, 69.500],
      [22.300, 69.200],
      [22.200, 68.800],
    ],
  },
  {
    id: 'p_kandla',
    name: 'Deendayal Port (Kandla)',
    country: 'India',
    lat: 23.003,
    lng: 70.218,
    type: 'port',
    seaRouteWaypoints: [
      [23.003, 70.218],
      [22.850, 70.200],
      [22.600, 69.700],
      [22.300, 69.200],
      [22.200, 68.800],
    ],
  },
  {
    id: 'p_pipavav',
    name: 'Port Pipavav (APM Terminals)',
    country: 'India',
    lat: 20.916,
    lng: 71.503,
    type: 'port',
    seaRouteWaypoints: [
      [20.916, 71.503],
      [20.800, 71.500],
      [20.600, 71.500],
      [20.300, 71.400],
    ],
  },
  {
    id: 'p_hazira',
    name: 'Hazira Port (Surat)',
    country: 'India',
    lat: 21.096,
    lng: 72.637,
    type: 'port',
    seaRouteWaypoints: [
      [21.096, 72.637],
      [20.950, 72.600],
      [20.600, 72.400],
      [20.200, 72.100],
    ],
  },

  // =========================================================================
  // EAST & SOUTHEAST ASIA
  // =========================================================================
  { id: 'p_shanghai', name: 'Port of Shanghai (Yangshan)', country: 'China', lat: 30.627, lng: 122.064, type: 'port', seaRouteWaypoints: [[30.627, 122.064], [30.60, 122.25], [30.60, 122.60], [30.50, 123.00]] },
  { id: 'p_ningbo', name: 'Port of Ningbo-Zhoushan', country: 'China', lat: 29.887, lng: 121.844, type: 'port', seaRouteWaypoints: [[29.887, 121.844], [29.88, 122.10], [29.85, 122.50], [29.70, 123.00]] },
  { id: 'p_shenzhen', name: 'Port of Shenzhen (Yantian / Shekou)', country: 'China', lat: 22.575, lng: 114.275, type: 'port', seaRouteWaypoints: [[22.575, 114.275], [22.50, 114.30], [22.30, 114.40], [22.10, 114.60]] },
  { id: 'p_guangzhou', name: 'Port of Guangzhou (Nansha)', country: 'China', lat: 22.750, lng: 113.600, type: 'port', seaRouteWaypoints: [[22.750, 113.600], [22.60, 113.70], [22.30, 113.95], [22.00, 114.20]] },
  { id: 'p_qingdao', name: 'Port of Qingdao', country: 'China', lat: 36.066, lng: 120.316, type: 'port', seaRouteWaypoints: [[36.066, 120.316], [36.00, 120.45], [35.85, 120.75], [35.60, 121.20]] },
  { id: 'p_tianjin', name: 'Port of Tianjin', country: 'China', lat: 38.983, lng: 117.750, type: 'port', seaRouteWaypoints: [[38.983, 117.750], [38.95, 117.95], [38.85, 118.40], [38.60, 119.00]] },
  { id: 'p_hongkong', name: 'Port of Hong Kong (Kwai Tsing)', country: 'Hong Kong', lat: 22.336, lng: 114.120, type: 'port', seaRouteWaypoints: [[22.336, 114.120], [22.25, 114.15], [22.10, 114.30], [21.90, 114.50]] },
  { id: 'p_kaohsiung', name: 'Port of Kaohsiung', country: 'Taiwan', lat: 22.616, lng: 120.283, type: 'port', seaRouteWaypoints: [[22.616, 120.283], [22.60, 120.20], [22.50, 120.00], [22.30, 119.70]] },
  { id: 'p_busan', name: 'Port of Busan (New Port)', country: 'South Korea', lat: 35.083, lng: 128.833, type: 'port', seaRouteWaypoints: [[35.083, 128.833], [35.00, 128.85], [34.80, 129.00], [34.50, 129.20]] },
  { id: 'p_tokyo', name: 'Port of Tokyo', country: 'Japan', lat: 35.617, lng: 139.783, type: 'port', seaRouteWaypoints: [[35.617, 139.783], [35.50, 139.85], [35.25, 139.75], [34.90, 139.80]] },
  { id: 'p_yokohama', name: 'Port of Yokohama', country: 'Japan', lat: 35.443, lng: 139.648, type: 'port', seaRouteWaypoints: [[35.443, 139.648], [35.40, 139.75], [35.25, 139.75], [34.90, 139.80]] },
  { id: 'p_singapore', name: 'Port of Singapore (Tuas / PSA)', country: 'Singapore', lat: 1.266, lng: 103.829, type: 'port', seaRouteWaypoints: [[1.266, 103.829], [1.20, 103.85], [1.12, 103.95], [1.15, 104.20]] },
  { id: 'p_portklang', name: 'Port Klang (Northport / Westports)', country: 'Malaysia', lat: 2.999, lng: 101.392, type: 'port', seaRouteWaypoints: [[2.999, 101.392], [2.95, 101.30], [2.80, 101.10], [2.60, 100.80]] },
  { id: 'p_tanjungpelepas', name: 'Port of Tanjung Pelepas (PTP)', country: 'Malaysia', lat: 1.362, lng: 103.549, type: 'port', seaRouteWaypoints: [[1.362, 103.549], [1.25, 103.55], [1.12, 103.65], [1.15, 104.00]] },
  { id: 'p_jakarta', name: 'Port of Tanjung Priok (Jakarta)', country: 'Indonesia', lat: -6.100, lng: 106.883, type: 'port', seaRouteWaypoints: [[-6.100, 106.883], [-6.00, 106.90], [-5.75, 106.95], [-5.40, 107.00]] },
  { id: 'p_laemchabang', name: 'Laem Chabang Port', country: 'Thailand', lat: 13.083, lng: 100.883, type: 'port', seaRouteWaypoints: [[13.083, 100.883], [13.05, 100.75], [12.85, 100.55], [12.50, 100.40]] },
  { id: 'p_hochiminh', name: 'Cat Lai Port (Ho Chi Minh City)', country: 'Vietnam', lat: 10.758, lng: 106.793, type: 'port', seaRouteWaypoints: [[10.758, 106.793], [10.50, 106.85], [10.25, 107.10], [9.90, 107.40]] },

  // =========================================================================
  // MIDDLE EAST & SOUTH ASIA
  // =========================================================================
  { id: 'p_jebelali', name: 'Jebel Ali Port (DP World)', country: 'United Arab Emirates', lat: 24.985, lng: 55.061, type: 'port', seaRouteWaypoints: [[24.985, 55.061], [25.08, 55.00], [25.20, 54.85], [25.45, 54.70]] },
  { id: 'p_abudhabi', name: 'Khalifa Port (Abu Dhabi)', country: 'United Arab Emirates', lat: 24.811, lng: 54.673, type: 'port', seaRouteWaypoints: [[24.811, 54.673], [24.90, 54.65], [25.10, 54.55], [25.40, 54.50]] },
  { id: 'p_khorfakkan', name: 'Port of Khor Fakkan', country: 'United Arab Emirates', lat: 25.359, lng: 56.359, type: 'port', seaRouteWaypoints: [[25.359, 56.359], [25.35, 56.45], [25.30, 56.70], [25.20, 57.00]] },
  { id: 'p_sohar', name: 'Port of Sohar', country: 'Oman', lat: 24.502, lng: 56.634, type: 'port', seaRouteWaypoints: [[24.502, 56.634], [24.55, 56.75], [24.65, 57.00], [24.75, 57.30]] },
  { id: 'p_salalah', name: 'Port of Salalah', country: 'Oman', lat: 16.944, lng: 54.004, type: 'port', seaRouteWaypoints: [[16.944, 54.004], [16.85, 54.05], [16.65, 54.20], [16.30, 54.50]] },
  { id: 'p_dammam', name: 'King Abdulaziz Port (Dammam)', country: 'Saudi Arabia', lat: 26.444, lng: 50.188, type: 'port', seaRouteWaypoints: [[26.444, 50.188], [26.55, 50.25], [26.80, 50.50], [27.10, 50.80]] },
  { id: 'p_jeddah', name: 'Jeddah Islamic Port', country: 'Saudi Arabia', lat: 21.464, lng: 39.167, type: 'port', seaRouteWaypoints: [[21.464, 39.167], [21.45, 39.05], [21.35, 38.80], [21.15, 38.40]] },
  { id: 'p_hamad', name: 'Hamad Port (Doha)', country: 'Qatar', lat: 25.014, lng: 51.611, type: 'port', seaRouteWaypoints: [[25.014, 51.611], [25.05, 51.75], [25.20, 52.05], [25.45, 52.40]] },
  { id: 'p_colombo', name: 'Port of Colombo', country: 'Sri Lanka', lat: 6.953, lng: 79.844, type: 'port', seaRouteWaypoints: [[6.953, 79.844], [6.95, 79.75], [6.90, 79.50], [6.75, 79.15]] },
  { id: 'p_karachi', name: 'Port of Karachi / Port Qasim', country: 'Pakistan', lat: 24.800, lng: 66.983, type: 'port', seaRouteWaypoints: [[24.800, 66.983], [24.70, 66.95], [24.50, 66.85], [24.20, 66.65]] },
  { id: 'p_chittagong', name: 'Port of Chittagong', country: 'Bangladesh', lat: 22.233, lng: 91.800, type: 'port', seaRouteWaypoints: [[22.233, 91.800], [22.10, 91.80], [21.70, 91.70], [21.20, 91.50]] },

  // =========================================================================
  // EUROPE & MEDITERRANEAN
  // =========================================================================
  { id: 'p_rotterdam', name: 'Port of Rotterdam (Maasvlakte)', country: 'Netherlands', lat: 51.955, lng: 4.020, type: 'port', seaRouteWaypoints: [[51.955, 4.020], [51.98, 3.90], [52.10, 3.65], [52.25, 3.30]] },
  { id: 'p_antwerp', name: 'Port of Antwerp-Bruges', country: 'Belgium', lat: 51.283, lng: 4.316, type: 'port', seaRouteWaypoints: [[51.283, 4.316], [51.40, 4.15], [51.45, 3.80], [51.40, 3.30], [51.45, 2.75]] },
  { id: 'p_hamburg', name: 'Port of Hamburg', country: 'Germany', lat: 53.541, lng: 9.967, type: 'port', seaRouteWaypoints: [[53.541, 9.967], [53.60, 9.50], [53.85, 9.00], [54.00, 8.40], [54.10, 7.80]] },
  { id: 'p_bremerhaven', name: 'Port of Bremerhaven', country: 'Germany', lat: 53.567, lng: 8.550, type: 'port', seaRouteWaypoints: [[53.567, 8.550], [53.65, 8.50], [53.85, 8.20], [54.00, 7.90], [54.10, 7.50]] },
  { id: 'p_felixstowe', name: 'Port of Felixstowe', country: 'United Kingdom', lat: 51.956, lng: 1.305, type: 'port', seaRouteWaypoints: [[51.956, 1.305], [51.93, 1.40], [51.85, 1.70], [51.80, 2.05]] },
  { id: 'p_lehavre', name: 'Port of Le Havre (Haropa)', country: 'France', lat: 49.475, lng: 0.116, type: 'port', seaRouteWaypoints: [[49.475, 0.116], [49.48, -0.05], [49.55, -0.40], [49.65, -0.90]] },
  { id: 'p_valencia', name: 'Port of Valencia', country: 'Spain', lat: 39.444, lng: -0.320, type: 'port', seaRouteWaypoints: [[39.444, -0.320], [39.44, -0.20], [39.40, 0.15], [39.30, 0.60]] },
  { id: 'p_algeciras', name: 'Port of Algeciras', country: 'Spain', lat: 36.133, lng: -5.433, type: 'port', seaRouteWaypoints: [[36.133, -5.433], [36.10, -5.40], [35.95, -5.35], [35.85, -5.30]] },
  { id: 'p_genoa', name: 'Port of Genoa', country: 'Italy', lat: 44.410, lng: 8.900, type: 'port', seaRouteWaypoints: [[44.410, 8.900], [44.38, 8.90], [44.25, 8.90], [44.00, 8.90]] },
  { id: 'p_piraeus', name: 'Port of Piraeus (Athens)', country: 'Greece', lat: 37.940, lng: 23.630, type: 'port', seaRouteWaypoints: [[37.940, 23.630], [37.90, 23.60], [37.75, 23.60], [37.50, 23.70]] },
  { id: 'p_portsaid', name: 'Port Said (Suez Canal Hub)', country: 'Egypt', lat: 31.265, lng: 32.302, type: 'port', seaRouteWaypoints: [[31.265, 32.302], [31.35, 32.35], [31.60, 32.45], [32.00, 32.60]] },

  // =========================================================================
  // AMERICAS & OCEANIA
  // =========================================================================
  { id: 'p_losangeles', name: 'Port of Los Angeles / Long Beach', country: 'United States', lat: 33.740, lng: -118.260, type: 'port', seaRouteWaypoints: [[33.740, -118.260], [33.70, -118.25], [33.55, -118.30], [33.30, -118.45]] },
  { id: 'p_nynj', name: 'Port of New York and New Jersey', country: 'United States', lat: 40.670, lng: -74.043, type: 'port', seaRouteWaypoints: [[40.670, -74.043], [40.60, -74.04], [40.52, -73.95], [40.40, -73.75]] },
  { id: 'p_houston', name: 'Port of Houston', country: 'United States', lat: 29.743, lng: -95.271, type: 'port', seaRouteWaypoints: [[29.743, -95.271], [29.65, -95.00], [29.35, -94.75], [29.15, -94.50], [28.80, -94.20]] },
  { id: 'p_savannah', name: 'Port of Savannah (Garden City)', country: 'United States', lat: 32.128, lng: -81.144, type: 'port', seaRouteWaypoints: [[32.128, -81.144], [32.05, -80.95], [31.90, -80.65], [31.70, -80.30]] },
  { id: 'p_vancouver', name: 'Port of Vancouver', country: 'Canada', lat: 49.288, lng: -123.111, type: 'port', seaRouteWaypoints: [[49.288, -123.111], [49.30, -123.25], [49.20, -123.60], [48.95, -124.20]] },
  { id: 'p_santos', name: 'Port of Santos (Sao Paulo)', country: 'Brazil', lat: -23.953, lng: -46.304, type: 'port', seaRouteWaypoints: [[-23.953, -46.304], [-24.05, -46.30], [-24.25, -46.30], [-24.60, -46.30]] },
  { id: 'p_manzanillo', name: 'Port of Manzanillo', country: 'Mexico', lat: 19.055, lng: -104.316, type: 'port', seaRouteWaypoints: [[19.055, -104.316], [19.00, -104.35], [18.85, -104.55], [18.60, -104.85]] },
  { id: 'p_colon', name: 'Port of Colon / Manzanillo (Panama Canal)', country: 'Panama', lat: 9.358, lng: -79.882, type: 'port', seaRouteWaypoints: [[9.358, -79.882], [9.40, -79.90], [9.60, -79.95], [9.90, -80.05]] },
  { id: 'p_durban', name: 'Port of Durban', country: 'South Africa', lat: -29.870, lng: 31.025, type: 'port', seaRouteWaypoints: [[-29.870, 31.025], [-29.88, 31.08], [-29.95, 31.25], [-30.10, 31.55]] },
  { id: 'p_sydney', name: 'Port Botany (Sydney)', country: 'Australia', lat: -33.970, lng: 151.215, type: 'port', seaRouteWaypoints: [[-33.970, 151.215], [-34.00, 151.25], [-34.10, 151.45], [-34.25, 151.75]] },

  // =========================================================================
  // MAJOR AIRPORTS
  // =========================================================================
  { id: 'a_jfk', name: 'John F. Kennedy International Airport (NYC)', country: 'United States', lat: 40.641, lng: -73.778, type: 'airport' },
  { id: 'a_dxb', name: 'Dubai International Airport (DXB)', country: 'United Arab Emirates', lat: 25.253, lng: 55.365, type: 'airport' },
  { id: 'a_fra', name: 'Frankfurt Airport (FRA)', country: 'Germany', lat: 50.037, lng: 8.562, type: 'airport' },
  { id: 'a_hkg', name: 'Hong Kong International Airport (HKG)', country: 'Hong Kong', lat: 22.308, lng: 113.914, type: 'airport' },
  { id: 'a_ord', name: 'O\'Hare International Airport (ORD)', country: 'United States', lat: 41.974, lng: -87.907, type: 'airport' },
  { id: 'a_bom', name: 'Chhatrapati Shivaji Maharaj International Airport (BOM)', country: 'India', lat: 19.090, lng: 72.867, type: 'airport' },
  { id: 'a_del', name: 'Indira Gandhi International Airport (DEL)', country: 'India', lat: 28.556, lng: 77.100, type: 'airport' },
  { id: 'a_hyd', name: 'Rajiv Gandhi International Airport (HYD)', country: 'India', lat: 17.240, lng: 78.429, type: 'airport' },
  { id: 'a_blr', name: 'Kempegowda International Airport (BLR)', country: 'India', lat: 13.198, lng: 77.706, type: 'airport' },
  { id: 'a_sin', name: 'Singapore Changi Airport (SIN)', country: 'Singapore', lat: 1.364, lng: 103.991, type: 'airport' },

  // =========================================================================
  // MAJOR CITIES & INDUSTRIAL CENTERS
  // =========================================================================
  { id: 'c_hyderabad', name: 'Hyderabad', country: 'India', lat: 17.385, lng: 78.486, type: 'city' },
  { id: 'c_mumbai', name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.877, type: 'city' },
  { id: 'c_delhi', name: 'Delhi / NCR', country: 'India', lat: 28.613, lng: 77.209, type: 'city' },
  { id: 'c_bengaluru', name: 'Bengaluru', country: 'India', lat: 12.971, lng: 77.594, type: 'city' },
  { id: 'c_chennai_city', name: 'Chennai', country: 'India', lat: 13.082, lng: 80.270, type: 'city' },
  { id: 'c_pune', name: 'Pune', country: 'India', lat: 18.520, lng: 73.856, type: 'city' },
  { id: 'c_ahmedabad', name: 'Ahmedabad', country: 'India', lat: 23.022, lng: 72.571, type: 'city' },
  { id: 'c_kolkata_city', name: 'Kolkata', country: 'India', lat: 22.572, lng: 88.363, type: 'city' },
  { id: 'c_nyc', name: 'New York City', country: 'United States', lat: 40.712, lng: -74.006, type: 'city' },
  { id: 'c_houston', name: 'Houston', country: 'United States', lat: 29.760, lng: -95.369, type: 'city' },
  { id: 'c_london', name: 'London', country: 'United Kingdom', lat: 51.507, lng: -0.127, type: 'city' },
  { id: 'c_tokyo', name: 'Tokyo', country: 'Japan', lat: 35.676, lng: 139.650, type: 'city' }
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

