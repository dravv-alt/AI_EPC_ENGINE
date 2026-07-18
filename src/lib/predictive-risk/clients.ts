import { z } from "zod";
import { env } from "@/lib/env";
import { OpenMeteoWeatherClient } from "@/lib/supply/weather-client";

export const riskSignalTypes = ["procurement_status", "equipment_lead_time", "workforce_availability", "weather_forecast"] as const;
export type RiskSignalType = (typeof riskSignalTypes)[number];

export interface RiskTaskContext { taskId: string; taskName: string; startAt: Date; endAt: Date; deadline: Date | null; isCritical: boolean }
export interface SignalObservation { dataAvailable: boolean; source: string; probability: number | null; estimatedDelayHours: number | null; value: Record<string, unknown> | null; unavailableReason: string | null }
export interface SignalClient { type: RiskSignalType; poll(task: RiskTaskContext): Promise<SignalObservation> }

const responseSchema = z.object({ dataAvailable: z.boolean(), probability: z.number().min(0).max(1).nullable(), estimatedDelayHours: z.number().int().nonnegative().nullable(), value: z.record(z.unknown()).nullable().default(null), unavailableReason: z.string().max(1000).nullable().default(null) });

class SyntheticSignalClient implements SignalClient {
  constructor(readonly type: RiskSignalType) {}
  async poll(task: RiskTaskContext): Promise<SignalObservation> {
    return { dataAvailable: true, source: `synthetic:${this.type}`, probability: 0.1, estimatedDelayHours: 0, value: { taskName: task.taskName, mode: "synthetic-baseline", advisory: true }, unavailableReason: null };
  }
}

class HttpSignalClient implements SignalClient {
  constructor(readonly type: RiskSignalType, private readonly endpoint?: string) {}
  async poll(task: RiskTaskContext): Promise<SignalObservation> {
    if (!this.endpoint) return { dataAvailable: false, source: `http:${this.type}`, probability: null, estimatedDelayHours: null, value: null, unavailableReason: `No ${this.type} endpoint is configured.` };
    try {
      const url = new URL(this.endpoint); url.searchParams.set("taskId", task.taskId); url.searchParams.set("startAt", task.startAt.toISOString()); url.searchParams.set("endAt", task.endAt.toISOString());
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = responseSchema.parse(await response.json());
      return { ...parsed, source: url.origin };
    } catch (error) {
      return { dataAvailable: false, source: `http:${this.type}`, probability: null, estimatedDelayHours: null, value: null, unavailableReason: error instanceof Error ? error.message : "Signal endpoint unavailable." };
    }
  }
}

// In http mode, the weather risk signal reuses the Open-Meteo marine client
// rather than a bespoke risk endpoint. The forecast delay factor at the project
// site is mapped into a probability/estimated-delay observation the risk engine
// can act on, and the marine endpoint origin is recorded as the signal source.
class OpenMeteoSignalClient implements SignalClient {
  readonly type: RiskSignalType = "weather_forecast";
  private readonly client = new OpenMeteoWeatherClient(env.OPEN_METEO_BASE_URL);
  async poll(): Promise<SignalObservation> {
    const forecast = await this.client.forecast({ lat: env.RISK_SITE_LAT, lng: env.RISK_SITE_LNG, mmsi: null });
    const probability = Math.min(1, forecast.weatherDelayFactor);
    const estimatedDelayHours = Math.round(forecast.weatherDelayFactor * 24);
    return { dataAvailable: true, source: new URL(env.OPEN_METEO_BASE_URL).origin, probability, estimatedDelayHours, value: { weatherDelayFactor: forecast.weatherDelayFactor, forecastSource: forecast.source, reason: forecast.reason }, unavailableReason: null };
  }
}

export function getRiskSignalClients(): SignalClient[] {
  if (env.RISK_POLL_MODE === "synthetic") return riskSignalTypes.map((type) => new SyntheticSignalClient(type));
  const endpoints: Record<RiskSignalType, string | undefined> = { procurement_status: env.RISK_PROCUREMENT_URL, equipment_lead_time: env.RISK_LEAD_TIME_URL, workforce_availability: env.RISK_WORKFORCE_URL, weather_forecast: env.RISK_WEATHER_URL };
  return riskSignalTypes.map((type) => type === "weather_forecast" ? new OpenMeteoSignalClient() : new HttpSignalClient(type, endpoints[type]));
}
