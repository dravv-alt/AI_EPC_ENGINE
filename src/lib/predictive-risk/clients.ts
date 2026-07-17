import { z } from "zod";
import { env } from "@/lib/env";

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

export function getRiskSignalClients(): SignalClient[] {
  if (env.RISK_POLL_MODE === "synthetic") return riskSignalTypes.map((type) => new SyntheticSignalClient(type));
  const endpoints: Record<RiskSignalType, string | undefined> = { procurement_status: env.RISK_PROCUREMENT_URL, equipment_lead_time: env.RISK_LEAD_TIME_URL, workforce_availability: env.RISK_WORKFORCE_URL, weather_forecast: env.RISK_WEATHER_URL };
  return riskSignalTypes.map((type) => new HttpSignalClient(type, endpoints[type]));
}
