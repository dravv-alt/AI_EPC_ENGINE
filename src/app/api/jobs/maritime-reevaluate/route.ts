import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { shipments } from "@/lib/db/schema";
import { eq, notInArray } from "drizzle-orm";
import { executeShipmentReeval } from "@/lib/maritime/jobs/reevaluate-shipment";
import { VESSEL_PROFILES } from "@/lib/maritime/vessel-profiles";
import { decomposeRouteGeodesic } from "@/lib/maritime/route-decomposition";

/**
 * GET /api/jobs/maritime-reevaluate
 * ----------------------------------------------------------------------------
 * Scheduled cron handler that periodically sweeps all in-transit shipments,
 * assimilates live NWP wave & wind forecasts along their geodesic corridors,
 * calculates Kwon (2008) hydrodynamics + GBDT residuals, writes SHA-256 audit logs,
 * and emits delta alerts on significant schedule slips (>= 2.0h).
 *
 * Can be invoked by:
 * - Vercel Cron (`cron: "0 *\/4 * * *"`)
 * - GitHub Actions schedule (`cron: "0 *\/4 * * *"`)
 * - Cloudflare Worker / AWS EventBridge / curl
 */
export async function GET(request: Request) {
  try {
    // 1. Fetch all active non-terminal shipments from the database
    const activeShipments = await db.query.shipments.findMany({
      where: notInArray(shipments.status, ["delivered", "cancelled"]),
    });

    const results = [];

    for (const s of activeShipments) {
      if (!s.originLat || !s.originLng || !s.destinationLat || !s.destinationLng) {
        continue;
      }

      // Decompose route into geodesic waypoints (<= 50nm intervals)
      const rawWaypoints = [
        { lat: Number(s.originLat), lng: Number(s.originLng) },
        { lat: Number(s.destinationLat), lng: Number(s.destinationLng) },
      ];
      const waypoints = decomposeRouteGeodesic(rawWaypoints, 50);

      // Select matching vessel profile (defaults to Post-Panamax Container Vessel)
      const vessel =
        s.transportMode === "air"
          ? VESSEL_PROFILES.Container_Feeder
          : s.transportMode === "land"
            ? VESSEL_PROFILES.GeneralCargo_Handysize
            : VESSEL_PROFILES.Container_PostPanamax;

      const evalContext = {
        shipmentId: s.id,
        routeId: `route_${s.id}`,
        vessel,
        plannedSpeedKnots: vessel.designSpeedKnots || 18.0,
        isLaden: true,
        departureTime: new Date(s.createdAt || Date.now()),
        status: s.status || "in_transit",
        waypoints,
      };

      const result = await executeShipmentReeval(evalContext, "scheduled_reeval");
      results.push(result);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      evaluatedCount: results.length,
      skippedCount: results.filter((r) => r.skipped).length,
      alertsEmitted: results.filter((r) => r.alertEvent).length,
      results: results.map((r) => ({
        shipmentId: r.shipmentId,
        skipped: r.skipped,
        skipReason: r.skipReason,
        auditRecordId: r.auditRecordId,
        alertType: r.alertEvent?.type ?? null,
        totalPredictedDelayHours: r.assessment?.totalDelayHours ?? null,
      })),
    });
  } catch (error: any) {
    console.error("[Cron /api/jobs/maritime-reevaluate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute maritime re-evaluation cron.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
