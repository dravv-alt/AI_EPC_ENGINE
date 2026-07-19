import { db } from "@/lib/db/client";
import { alerts, scheduleEvents, shipments } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { calculateShipmentStatus } from "./status";
import { currentMappedTaskIds } from "./task-mapping";
import { randomUUID } from "node:crypto";
import { getShipmentRoute } from "@/lib/routing";
import { assessRouteThreats } from "@/lib/weather/route-threats";

export async function processShipmentsWeather() {
  const activeShipments = await db.query.shipments.findMany({
    where: isNotNull(shipments.currentLat)
  });

  for (const shipment of activeShipments) {
    if (!shipment.currentLat || !shipment.currentLng || !shipment.destinationLat || !shipment.destinationLng) continue;

    const lat = parseFloat(shipment.currentLat);
    const lng = parseFloat(shipment.currentLng);
    const destLat = parseFloat(shipment.destinationLat);
    const destLng = parseFloat(shipment.destinationLng);

    try {
      const segments = await getShipmentRoute(lat, lng, destLat, destLng, shipment.transportMode as any);
      const polyline = segments.flatMap(s => s.coords);
      
      const assessedFingerprints = Array.isArray(shipment.assessedThreats) ? shipment.assessedThreats as string[] : [];
      const assessment = await assessRouteThreats(polyline as [number, number][], assessedFingerprints);

      const newDelayHours = assessment.totalNewDelayHours;
      const currentFactor = Number(shipment.weatherDelayFactor || 0);
      const newFactor = currentFactor + newDelayHours;

      const newFingerprints = assessment.newThreats.map((t: any) => t.fingerprint);
      const updatedThreats = [...assessedFingerprints, ...newFingerprints];

      const statusResult = calculateShipmentStatus({
        plannedEta: shipment.plannedEta,
        requiredOnSite: shipment.requiredOnSite,
        portCongestion: shipment.portCongestion,
        weatherDelayFactor: newFactor,
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
              reason: "Severe Weather Conditions Detected on Route",
              affectedTaskIds
            }
          }).onConflictDoNothing();
        }
      }

      await db.update(shipments)
        .set({
          weatherDelayFactor: newFactor.toString(),
          weatherAdjustedEta: statusResult.weatherAdjustedEta,
          status: statusResult.status,
          lastNotifiedStatus: statusResult.status,
          assessedThreats: updatedThreats,
          lastPolledAt: new Date()
        })
        .where(eq(shipments.id, shipment.id));
        
      console.log(`Updated shipment ${shipment.id} (${shipment.name}): route newDelayHours=${newDelayHours}, status=${statusResult.status}`);
    } catch (e) {
      console.error(`Failed to assess route for shipment ${shipment.id}`, e);
    }
  }
}
