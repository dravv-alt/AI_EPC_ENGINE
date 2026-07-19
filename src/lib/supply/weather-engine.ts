import { db } from "@/lib/db/client";
import { alerts, scheduleEvents, shipments } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { calculateShipmentStatus } from "./status";
import { currentMappedTaskIds } from "./task-mapping";
import { randomUUID } from "node:crypto";

export async function fetchWeatherAndCalculateDelay(lat: number, lng: number): Promise<{ delayFactor: number, isStorm: boolean }> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,wind_speed_10m,weather_code&wind_speed_unit=kmh`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.current) return { delayFactor: 0, isStorm: false };

    const windSpeed = data.current.wind_speed_10m || 0;
    const precipitation = data.current.precipitation || 0;
    const weatherCode = data.current.weather_code || 0;

    let delayFactor = 0;
    if (windSpeed > 50) delayFactor += 0.5;
    if (precipitation > 10) delayFactor += 0.3;
    
    const isStorm = [95, 96, 99].includes(weatherCode);
    if (isStorm) delayFactor += 1.0;

    return { delayFactor, isStorm };
  } catch (error) {
    console.error("Failed to fetch weather data", error);
    return { delayFactor: 0, isStorm: false };
  }
}

export async function processShipmentsWeather() {
  const activeShipments = await db.query.shipments.findMany({
    where: isNotNull(shipments.currentLat)
  });

  for (const shipment of activeShipments) {
    if (!shipment.currentLat || !shipment.currentLng) continue;

    const lat = parseFloat(shipment.currentLat);
    const lng = parseFloat(shipment.currentLng);

    const { delayFactor } = await fetchWeatherAndCalculateDelay(lat, lng);

    const statusResult = calculateShipmentStatus({
      plannedEta: shipment.plannedEta,
      requiredOnSite: shipment.requiredOnSite,
      portCongestion: shipment.portCongestion,
      weatherDelayFactor: delayFactor,
      now: new Date()
    });

    // Orchestrator Propagation Logic
    if (shipment.status !== statusResult.status && (statusResult.status === "amber" || statusResult.status === "red")) {
      console.log(`Shipment ${shipment.id} state transition detected: ${shipment.status} -> ${statusResult.status}`);
      
      let affectedTaskIds: string[] = [];
      if (shipment.equipmentId) {
        affectedTaskIds = await currentMappedTaskIds(shipment.projectId, shipment.equipmentId);
      }

      if (affectedTaskIds.length > 0) {
        // 1. Generate Schedule Event for Orchestrator
        await db.insert(scheduleEvents).values({
          projectId: shipment.projectId,
          eventId: `shipment_delay_${shipment.id}_${Date.now()}`,
          eventType: "SHIPMENT_DELAYED",
          dedupKey: `shipment_delay_${shipment.id}_${statusResult.status}`,
          occurredAt: new Date(),
          payload: {
            shipmentId: shipment.id,
            delayHours: statusResult.delayHours,
            affectedTaskIds
          }
        }).onConflictDoNothing();

        // 2. Push Unified Alert to Command Center
        await db.insert(alerts).values({
          id: randomUUID(),
          projectId: shipment.projectId,
          eventType: "SHIPMENT_DELAYED",
          dedupKey: `alert_shipment_delay_${shipment.id}_${statusResult.status}`,
          title: `Shipment Delayed: ${shipment.name}`,
          status: "active",
          payload: {
            shipmentId: shipment.id,
            delayHours: statusResult.delayHours,
            reason: "Severe Weather Conditions",
            affectedTaskIds
          }
        }).onConflictDoNothing();
      }
    }

    await db.update(shipments)
      .set({
        weatherDelayFactor: delayFactor.toString(),
        weatherAdjustedEta: statusResult.weatherAdjustedEta,
        status: statusResult.status,
        lastNotifiedStatus: statusResult.status,
        lastPolledAt: new Date()
      })
      .where(eq(shipments.id, shipment.id));
      
    console.log(`Updated shipment ${shipment.id} (${shipment.name}): delayFactor=${delayFactor}, status=${statusResult.status}`);
  }
}

