// Open-Meteo API utility for threat detection
import { getDistance } from '../geo/nearest';

export interface WeatherThreat {
  waypointIndex: number;
  lat: number;
  lng: number;
  region: string;
  type: 'Wind' | 'Precipitation' | 'Thunderstorm';
  severity: 'WARNING' | 'DANGER';
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  estimatedDelayHours: number;
  fingerprint: string;
  summary: string;
}

export interface WeatherObservation {
  waypointIndex: number;
  lat: number;
  lng: number;
  region: string;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  threat: WeatherThreat | null;
}

// Dynamic geographic region resolver for global coordinates
export function getGeographicRegion(lat: number, lng: number): string {
  // Northern Indian Ocean & Bay of Bengal
  if (lat >= 5 && lat <= 25 && lng >= 80 && lng <= 95) {
    if (lat >= 13 && lat <= 18 && lng >= 80 && lng <= 84) return "Bay of Bengal (Andhra / Coromandel Coast)";
    if (lat >= 18 && lat <= 23 && lng >= 84 && lng <= 92) return "Bay of Bengal (Odisha / Bengal Basin)";
    if (lat >= 5 && lat <= 13 && lng >= 80 && lng <= 88) return "South Bay of Bengal (Sri Lanka Passage)";
    return "Bay of Bengal Maritime Basin";
  }
  // Arabian Sea & Indian West Coast
  if (lat >= 8 && lat <= 26 && lng >= 60 && lng <= 78) {
    if (lat >= 18 && lat <= 24 && lng >= 68 && lng <= 74) return "Arabian Sea (Gujarat / Maharashtra Coast)";
    if (lat >= 8 && lat <= 18 && lng >= 70 && lng <= 77) return "Arabian Sea (Malabar / Konkan Coast)";
    if (lat >= 20 && lat <= 26 && lng >= 60 && lng <= 68) return "Gulf of Oman / North Arabian Sea";
    return "Arabian Sea Maritime Basin";
  }
  // Persian Gulf / Strait of Hormuz
  if (lat >= 24 && lat <= 30 && lng >= 48 && lng <= 57) {
    if (lat >= 25 && lat <= 27 && lng >= 55 && lng <= 57) return "Strait of Hormuz (Oman / UAE)";
    return "Persian Gulf Shipping Channel";
  }
  // Red Sea & Gulf of Aden
  if (lat >= 11 && lat <= 28 && lng >= 32 && lng <= 46) {
    if (lat >= 11 && lat <= 15 && lng >= 42 && lng <= 52) return "Gulf of Aden / Bab-el-Mandeb Strait";
    if (lat >= 27 && lat <= 30 && lng >= 32 && lng <= 34) return "Gulf of Suez / Canal Approach";
    return "Red Sea Maritime Corridor";
  }
  // Southeast Asia & Malacca Strait
  if (lat >= -8 && lat <= 20 && lng >= 95 && lng <= 120) {
    if (lat >= 1 && lat <= 7 && lng >= 98 && lng <= 104) return "Strait of Malacca / Singapore Strait";
    if (lat >= 5 && lat <= 22 && lng >= 105 && lng <= 120) return "South China Sea";
    if (lat >= -8 && lat <= 5 && lng >= 105 && lng <= 120) return "Java Sea / Sunda Strait";
    return "Southeast Asian Waters";
  }
  // East Asia
  if (lat >= 20 && lat <= 42 && lng >= 118 && lng <= 145) {
    if (lat >= 20 && lat <= 26 && lng >= 118 && lng <= 123) return "Taiwan Strait";
    if (lat >= 24 && lat <= 33 && lng >= 120 && lng <= 130) return "East China Sea (Yangtze Approach)";
    if (lat >= 33 && lat <= 40 && lng >= 118 && lng <= 126) return "Yellow Sea / Bohai Gulf";
    if (lat >= 30 && lat <= 45 && lng >= 128 && lng <= 145) return "Sea of Japan / Tokyo Bay";
    return "East Asian Maritime Basin";
  }
  // Mediterranean Sea
  if (lat >= 30 && lat <= 46 && lng >= -6 && lng <= 36) {
    if (lat >= 35 && lat <= 37 && lng >= -6 && lng <= -4) return "Strait of Gibraltar";
    if (lat >= 30 && lat <= 37 && lng >= 24 && lng <= 36) return "Eastern Mediterranean / Levantine Basin";
    if (lat >= 36 && lat <= 44 && lng >= 8 && lng <= 19) return "Tyrrhenian & Ionian Sea";
    return "Mediterranean Sea";
  }
  // North Sea & English Channel
  if (lat >= 48 && lat <= 62 && lng >= -10 && lng <= 12) {
    if (lat >= 49 && lat <= 52 && lng >= -5 && lng <= 2) return "English Channel / Dover Strait";
    if (lat >= 52 && lat <= 60 && lng >= 2 && lng <= 10) return "North Sea (Rotterdam / Hamburg Gateway)";
    return "North Sea / Northern Europe";
  }
  // Atlantic Ocean (North & South)
  if (lng >= -80 && lng <= 0) {
    if (lat >= 30 && lat <= 65 && lng >= -60 && lng <= -10) return "North Atlantic Ocean (Transatlantic Shipping Lane)";
    if (lat >= 24 && lat <= 35 && lng >= -85 && lng <= -60) return "Western Atlantic (US East Coast / Bermuda Passage)";
    if (lat >= 35 && lat <= 45 && lng >= -76 && lng <= -60) return "US Mid-Atlantic (NY-NJ / Chesapeake Gateway)";
    if (lat >= 18 && lat <= 30 && lng >= -98 && lng <= -80) return "Gulf of Mexico / Houston Channel";
    if (lat >= 0 && lat <= 30 && lng >= -60 && lng <= -20) return "Tropical Mid-Atlantic Ocean";
    if (lat < 0 && lat >= -55) return "South Atlantic Ocean";
    return "Atlantic Ocean Corridor";
  }
  // Pacific Ocean (North & South)
  if (lng >= 120 || lng <= -120) {
    if (lat >= 20 && lat <= 55 && (lng >= 140 || lng <= -130)) return "North Pacific Ocean (Transpacific Gateway)";
    if (lat >= -20 && lat <= 20) return "Tropical Pacific Ocean";
    if (lat < -20) return "South Pacific Ocean";
    return "Pacific Ocean Corridor";
  }
  // Southern Ocean / Cape of Good Hope
  if (lat <= -30 && lng >= 10 && lng <= 40) {
    return "Cape of Good Hope / Agulhas Passage (South Africa)";
  }
  // Inland India Highway Corridors
  if (lat >= 8 && lat <= 35 && lng >= 68 && lng <= 88) {
    if (lat >= 15 && lat <= 19 && lng >= 77 && lng <= 81) return "Telangana / Andhra Industrial Highway Corridor (NH65)";
    if (lat >= 18 && lat <= 21 && lng >= 72 && lng <= 75) return "Maharashtra Logistics Belt (JNPT Corridor)";
    if (lat >= 12 && lat <= 15 && lng >= 77 && lng <= 80) return "Karnataka / Tamil Nadu Industrial Corridor";
    if (lat >= 26 && lat <= 31 && lng >= 75 && lng <= 79) return "Delhi-NCR / Northern Freight Corridor";
    return `Inland Freight Corridor (${lat.toFixed(1)}°N, ${lng.toFixed(1)}°E)`;
  }
  return `Maritime Corridor (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)`;
}

