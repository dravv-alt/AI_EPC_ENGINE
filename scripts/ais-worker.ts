import { eq, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { shipments } from "../src/lib/db/schema";
import { env } from "../src/lib/env";

const WS_URL = "wss://stream.aisstream.io/v0/stream";
const SUBSCRIPTION_INTERVAL_MS = 60_000;

async function getTrackedMMSIs(): Promise<string[]> {
  const tracked = await db
    .select({ mmsi: shipments.mmsi })
    .from(shipments)
    .where(isNotNull(shipments.mmsi));

  return tracked
    .map((shipment) => shipment.mmsi)
    .filter((mmsi): mmsi is string => typeof mmsi === "string" && mmsi.trim().length > 0);
}

export interface AisWorkerHandle {
  close(): void;
}

/**
 * Keeps one AISStream subscription current for every shipment carrying an MMSI.
 * This is deliberately started by the core worker only when AIS_MODE=aisstream;
 * the regular supply poll remains responsible for weather/risk calculations.
 */
export function startAisWorker(): AisWorkerHandle | null {
  if (env.AIS_MODE !== "aisstream") {
    console.log("AIS Stream worker disabled because AIS_MODE is not aisstream.");
    return null;
  }
  const apiKey = env.AISSTREAM_API_KEY;
  if (!apiKey) {
    // Fail closed but keep the core worker alive so its durable jobs can surface
    // explicit provider-unavailable status rather than fabricated positions.
    console.error("AIS Stream worker disabled: AISSTREAM_API_KEY is required when AIS_MODE=aisstream.");
    return null;
  }

  console.log("Starting AIS Stream worker.");
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let stopped = false;
  let activeMMSIs = new Set<string>();

  const updateSubscription = async () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const mmsis = await getTrackedMMSIs();
    activeMMSIs = new Set(mmsis);
    socket.send(JSON.stringify({
      // AISStream's documented subscription field is APIKey.
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: mmsis,
      FilterMessageTypes: ["PositionReport"],
    }));
    console.log(mmsis.length ? `AIS Stream tracking ${mmsis.length} MMSI(s).` : "AIS Stream has no MMSIs to track.");
  };

  const connect = () => {
    if (stopped) return;
    console.log("Connecting to aisstream.io.");
    socket = new WebSocket(WS_URL);
    socket.addEventListener("open", () => {
      void updateSubscription().catch((error) => console.error("Unable to refresh AIS subscription:", error));
    });
    socket.addEventListener("message", (event) => {
      void (async () => {
        try {
          const raw = typeof event.data === "string" ? event.data : event.data instanceof ArrayBuffer ? Buffer.from(event.data).toString("utf8") : "{}";
          const data = JSON.parse(raw);
          const report = data?.Message?.PositionReport;
          const mmsi = String(data?.MetaData?.MMSI ?? "");
          if (!activeMMSIs.has(mmsi) || !report || typeof report.Latitude !== "number" || typeof report.Longitude !== "number") return;
          await db.update(shipments).set({
            currentLat: String(report.Latitude),
            currentLng: String(report.Longitude),
            positionSource: "aisstream",
            telemetryReason: "Live AIS position from aisstream.io.",
            lastPolledAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(shipments.mmsi, mmsi));
        } catch (error) {
          console.error("Error processing AIS message:", error);
        }
      })();
    });
    socket.addEventListener("error", () => console.error("AIS Stream WebSocket error."));
    socket.addEventListener("close", () => {
      socket = null;
      if (!stopped) {
        console.error("AIS Stream connection closed; reconnecting in 5 seconds.");
        reconnectTimer = setTimeout(connect, 5_000);
      }
    });
  };

  connect();
  const subscriptionTimer = setInterval(() => {
    void updateSubscription().catch((error) => console.error("Unable to refresh AIS subscription:", error));
  }, SUBSCRIPTION_INTERVAL_MS);

  return {
    close() {
      stopped = true;
      clearInterval(subscriptionTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { socket?.close(); } catch { /* already closed */ }
    },
  };
}

if (process.argv[1]?.endsWith("ais-worker.ts")) {
  const worker = startAisWorker();
  const shutdown = () => { worker?.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
