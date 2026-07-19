import { eq, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { shipments } from "../src/lib/db/schema";
import { env } from "../src/lib/env";

const WS_URL = "wss://stream.aisstream.io/v0/stream";
const SUBSCRIPTION_INTERVAL_MS = 60000; // Update subscription every minute

async function getTrackedMMSIs(): Promise<string[]> {
  const tracked = await db
    .select({ mmsi: shipments.mmsi })
    .from(shipments)
    .where(isNotNull(shipments.mmsi));
  
  return tracked
    .map(s => s.mmsi)
    .filter((mmsi): mmsi is string => typeof mmsi === "string" && mmsi.trim().length > 0);
}

async function startAisWorker() {
  const apiKey = env.AIS_STREAM_API_KEY;
  if (!apiKey) {
    console.error("Error: AIS_STREAM_API_KEY is missing from environment variables.");
    process.exit(1);
  }

  console.log("Starting AIS Stream worker...");
  let ws: WebSocket | null = null;
  let activeMMSIs: string[] = [];

  function connect() {
    console.log("Connecting to aisstream.io...");
    ws = new WebSocket(WS_URL);

    ws.onopen = async () => {
      console.log("Connected to AIS Stream.");
      await updateSubscription();
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        
        if (data.MessageType === "PositionReport") {
          const report = data.Message.PositionReport;
          const mmsi = String(data.MetaData.MMSI);
          
          if (activeMMSIs.includes(mmsi)) {
            console.log(`Live position update for MMSI ${mmsi}: [${report.Latitude}, ${report.Longitude}]`);
            
            await db.update(shipments)
              .set({
                currentLat: String(report.Latitude),
                currentLng: String(report.Longitude),
                positionSource: "live",
                lastPolledAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(shipments.mmsi, mmsi));
          }
        }
      } catch (err) {
        console.error("Error processing AIS message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("AIS Stream connection closed. Reconnecting in 5 seconds...");
      setTimeout(connect, 5000);
    };
  }

  async function updateSubscription() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    activeMMSIs = await getTrackedMMSIs();
    if (activeMMSIs.length === 0) {
      console.log("No shipments with MMSI found to track.");
    } else {
      console.log(`Tracking ${activeMMSIs.length} MMSIs: ${activeMMSIs.join(", ")}`);
    }

    const subscriptionMessage = {
      API_Key: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: activeMMSIs
    };

    ws.send(JSON.stringify(subscriptionMessage));
  }

  // Connect initially
  connect();

  // Periodically refresh the tracked MMSIs from the database
  setInterval(updateSubscription, SUBSCRIPTION_INTERVAL_MS);
}

startAisWorker().catch(console.error);
