import { env } from "@/lib/env";

export interface WeatherQuery {
  lat: number;
  lng: number;
  mmsi: string | null;
}

export interface WeatherObservation {
  weatherDelayFactor: number;
  source: "synthetic" | "open-meteo";
  reason: string;
}

export interface WeatherClient {
  forecast(query: WeatherQuery): Promise<WeatherObservation>;
}

// Deterministic per-shipment delay factor in [0.05, 0.4]. Derived only from the
// vessel position and identity — no clock, no randomness — so the same shipment
// always yields the same synthetic forecast, keeping verification reproducible.
// A vessel further out and in busier latitudes gets a heavier factor.
export class SyntheticWeatherClient implements WeatherClient {
  async forecast(query: WeatherQuery): Promise<WeatherObservation> {
    const seed = Math.abs(Math.sin(query.lat * 12.9898 + query.lng * 78.233 + (query.mmsi ? Number(query.mmsi) % 997 : 0)));
    const factor = Number((0.05 + seed * 0.35).toFixed(5));
    return { weatherDelayFactor: factor, source: "synthetic", reason: `Synthetic marine forecast at ${query.lat.toFixed(2)},${query.lng.toFixed(2)}: ${Math.round(factor * 100)}% transit delay.` };
  }
}

// Open-Meteo marine driver (opt-in via WEATHER_MODE=open-meteo). Converts live
// wave height into a transit-delay factor; the synthetic client is the
// deterministic fallback on any error so the poll loop never blocks.
export class OpenMeteoWeatherClient implements WeatherClient {
  private readonly fallback = new SyntheticWeatherClient();
  constructor(private readonly baseUrl: string) {}
  async forecast(query: WeatherQuery): Promise<WeatherObservation> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("latitude", query.lat.toFixed(4));
      url.searchParams.set("longitude", query.lng.toFixed(4));
      url.searchParams.set("hourly", "wave_height");
      url.searchParams.set("forecast_days", "1");
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { hourly?: { wave_height?: Array<number | null> } };
      const heights = (data.hourly?.wave_height ?? []).filter((value): value is number => typeof value === "number");
      if (!heights.length) return this.fallback.forecast(query);
      const peak = Math.max(...heights);
      const factor = Number(Math.min(0.6, peak * 0.06).toFixed(5));
      return { weatherDelayFactor: factor, source: "open-meteo", reason: `Open-Meteo peak wave height ${peak.toFixed(1)}m → ${Math.round(factor * 100)}% transit delay.` };
    } catch {
      return this.fallback.forecast(query);
    }
  }
}

export function getWeatherClient(): WeatherClient {
  return env.WEATHER_MODE === "open-meteo" ? new OpenMeteoWeatherClient(env.OPEN_METEO_BASE_URL) : new SyntheticWeatherClient();
}