// Function to sample evenly spaced waypoints every 200 km along a route
export function sampleWaypoints(
  routeCoords: [number, number][],
  intervalKm: number = 200
): [number, number][] {
  if (routeCoords.length === 0) return [];
  if (routeCoords.length === 1) return routeCoords;

  let totalDistance = 0;
  const distances = [0];
  for (let i = 1; i < routeCoords.length; i++) {
    const d = getDistance(
      routeCoords[i - 1][0],
      routeCoords[i - 1][1],
      routeCoords[i][0],
      routeCoords[i][1]
    );
    totalDistance += d;
    distances.push(totalDistance);
  }

  // If entire route is shorter than the interval, sample start and end
  if (totalDistance <= intervalKm) {
    return [routeCoords[0], routeCoords[routeCoords.length - 1]];
  }

  const waypoints: [number, number][] = [routeCoords[0]];
  let targetDist = intervalKm;

  for (let i = 1; i < routeCoords.length; i++) {
    while (distances[i] >= targetDist && targetDist < totalDistance) {
      const segmentDist = distances[i] - distances[i - 1];
      const remainder = targetDist - distances[i - 1];
      const fraction = segmentDist === 0 ? 0 : remainder / segmentDist;

      const lat = routeCoords[i - 1][0] + (routeCoords[i][0] - routeCoords[i - 1][0]) * fraction;
      const lng = routeCoords[i - 1][1] + (routeCoords[i][1] - routeCoords[i - 1][1]) * fraction;

      waypoints.push([Number(lat.toFixed(4)), Number(lng.toFixed(4))]);
      targetDist += intervalKm;
    }
  }

  // Ensure destination is always included as the final waypoint
  const lastPoint = routeCoords[routeCoords.length - 1];
  const lastSampled = waypoints[waypoints.length - 1];
  if (
    getDistance(lastSampled[0], lastSampled[1], lastPoint[0], lastPoint[1]) > 15
  ) {
    waypoints.push(lastPoint);
  }

  return waypoints;
}

