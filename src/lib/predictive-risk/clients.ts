import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { OpenMeteoWeatherClient } from "@/lib/supply/weather-client";

export const riskSignalTypes = ["procurement_status", "equipment_lead_time", "workforce_availability", "weather_forecast"] as const;
export type RiskSignalType = (typeof riskSignalTypes)[number];

export interface RiskTaskContext { taskId: string; taskName: string; startAt: Date; endAt: Date; deadline: Date | null; isCritical: boolean }
export interface SignalObservation { dataAvailable: boolean; source: string; probability: number | null; estimatedDelayHours: number | null; value: Record<string, unknown> | null; unavailableReason: string | null }
export interface SignalClient { type: RiskSignalType; poll(task: RiskTaskContext): Promise<SignalObservation> }

const responseSchema = z.object({ dataAvailable: z.boolean(), probability: z.number().min(0).max(1).nullable(), estimatedDelayHours: z.number().int().nonnegative().nullable(), value: z.record(z.unknown()).nullable().default(null), unavailableReason: z.string().max(1000).nullable().default(null) });

// Deterministic-per-cycle, varying-across-cycles synthetic observation. Every
// task/signal pair gets a stable reading for the duration of one
// POLL_INTERVAL_MS bucket (so two polls firing in the same window never
// contradict each other) but a different reading in the next bucket — this is
// what lets risks organically appear, persist, and self-resolve across
// consecutive poll cycles instead of the flat constant this replaces, which
// could never cross the materiality thresholds.
class SyntheticSignalClient implements SignalClient {
  constructor(readonly type: RiskSignalType) {}
  async poll(task: RiskTaskContext): Promise<SignalObservation> {
    const cycleBucket = Math.floor(Date.now() / env.POLL_INTERVAL_MS);
    const seedInput = `${task.taskId}:${this.type}:${cycleBucket}`;
    const seedHex = createHash("sha256").update(seedInput).digest("hex");
    const frac1 = parseInt(seedHex.slice(0, 8), 16) / 0xffffffff;
    const frac2 = parseInt(seedHex.slice(8, 16), 16) / 0xffffffff;
    const frac3 = parseInt(seedHex.slice(16, 24), 16) / 0xffffffff;

    const dataAvailable = frac3 >= 0.125;
    if (!dataAvailable) {
      return { dataAvailable: false, source: `synthetic:${this.type}`, probability: null, estimatedDelayHours: null, value: null, unavailableReason: "Synthetic signal unavailable this cycle." };
    }

    let probability = 0.15 + frac1 * 0.70;
    if (task.isCritical) probability = Math.min(1, probability * 1.15);
    const estimatedDelayHours = Math.round(frac2 * 36);

    return { dataAvailable: true, source: `synthetic:${this.type}`, probability, estimatedDelayHours, value: { taskName: task.taskName, mode: "synthetic-baseline", advisory: true, cycleBucket }, unavailableReason: null };
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
