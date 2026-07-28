// Open-Meteo API utility for threat detection
import { getDistance } from '../geo/nearest';

export interface WeatherThreat {
  waypointIndex: number;
  lat: number;
  lng: number;
  type: 'Wind' | 'Precipitation' | 'Thunderstorm';
  severity: 'WARNING' | 'DANGER';
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  estimatedDelayHours: number;
  fingerprint: string;
}

export interface WeatherObservation {
  waypointIndex: number;
  lat: number;
  lng: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  threat: WeatherThreat | null;
}

// Function to interpolate and find 10 evenly spaced waypoints along a route
export function sampleWaypoints(routeCoords: [number, number][], sampleCount: number = 10): [number, number][] {
  if (routeCoords.length === 0) return [];
  if (routeCoords.length <= sampleCount) return routeCoords;

  let totalDistance = 0;
  const distances = [0];
  for (let i = 1; i < routeCoords.length; i++) {
    const d = getDistance(routeCoords[i-1][0], routeCoords[i-1][1], routeCoords[i][0], routeCoords[i][1]);
    totalDistance += d;
    distances.push(totalDistance);
  }

  const step = totalDistance / (sampleCount - 1);
  const waypoints: [number, number][] = [routeCoords[0]];

  let currentStep = step;
  for (let i = 1; i < routeCoords.length; i++) {
    while (distances[i] >= currentStep && waypoints.length < sampleCount) {
      // Interpolate
      const segmentDist = distances[i] - distances[i-1];
      const remainder = currentStep - distances[i-1];
      const fraction = segmentDist === 0 ? 0 : remainder / segmentDist;

      const lat = routeCoords[i-1][0] + (routeCoords[i][0] - routeCoords[i-1][0]) * fraction;
      const lng = routeCoords[i-1][1] + (routeCoords[i][1] - routeCoords[i-1][1]) * fraction;

      waypoints.push([lat, lng]);
      currentStep += step;
    }
  }

  // Ensure the last point is exactly the destination if we missed it due to float math
  if (waypoints.length < sampleCount) {
    waypoints.push(routeCoords[routeCoords.length - 1]);
  }

  return waypoints;
}

export async function assessRouteThreats(routeCoords: [number, number][], existingThreatFingerprints: string[] = []): Promise<{
  /** False means the route cannot be declared clear because live weather was incomplete. */
  dataAvailable: boolean,
  unavailableReasons: string[],
  observations: WeatherObservation[],
  threats: WeatherThreat[],
  newThreats: WeatherThreat[],
  totalNewDelayHours: number
}> {
  const waypoints = sampleWaypoints(routeCoords, 10);
  if (!waypoints.length) return { dataAvailable: false, unavailableReasons: ["No verified route coordinates are available for weather assessment."], observations: [], threats: [], newThreats: [], totalNewDelayHours: 0 };
  const threats: WeatherThreat[] = [];

  // To avoid hitting Open-Meteo too aggressively, we could batch, but for 10 points we can just do parallel fetches
  // Open-Meteo doesn't require an API key and allows decent throughput for non-commercial use

  const fetchPromises = waypoints.map(async (wp, idx): Promise<{ observation: WeatherObservation | null; threat: WeatherThreat | null; unavailableReason: string | null }> => {
    try {
      // Using current weather for simplicity. For future ETAs we'd use forecast.
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${wp[0]}&longitude=${wp[1]}&current=wind_speed_10m,precipitation,weather_code&wind_speed_unit=kmh`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
      const data = await res.json();

      const current = data.current;
      if (!current || typeof current.wind_speed_10m !== "number" || typeof current.precipitation !== "number" || typeof current.weather_code !== "number") {
        throw new Error("Open-Meteo returned incomplete current-weather data.");
      }

      const windSpeed = current.wind_speed_10m;
      const precipitation = current.precipitation;
      const weatherCode = current.weather_code;

      let isThreat = false;
      let type: 'Wind' | 'Precipitation' | 'Thunderstorm' = 'Wind';
      let severity: 'WARNING' | 'DANGER' = 'WARNING';
      let delayHours = 0;

      // 🔴 Danger: Wind > 80 km/h OR weather_code indicates thunderstorm/hurricane (codes 95-99)
      if (windSpeed > 80 || (weatherCode >= 95 && weatherCode <= 99)) {
        isThreat = true;
        severity = 'DANGER';
        type = weatherCode >= 95 ? 'Thunderstorm' : 'Wind';
        delayHours = 12 + Math.floor((windSpeed > 80 ? windSpeed - 80 : 0) / 10); // Base 12h + scaling
      }
      // 🟡 Warning: Wind > 50 km/h OR precipitation > 10 mm/h
      else if (windSpeed > 50 || precipitation > 10) {
        isThreat = true;
        severity = 'WARNING';
        type = windSpeed > 50 ? 'Wind' : 'Precipitation';
        delayHours = 4 + Math.floor((windSpeed > 50 ? windSpeed - 50 : 0) / 10);
      }

      if (isThreat) {
        // Date hour for fingerprint to ensure the same storm at the same time is tracked uniquely
        const dateHour = new Date().toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
        const fingerprint = `wp${idx}_code${weatherCode}_${dateHour}`;

        const threat = {
          waypointIndex: idx + 1,
          lat: wp[0],
          lng: wp[1],
          type,
          severity,
          windSpeed,
          precipitation,
          weatherCode,
          estimatedDelayHours: delayHours,
          fingerprint
        } as WeatherThreat;
        return {
          observation: { waypointIndex: idx + 1, lat: wp[0], lng: wp[1], windSpeed, precipitation, weatherCode, threat },
          threat,
          unavailableReason: null
        };
      }
      return {
        observation: { waypointIndex: idx + 1, lat: wp[0], lng: wp[1], windSpeed, precipitation, weatherCode, threat: null },
        threat: null,
        unavailableReason: null
      };
    } catch (e) {
      console.error('Failed to fetch weather for waypoint', wp, e);
      return { observation: null, threat: null, unavailableReason: e instanceof Error ? e.message : "Open-Meteo route weather is unavailable." };
    }
  });

  const results = await Promise.all(fetchPromises);
  const unavailableReasons = results.flatMap((result) => result.unavailableReason ? [result.unavailableReason] : []);
  const observations = results.flatMap((result) => result.observation ? [result.observation] : []);
  const foundThreats = results.flatMap((result) => result.threat ? [result.threat] : []);

  const newThreats = foundThreats.filter(t => !existingThreatFingerprints.includes(t.fingerprint));
  const totalNewDelayHours = newThreats.reduce((sum, t) => sum + t.estimatedDelayHours, 0);

  return {
    dataAvailable: unavailableReasons.length === 0,
    unavailableReasons,
    observations,
    threats: foundThreats,
    newThreats,
    totalNewDelayHours
  };
}
