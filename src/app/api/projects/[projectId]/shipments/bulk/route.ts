import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, edges, projects, shipments } from "@/lib/db/schema";
import { processScheduleEvent } from "@/lib/events/process";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { calculateShipmentStatus } from "@/lib/supply/status";
import { equipmentTaskIds, currentMappedTaskIds } from "@/lib/supply/task-mapping";
import { searchLocalPlaces } from "@/lib/geo/places";

async function geocodeNominatim(query: string): Promise<{ lat: number, lng: number } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
      headers: { "User-Agent": "AIEPCEngine/1.0" }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Nominatim error", e);
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  
  try {
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project is outside active scope." }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("csv");
    
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No CSV file provided." }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (!records.length) {
      return NextResponse.json({ error: "CSV file is empty." }, { status: 400 });
    }

    // Extract all unique equipment tags from CSV
    const tags = Array.from(new Set(records.map((r: any) => r["Equipment Tag"])));
    
    // Look up assets by tags in this project
    const projectAssets = await db.select()
      .from(assets)
      .where(and(
        eq(assets.projectId, projectId),
        inArray(assets.tag, tags)
      ));
      
    const assetMap = new Map(projectAssets.map(a => [a.tag, a]));

    const valuesToInsert: typeof shipments.$inferInsert[] = [];
    const validRecords: { asset: typeof projectAssets[number], calculated: ReturnType<typeof calculateShipmentStatus> }[] = [];
    let skippedCount = 0;

    for (const row of records as any[]) {
      const asset = assetMap.get(row["Equipment Tag"]);
      if (!asset) {
        skippedCount++;
        continue;
      }

      const plannedEta = new Date(row["Planned ETA"]);
      const requiredOnSite = new Date(row["Required On Site"]);
      let originLat = row["Origin Lat"];
      let originLng = row["Origin Lng"];
      const originName = row["Origin Name"];
      if (!originLat || !originLng) {
        const matches = searchLocalPlaces(originName);
        if (matches.length > 0) {
          originLat = String(matches[0].lat);
          originLng = String(matches[0].lng);
        } else if (originName) {
          const coords = await geocodeNominatim(originName);
          if (coords) { originLat = String(coords.lat); originLng = String(coords.lng); }
          await new Promise(r => setTimeout(r, 1000)); // Rate limit
        }
      }

      let destLat = row["Destination Lat"];
      let destLng = row["Destination Lng"];
      const destName = row["Destination Name"];
      if (!destLat || !destLng) {
        const matches = searchLocalPlaces(destName);
        if (matches.length > 0) {
          destLat = String(matches[0].lat);
          destLng = String(matches[0].lng);
        } else if (destName) {
          const coords = await geocodeNominatim(destName);
          if (coords) { destLat = String(coords.lat); destLng = String(coords.lng); }
          await new Promise(r => setTimeout(r, 1000)); // Rate limit
        }
      }

      const CONGESTED_PORTS = ["Port of Los Angeles", "Port of Singapore", "Port of Shanghai", "Port of Rotterdam"];
      let portCongestion = row["Port Congestion"]?.toLowerCase() === "true" || CONGESTED_PORTS.includes(row["Destination Name"]);
      if (!portCongestion && destLat && destLng) {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${destLat}&longitude=${destLng}&current=wind_speed_10m,precipitation,weather_code&wind_speed_unit=kmh`;
          const res = await fetch(url);
          const data = await res.json();
          const current = data.current;
          if (current) {
            if (current.wind_speed_10m > 50 || current.precipitation > 10 || (current.weather_code >= 95 && current.weather_code <= 99)) {
              portCongestion = true;
            }
          }
        } catch (e) {
          console.error('Failed to fetch weather for destination port', e);
        }
      }

      const weatherDelayFactor = Number(row["Weather Delay Factor"]) || 0;
      const calculated = calculateShipmentStatus({
        plannedEta,
        requiredOnSite,
        portCongestion,
        weatherDelayFactor
      });

      valuesToInsert.push({
        tenantId: project.tenantId,
        projectId,
        equipmentId: asset.id,
        name: row["Shipment Name"],
        originName,
        originLat: String(originLat),
        originLng: String(originLng),
        destinationName: destName,
        destinationLat: String(destLat),
        destinationLng: String(destLng),
        currentLat: String(originLat),
        currentLng: String(originLng),
        positionSource: "simulated",
        mmsi: row["MMSI"] || null,
        plannedEta,
        weatherAdjustedEta: calculated.weatherAdjustedEta,
        weatherDelayFactor: String(calculated.weatherDelayFactor),
        telemetryReason: "Awaiting AIS poll via bulk ingest",
        lastPolledAt: new Date(),
        requiredOnSite,
        portCongestion,
        status: calculated.status,
        lastNotifiedStatus: calculated.status,
        createdBy: actor.userId
      });

      validRecords.push({ asset, calculated });
    }

    if (valuesToInsert.length === 0) {
      return NextResponse.json({ error: `Failed to process. ${skippedCount} rows had equipment tags that do not exist in this project.` }, { status: 400 });
    }

    const insertedShipments = await db.transaction(async (tx) => {
      const inserted = await tx.insert(shipments).values(valuesToInsert).returning();
      
      const allEdges = [];
      for (let i = 0; i < inserted.length; i++) {
        const shipment = inserted[i];
        const asset = validRecords[i].asset;
        const mappedTasks = await equipmentTaskIds(projectId, asset.id);
        if (mappedTasks.length > 0) {
          allEdges.push(...mappedTasks.map(taskId => ({
            projectId,
            fromType: "shipment",
            fromId: shipment.id,
            relationshipType: "AFFECTS",
            toType: "schedule_task",
            toId: taskId
          })));
        }
      }

      if (allEdges.length > 0) {
        await tx.insert(edges).values(allEdges).onConflictDoNothing();
      }

      return inserted;
    });

    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "shipment.bulk_registered",
      entityType: "project",
      entityId: projectId,
      after: { count: insertedShipments.length, skippedCount }
    });

    // Fire delay events asynchronously
    for (let i = 0; i < insertedShipments.length; i++) {
      const shipment = insertedShipments[i];
      const { asset, calculated } = validRecords[i];
      if (calculated.status !== "green") {
        try {
          const affectedTaskIds = await currentMappedTaskIds(projectId, asset.id);
          await processScheduleEvent({
            eventId: randomUUID(),
            projectId,
            occurredAt: new Date().toISOString(),
            transitionId: `bulk-created-${calculated.status}`,
            eventType: "SHIPMENT_DELAYED",
            payload: {
              shipmentId: shipment.id,
              status: calculated.status,
              availableAt: calculated.weatherAdjustedEta.toISOString(),
              affectedTaskIds,
              estimate: true
            }
          }, actor.userId);
        } catch (err) {
          // Ignore event failures on bulk insert to not block the response
          console.error("Event error on bulk insert:", err);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      insertedCount: insertedShipments.length, 
      skippedCount 
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to bulk insert shipments" }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
