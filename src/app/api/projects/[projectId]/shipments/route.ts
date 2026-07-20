import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, edges, projects, shipments } from "@/lib/db/schema";
import { processScheduleEvent } from "@/lib/events/process";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { calculateShipmentStatus } from "@/lib/supply/status";
import { currentMappedTaskIds, equipmentTaskIds } from "@/lib/supply/task-mapping";

const coordinate = z.object({ name: z.string().trim().min(2).max(200), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const schema = z.object({ name: z.string().min(3).max(200), equipmentId: z.string().uuid(), transportMode: z.enum(["sea", "air", "land"]).default("sea"), origin: coordinate, destination: coordinate, mmsi: z.string().regex(/^\d{7,9}$/).optional(), plannedEta: z.string().datetime(), requiredOnSite: z.string().datetime(), portCongestion: z.boolean().default(false), weatherDelayFactor: z.number().min(0).max(2).default(0) });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); const items = await db.select().from(shipments).where(eq(shipments.projectId, projectId)).orderBy(desc(shipments.updatedAt)); return NextResponse.json({ items, estimate: true, pollingSeconds: 30 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load shipments" }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Shipment data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    const [project, equipment] = await Promise.all([db.query.projects.findFirst({ where: eq(projects.id, projectId) }), db.query.assets.findFirst({ where: and(eq(assets.id, parsed.data.equipmentId), eq(assets.projectId, projectId)) })]);
    if (!project || !equipment) return NextResponse.json({ error: "Project or equipment is outside the active scope." }, { status: 400 });
    const CONGESTED_PORTS = ["Port of Los Angeles", "Port of Singapore", "Port of Shanghai", "Port of Rotterdam"];
    let isCongested = parsed.data.portCongestion || CONGESTED_PORTS.includes(parsed.data.destination.name);
    if (!isCongested) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${parsed.data.destination.lat}&longitude=${parsed.data.destination.lng}&current=wind_speed_10m,precipitation,weather_code&wind_speed_unit=kmh`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`Weather service returned HTTP ${res.status}.`);
        const data = await res.json();
        const current = data.current;
        if (current) {
          if (current.wind_speed_10m > 50 || current.precipitation > 10 || (current.weather_code >= 95 && current.weather_code <= 99)) {
            isCongested = true;
          }
        }
      } catch (e) {
        console.error('Failed to fetch weather for destination port', e);
      }
    }
    const calculated = calculateShipmentStatus({ plannedEta: new Date(parsed.data.plannedEta), requiredOnSite: new Date(parsed.data.requiredOnSite), portCongestion: isCongested, weatherDelayFactor: parsed.data.weatherDelayFactor });
    const mappedTasks = await equipmentTaskIds(projectId, equipment.id);
    const shipment = await db.transaction(async (tx) => {
      const [shipment] = await tx.insert(shipments).values({ tenantId: project.tenantId, projectId, equipmentId: equipment.id, name: parsed.data.name, transportMode: parsed.data.transportMode, originName: parsed.data.origin.name, originLat: String(parsed.data.origin.lat), originLng: String(parsed.data.origin.lng), destinationName: parsed.data.destination.name, destinationLat: String(parsed.data.destination.lat), destinationLng: String(parsed.data.destination.lng), currentLat: String(parsed.data.origin.lat), currentLng: String(parsed.data.origin.lng), positionSource: "simulated", mmsi: parsed.data.mmsi ?? null, plannedEta: new Date(parsed.data.plannedEta), weatherAdjustedEta: calculated.weatherAdjustedEta, weatherDelayFactor: String(calculated.weatherDelayFactor), telemetryReason: "Awaiting AIS poll; deterministic simulated origin is displayed.", lastPolledAt: new Date(), requiredOnSite: new Date(parsed.data.requiredOnSite), portCongestion: isCongested, status: calculated.status, lastNotifiedStatus: calculated.status, createdBy: actor.userId }).returning();
      if (mappedTasks.length) await tx.insert(edges).values(mappedTasks.map((taskId) => ({ projectId, fromType: "shipment", fromId: shipment.id, relationshipType: "AFFECTS", toType: "schedule_task", toId: taskId }))).onConflictDoNothing();
      return shipment;
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "shipment.registered", entityType: "shipment", entityId: shipment.id, after: { equipmentId: equipment.id, status: calculated.status, positionSource: "simulated", estimate: true, mappedTaskIds: mappedTasks } });
    let eventWarning: string | null = null;
    if (calculated.status !== "green") try { const affectedTaskIds = await currentMappedTaskIds(projectId, equipment.id); await processScheduleEvent({ eventId: randomUUID(), projectId, occurredAt: new Date().toISOString(), transitionId: `created-${calculated.status}`, eventType: "SHIPMENT_DELAYED", payload: { shipmentId: shipment.id, status: calculated.status, availableAt: calculated.weatherAdjustedEta.toISOString(), affectedTaskIds, estimate: true } }, actor.userId); } catch (error) { eventWarning = error instanceof Error ? error.message : "Shipment event could not be emitted."; }
    return NextResponse.json({ shipment, positionSource: "simulated", estimate: true, mappedTaskIds: mappedTasks, eventWarning }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create shipment" }, { status: error instanceof AccessError ? error.status : 500 }); }
}
