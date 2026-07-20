import type { RiskTaskContext, SignalClient, SignalObservation, RiskSignalType } from "./clients";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  current?: {
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
    temperature_2m?: number;
  };
}

/**
 * Calls the free Open-Meteo API (no key needed) to get current weather
 * at the task's project location. Maps wind/precipitation to a delay
 * probability using conservative thresholds.
 */
export class OpenMeteoWeatherClient implements SignalClient {
  readonly type: RiskSignalType = "weather_forecast";

  constructor(
    private readonly latitude: number,
    private readonly longitude: number
  ) {}

  async poll(task: RiskTaskContext): Promise<SignalObservation> {
    try {
      const url = new URL(OPEN_METEO_URL);
      url.searchParams.set("latitude", String(this.latitude));
      url.searchParams.set("longitude", String(this.longitude));
      url.searchParams.set("current", "wind_speed_10m,precipitation,weather_code,temperature_2m");
      url.searchParams.set("timezone", "auto");

      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);

      const data: OpenMeteoResponse = await response.json();
      const current = data.current;
      if (!current) throw new Error("Open-Meteo returned no current weather data.");

      const wind = current.wind_speed_10m ?? 0;
      const precip = current.precipitation ?? 0;
      const code = current.weather_code ?? 0;

      // Probability mapping: conservative thresholds for construction site impact
      let probability = 0;
      if (wind > 60) probability += 0.4;       // >60 km/h — crane ops suspended
      else if (wind > 40) probability += 0.2;  // >40 km/h — heavy lift restricted
      else if (wind > 25) probability += 0.05; // >25 km/h — minor impact

      if (precip > 20) probability += 0.4;      // >20mm — site flooding risk
      else if (precip > 10) probability += 0.2; // >10mm — outdoor work paused
      else if (precip > 2) probability += 0.05; // >2mm — minor slowdown

      // Severe weather codes (thunderstorm 95–99, freezing rain 66–67)
      if (code >= 95 || (code >= 66 && code <= 67)) probability += 0.3;

      probability = Math.min(probability, 1.0);

      // Estimate delay: 4h per severe factor, 1h per moderate
      const estimatedDelayHours = probability >= 0.5 ? 8
        : probability >= 0.3 ? 4
        : probability >= 0.1 ? 1
        : 0;

      return {
        dataAvailable: true,
        source: "open-meteo.com",
        probability: Math.round(probability * 1000) / 1000,
        estimatedDelayHours,
        value: {
          wind_speed_kmh: wind,
          precipitation_mm: precip,
          weather_code: code,
          temperature_c: current.temperature_2m ?? null,
          taskName: task.taskName,
          mode: "live-open-meteo",
          advisory: true,
        },
        unavailableReason: null,
      };
    } catch (error) {
      return {
        dataAvailable: false,
        source: "open-meteo.com",
        probability: null,
        estimatedDelayHours: null,
        value: null,
        unavailableReason: error instanceof Error ? error.message : "Weather API unavailable.",
      };
    }
  }
}
