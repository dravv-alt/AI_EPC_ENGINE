import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { shipments } from "@/lib/db/schema";
import { processScheduleEvent } from "@/lib/events/process";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { calculateShipmentStatus } from "@/lib/supply/status";
import { currentMappedTaskIds } from "@/lib/supply/task-mapping";
import { getShipmentRoute } from "@/lib/routing";

const schema = z.object({ plannedEta: z.string().datetime().optional(), requiredOnSite: z.string().datetime().optional(), portCongestion: z.boolean().optional(), weatherDelayFactor: z.coerce.number().min(0).optional(), status: z.enum(["green", "amber", "red", "delivered"]).optional(), currentPosition: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), source: z.enum(["live", "simulated"]), reason: z.string().trim().max(1000).optional() }).optional(), assessedThreats: z.array(z.string()).optional() });

export async function GET(_: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params; const shipment = await db.query.shipments.findFirst({ where: eq(shipments.id, shipmentId) }); if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  try {
    await requireProjectPermission(shipment.projectId, "audit:view");
    if (!shipment.originLat || !shipment.originLng || !shipment.destinationLat || !shipment.destinationLng) return NextResponse.json({ shipment, route: [], estimate: true, routeAvailable: false, reason: "Origin and destination coordinates are required before a route can be drawn." });
    const mode = shipment.transportMode === "air" || shipment.transportMode === "land" ? shipment.transportMode : "sea";
    const route = await getShipmentRoute(Number(shipment.originLat), Number(shipment.originLng), Number(shipment.destinationLat), Number(shipment.destinationLng), mode);
    return NextResponse.json({ shipment, route, estimate: true, routeAvailable: route.length > 0, reason: route.length ? undefined : "A verified route could not be calculated for these coordinates." });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load shipment." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Shipment update is invalid.", issues: parsed.error.flatten() }, { status: 400 }); const shipment = await db.query.shipments.findFirst({ where: eq(shipments.id, shipmentId) }); if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(shipment.projectId, "schedule:manage"); const plannedEta = parsed.data.plannedEta ? new Date(parsed.data.plannedEta) : shipment.plannedEta; const requiredOnSite = parsed.data.requiredOnSite ? new Date(parsed.data.requiredOnSite) : shipment.requiredOnSite; const portCongestion = parsed.data.portCongestion ?? shipment.portCongestion; const weatherDelayFactor = parsed.data.weatherDelayFactor ?? Number(shipment.weatherDelayFactor);
    let nextStatus = shipment.status; let newAdjustedEta = shipment.weatherAdjustedEta; let newFactor = weatherDelayFactor;
    if (parsed.data.status === "delivered") { nextStatus = "delivered"; } else if (shipment.status !== "delivered") { const calculated = calculateShipmentStatus({ plannedEta, requiredOnSite, portCongestion, weatherDelayFactor }); nextStatus = calculated.status; newAdjustedEta = calculated.weatherAdjustedEta; newFactor = calculated.weatherDelayFactor; }
    const [updated] = await db.update(shipments).set({ plannedEta, requiredOnSite, portCongestion, weatherAdjustedEta: newAdjustedEta, weatherDelayFactor: String(newFactor), status: nextStatus, lastNotifiedStatus: nextStatus, currentLat: parsed.data.currentPosition ? String(parsed.data.currentPosition.lat) : shipment.currentLat, currentLng: parsed.data.currentPosition ? String(parsed.data.currentPosition.lng) : shipment.currentLng, positionSource: parsed.data.currentPosition?.source ?? shipment.positionSource, telemetryReason: parsed.data.currentPosition?.reason ?? shipment.telemetryReason, lastPolledAt: parsed.data.currentPosition ? new Date() : shipment.lastPolledAt, assessedThreats: parsed.data.assessedThreats ?? shipment.assessedThreats, updatedAt: new Date() }).where(eq(shipments.id, shipment.id)).returning();
    await writeAuditEvent({ projectId: shipment.projectId, actorId: actor.userId, action: "shipment.updated", entityType: "shipment", entityId: shipment.id, before: { status: shipment.status, weatherAdjustedEta: shipment.weatherAdjustedEta, positionSource: shipment.positionSource }, after: { status: updated.status, weatherAdjustedEta: updated.weatherAdjustedEta, positionSource: updated.positionSource, estimate: true } });
    let eventWarning: string | null = null;
    if (nextStatus !== shipment.status && nextStatus !== "delivered") try {
      const affectedTaskIds = shipment.equipmentId ? await currentMappedTaskIds(shipment.projectId, shipment.equipmentId) : [];
      const common = { eventId: randomUUID(), projectId: shipment.projectId, occurredAt: new Date().toISOString(), transitionId: `${shipment.status}-to-${nextStatus}-${Date.now()}` };
      if (nextStatus === "green") await processScheduleEvent({ ...common, eventType: "SHIPMENT_RECOVERED", payload: { shipmentId: shipment.id, availableAt: newAdjustedEta?.toISOString() ?? shipment.plannedEta.toISOString(), previousAvailableAt: shipment.weatherAdjustedEta?.toISOString(), affectedTaskIds, estimate: true } }, actor.userId);
      else await processScheduleEvent({ ...common, eventType: "SHIPMENT_DELAYED", payload: { shipmentId: shipment.id, status: nextStatus as "amber" | "red", availableAt: newAdjustedEta?.toISOString() ?? shipment.plannedEta.toISOString(), previousAvailableAt: shipment.weatherAdjustedEta?.toISOString(), affectedTaskIds, estimate: true } }, actor.userId);
    } catch (error) { eventWarning = error instanceof Error ? error.message : "Transition event failed."; }
    return NextResponse.json({ shipment: updated, transition: nextStatus === shipment.status ? null : `${shipment.status}_to_${nextStatus}`, estimate: true, eventWarning });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update shipment." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