// =========================================================================
// In-Memory Rate Limiting & TTL Cache for Open-Meteo
// =========================================================================
interface CachedObservation {
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
const weatherCache = new Map<string, CachedObservation>();

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function assessRouteThreats(
  routeCoords: [number, number][],
  existingThreatFingerprints: string[] = [],
  intervalKm: number = 200
): Promise<{
  dataAvailable: boolean;
  unavailableReasons: string[];
  observations: WeatherObservation[];
  threats: WeatherThreat[];
  newThreats: WeatherThreat[];
  totalNewDelayHours: number;
}> {
  // Sample dynamically every intervalKm along the route polyline (default 200km)
  const safeInterval = Math.max(25, Math.min(2000, intervalKm));
  const waypoints = sampleWaypoints(routeCoords, safeInterval);
  if (!waypoints.length) {
    return {
      dataAvailable: false,
      unavailableReasons: ["No verified route coordinates are available for weather assessment."],
      observations: [],
      threats: [],
      newThreats: [],
      totalNewDelayHours: 0,
    };
  }

  const observations: WeatherObservation[] = [];
  const threats: WeatherThreat[] = [];
  const unavailableReasons: string[] = [];
  const now = Date.now();

  // Separate waypoints into cached vs uncached
  const uncachedIndices: number[] = [];
  const uncachedPoints: [number, number][] = [];

  const rawObservations: (CachedObservation | null)[] = waypoints.map((wp, idx) => {
    const key = getCacheKey(wp[0], wp[1]);
    const cached = weatherCache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached;
    }
    uncachedIndices.push(idx);
    uncachedPoints.push(wp);
    return null;
  });

