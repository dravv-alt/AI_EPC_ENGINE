import type { RiskTaskContext, SignalClient, SignalObservation, RiskSignalType } from "./clients";

const MARINE_METEO_URL = "https://marine-api.open-meteo.com/v1/marine";

interface MarineMeteoResponse {
  current?: {
    wave_height?: number;
    wave_direction?: number;
    ocean_current_velocity?: number;
    ocean_current_direction?: number;
  };
}

/**
 * Calls the free Open-Meteo Marine API (no key needed) to get current marine weather
 * at the shipment location. Maps wave height and currents to a delay probability.
 */
export class MarineWeatherClient implements SignalClient {
  readonly type: RiskSignalType = "weather_forecast"; // Resusing weather_forecast

  constructor(
    private readonly latitude: number,
    private readonly longitude: number
  ) {}

  async poll(task: RiskTaskContext): Promise<SignalObservation> {
    try {
      const url = new URL(MARINE_METEO_URL);
      url.searchParams.set("latitude", String(this.latitude));
      url.searchParams.set("longitude", String(this.longitude));
      url.searchParams.set("current", "wave_height,wave_direction,ocean_current_velocity,ocean_current_direction");
      url.searchParams.set("timezone", "auto");

      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Open-Meteo Marine returned HTTP ${response.status}`);

      const data: MarineMeteoResponse = await response.json();
      const current = data.current;
      if (!current) throw new Error("Open-Meteo Marine returned no current data.");

      const waveHeight = current.wave_height ?? 0;
      const currentVelocity = current.ocean_current_velocity ?? 0;

      // Probability mapping: conservative thresholds for marine impact
      let probability = 0;
      if (waveHeight > 4.0) probability += 0.5;      // >4m — severe wave action
      else if (waveHeight > 2.5) probability += 0.2; // >2.5m — moderate wave impact
      else if (waveHeight > 1.0) probability += 0.05;// >1m — minor impact

      if (currentVelocity > 4.0) probability += 0.2; // >4km/h ocean current

      probability = Math.min(probability, 1.0);

      // Estimate delay: 8h per severe factor
      const estimatedDelayHours = probability >= 0.5 ? 12
        : probability >= 0.2 ? 4
        : probability >= 0.05 ? 1
        : 0;

      return {
        dataAvailable: true,
        source: "marine-api.open-meteo.com",
        probability: Math.round(probability * 1000) / 1000,
        estimatedDelayHours,
        value: {
          wave_height_m: waveHeight,
          wave_direction: current.wave_direction ?? null,
          ocean_current_velocity_kmh: currentVelocity,
          ocean_current_direction: current.ocean_current_direction ?? null,
          taskName: task.taskName,
          mode: "live-marine-meteo",
          advisory: true,
        },
        unavailableReason: null,
      };
    } catch (error) {
      return {
        dataAvailable: false,
        source: "marine-api.open-meteo.com",
        probability: null,
        estimatedDelayHours: null,
        value: null,
        unavailableReason: error instanceof Error ? error.message : "Marine Weather API unavailable.",
      };
    }
  }
}
