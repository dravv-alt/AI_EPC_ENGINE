import { greatCircle } from "@turf/great-circle";
import { point } from "@turf/helpers";
import { env } from "@/lib/env";

export interface AisPositionQuery {
  mmsi: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  departedAt: Date;
  plannedEta: Date;
  now: Date;
}

export interface AisObservation {
  lat: number;
  lng: number;
  source: "live" | "simulated";
  positionSource: "aisstream" | "simulated";
  reason: string;
}

export interface AisClient {
  poll(query: AisPositionQuery): Promise<AisObservation>;
}

// Deterministic great-circle interpolation from origin to destination by the
// elapsed fraction of the planned voyage. No network, no randomness — the same
// inputs always yield the same position, which keeps verification reproducible.
export class SyntheticAisClient implements AisClient {
  async poll(query: AisPositionQuery): Promise<AisObservation> {
    const total = query.plannedEta.getTime() - query.departedAt.getTime();
    const elapsed = query.now.getTime() - query.departedAt.getTime();
    const fraction = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
    const line = greatCircle(point([query.originLng, query.originLat]), point([query.destinationLng, query.destinationLat]), { npoints: 101 });
    const coords = line.geometry.coordinates as [number, number][];
    const [lng, lat] = coords[Math.min(coords.length - 1, Math.round(fraction * (coords.length - 1)))];
    return { lat, lng, source: "simulated", positionSource: "simulated", reason: `Synthetic AIS: ${Math.round(fraction * 100)}% along planned great-circle route.` };
  }
}

// aisstream.io live driver. Opt-in via AIS_MODE=aisstream with an API key. The
// synthetic client is the deterministic fallback when the key is absent or a
// live position is unavailable, so the poll loop never blocks.
export class AisStreamClient implements AisClient {
  private readonly fallback = new SyntheticAisClient();
  constructor(private readonly apiKey?: string) {}
  async poll(query: AisPositionQuery): Promise<AisObservation> {
    if (!this.apiKey) return this.fallback.poll(query);
    try {
      const live = await this.fetchLivePosition(query.mmsi);
      if (!live) return this.fallback.poll(query);
      return { lat: live.lat, lng: live.lng, source: "live", positionSource: "aisstream", reason: "Live AIS position from aisstream.io." };
    } catch {
      return this.fallback.poll(query);
    }
  }

  private fetchLivePosition(mmsi: string): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value: { lat: number; lng: number } | null) => { if (settled) return; settled = true; clearTimeout(timer); try { socket.close(); } catch { /* already closing */ } resolve(value); };
      const timer = setTimeout(() => finish(null), 8_000);
      let socket: WebSocket;
      try {
        socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
      } catch (error) { clearTimeout(timer); reject(error); return; }
      socket.addEventListener("open", () => socket.send(JSON.stringify({ APIKey: this.apiKey, BoundingBoxes: [[[-90, -180], [90, 180]]], FiltersShipMMSI: [mmsi], FilterMessageTypes: ["PositionReport"] })));
      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(typeof event.data === "string" ? event.data : "{}");
          const report = data?.Message?.PositionReport;
          if (report && typeof report.Latitude === "number" && typeof report.Longitude === "number") finish({ lat: report.Latitude, lng: report.Longitude });
        } catch { /* ignore malformed frames and wait for the next */ }
      });
      socket.addEventListener("error", () => finish(null));
    });
  }
}

export function getAisClient(): AisClient {
  return env.AIS_MODE === "aisstream" ? new AisStreamClient(env.AISSTREAM_API_KEY) : new SyntheticAisClient();
}