  // Batch query uncached points with rate-limiting (max 10 points per chunk, 200ms delay)
  const CHUNK_SIZE = 10;
  for (let c = 0; c < uncachedPoints.length; c += CHUNK_SIZE) {
    const chunkPoints = uncachedPoints.slice(c, c + CHUNK_SIZE);
    const chunkIndices = uncachedIndices.slice(c, c + CHUNK_SIZE);

    const lats = chunkPoints.map((p) => p[0]).join(",");
    const lngs = chunkPoints.map((p) => p[1]).join(",");

    let retries = 2;
    let success = false;

    while (retries >= 0 && !success) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=wind_speed_10m,precipitation,weather_code&wind_speed_unit=kmh`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8_000),
          headers: { accept: "application/json" },
        });

        if (res.status === 429) {
          // Rate-limited: wait 1000ms and retry
          retries--;
          await sleep(1000);
          continue;
        }

        if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
        const data = await res.json();
        const rawItems = Array.isArray(data) ? data : [data];

        rawItems.forEach((item, itemIdx) => {
          const globalWpIdx = chunkIndices[itemIdx];
          const wp = chunkPoints[itemIdx];
          const current = item?.current;

          if (
            current &&
            typeof current.wind_speed_10m === "number" &&
            typeof current.precipitation === "number" &&
            typeof current.weather_code === "number"
          ) {
            const obsData: CachedObservation = {
              windSpeed: current.wind_speed_10m,
              precipitation: current.precipitation,
              weatherCode: current.weather_code,
              timestamp: Date.now(),
            };
            weatherCache.set(getCacheKey(wp[0], wp[1]), obsData);
            rawObservations[globalWpIdx] = obsData;
          }
        });

        success = true;
      } catch (err) {
        retries--;
        if (retries < 0) {
          console.error("Open-Meteo rate-limit/network error for chunk:", err);
          unavailableReasons.push(
            err instanceof Error ? err.message : "Open-Meteo route weather is unavailable."
          );
        } else {
          await sleep(500);
        }
      }
    }

    // Rate-limiting delay between chunks (200ms spacing)
    if (c + CHUNK_SIZE < uncachedPoints.length) {
      await sleep(200);
    }
  }

  // Construct final observations and threat assessments
  waypoints.forEach((wp, idx) => {
    const data = rawObservations[idx];
    if (!data) return;

    const { windSpeed, precipitation, weatherCode } = data;
    let isThreat = false;
    let type: "Wind" | "Precipitation" | "Thunderstorm" = "Wind";
    let severity: "WARNING" | "DANGER" = "WARNING";
    let delayHours = 0;

    // 🔴 Danger: Wind > 80 km/h OR thunderstorm (codes 95-99)
    if (windSpeed > 80 || (weatherCode >= 95 && weatherCode <= 99)) {
      isThreat = true;
      severity = "DANGER";
      type = weatherCode >= 95 ? "Thunderstorm" : "Wind";
      delayHours = 12 + Math.floor((windSpeed > 80 ? windSpeed - 80 : 0) / 10);
    }
    // 🟡 Warning: Wind > 50 km/h OR precipitation > 10 mm/h
    else if (windSpeed > 50 || precipitation > 10) {
      isThreat = true;
      severity = "WARNING";
      type = windSpeed > 50 ? "Wind" : "Precipitation";
      delayHours = 4 + Math.floor((windSpeed > 50 ? windSpeed - 50 : 0) / 10);
    }

    const dateHour = new Date().toISOString().slice(0, 13);
    const fingerprint = `wp${idx}_code${weatherCode}_${dateHour}`;
    const region = getGeographicRegion(wp[0], wp[1]);
    const summary = `${type === "Thunderstorm" ? "Severe convective thunderstorm" : type === "Wind" ? "High sustained gale winds" : "Heavy oceanic precipitation"} in ${region} (${windSpeed} km/h gusts, ${precipitation} mm/h) — projected transit delay +${delayHours}h`;

    const threat: WeatherThreat | null = isThreat
      ? {
          waypointIndex: idx + 1,
          lat: wp[0],
          lng: wp[1],
          region,
          type,
          severity,
          windSpeed,
          precipitation,
          weatherCode,
          estimatedDelayHours: delayHours,
          fingerprint,
          summary,
        }
      : null;

    if (threat) threats.push(threat);

    observations.push({
      waypointIndex: idx + 1,
      lat: wp[0],
      lng: wp[1],
      region,
      windSpeed,
      precipitation,
      weatherCode,
      threat,
    });
  });

  const newThreats = threats.filter((t) => !existingThreatFingerprints.includes(t.fingerprint));
  const totalNewDelayHours = newThreats.reduce((sum, t) => sum + t.estimatedDelayHours, 0);

  return {
    dataAvailable: observations.length > 0,
    unavailableReasons,
    observations,
    threats,
    newThreats,
    totalNewDelayHours,
  };
}
