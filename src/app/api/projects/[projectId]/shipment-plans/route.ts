import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { projects, shipmentPlans, shipments, siteAnalyses } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { buildShipmentPlan } from "@/lib/shipment-planning";
import { searchLocalPlaces } from "@/lib/geo/places";
import { getShipmentRoute } from "@/lib/routing";
import { calculateShipmentStatus } from "@/lib/supply/status";
import { assessRouteThreats } from "@/lib/weather/route-threats";

const schema = z.object({ action: z.enum(["generate", "approve", "reject", "materialize"]), planId: z.string().uuid().optional() });

type Point = { name: string; lat: number; lng: number };

const supplyOriginFor = (mode: "sea" | "air" | "land"): Point => {
  if (mode === "air") return { name: "Hong Kong International Airport", lat: 22.308, lng: 113.914 };
  if (mode === "sea") return { name: "Port of Shanghai", lat: 31.35, lng: 121.573 };
  return { name: "Regional equipment consolidation hub", lat: 19.076, lng: 72.877 };
};

function siteDestination(location: string): Point | null {
  const local = searchLocalPlaces(location)[0];
  if (local) return { name: local.name, lat: local.lat, lng: local.lng };
  const value = location.toLowerCase();
  if (value.includes("virginia") || value.includes("loudoun") || value.includes("ashburn")) return { name: "Ashburn, Virginia", lat: 39.0438, lng: -77.4874 };
  if (value.includes("mumbai") || value.includes("navi mumbai")) return { name: "Navi Mumbai, Maharashtra", lat: 19.033, lng: 73.0297 };
  if (value.includes("singapore") || value.includes("jurong")) return { name: "Jurong, Singapore", lat: 1.3329, lng: 103.7436 };
  if (value.includes("frankfurt")) return { name: "Frankfurt, Hesse", lat: 50.1109, lng: 8.6821 };
  return null;
}

function logisticsDates(mode: "sea" | "air" | "land") {
  const plannedEta = new Date();
  plannedEta.setDate(plannedEta.getDate() + ({ air: 10, land: 21, sea: 56 } as const)[mode]);
  const requiredOnSite = new Date(plannedEta);
  requiredOnSite.setDate(requiredOnSite.getDate() + 14);
  return { plannedEta, requiredOnSite };
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const items = await db.select().from(shipmentPlans).where(eq(shipmentPlans.projectId, projectId)).orderBy(desc(shipmentPlans.updatedAt));
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Unable to load shipment plan", error);
    return NextResponse.json({ error: "Unable to load the shipment plan. Please retry." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Shipment-plan action is invalid." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "schedule:manage");
    if (parsed.data.action === "generate") {
      const analysis = await db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) });
      if (!analysis) return NextResponse.json({ error: "Save Site Analysis before generating a shipment plan." }, { status: 409 });
      const drafts = buildShipmentPlan((analysis.answers ?? {}) as Record<string, string>);
      if (!drafts.length) return NextResponse.json({ error: "Site Analysis does not yet contain a selectable power, cooling, technology, network, controls, or commissioning basis." }, { status: 409 });
      const now = new Date();
      await db.transaction(async (tx) => {
        for (const draft of drafts) {
          await tx.insert(shipmentPlans).values({ projectId, siteAnalysisId: analysis.id, ...draft, status: "proposed", updatedAt: now }).onConflictDoUpdate({
            target: [shipmentPlans.projectId, shipmentPlans.sourceKey],
            // Never overwrite a human decision or an already-created shipment.
            set: { siteAnalysisId: analysis.id, category: draft.category, name: draft.name, requirementLevel: draft.requirementLevel, rationale: draft.rationale, sourceAnswers: draft.sourceAnswers, transportMode: draft.transportMode, updatedAt: now },
          });
        }
      });
      await writeAuditEvent({ projectId, actorId: actor.userId, action: "shipment_plan.generated", entityType: "shipment_plan", entityId: analysis.id, after: { itemCount: drafts.length, source: "site_analysis" } });
      const items = await db.select().from(shipmentPlans).where(eq(shipmentPlans.projectId, projectId)).orderBy(desc(shipmentPlans.updatedAt));
      return NextResponse.json({ items, generated: drafts.length });
    }
    if (!parsed.data.planId) return NextResponse.json({ error: "A plan item is required." }, { status: 400 });
    const plan = await db.query.shipmentPlans.findFirst({ where: eq(shipmentPlans.id, parsed.data.planId) });
    if (!plan || plan.projectId !== projectId) return NextResponse.json({ error: "Shipment plan is outside the active project." }, { status: 404 });
    if (plan.status === "materialized") return NextResponse.json({ error: "This plan already has a shipment. Update the logistics record instead." }, { status: 409 });
    if (parsed.data.action === "reject") {
      const [updated] = await db.update(shipmentPlans).set({ status: "rejected", approvedBy: null, approvedAt: null, updatedAt: new Date() }).where(eq(shipmentPlans.id, plan.id)).returning();
      await writeAuditEvent({ projectId, actorId: actor.userId, action: "shipment_plan.rejected", entityType: "shipment_plan", entityId: plan.id, before: { status: plan.status }, after: { status: updated.status } });
      return NextResponse.json({ item: updated });
    }
    if (parsed.data.action === "approve" && plan.status !== "approved") {
      await db.update(shipmentPlans).set({ status: "approved", approvedBy: actor.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(shipmentPlans.id, plan.id));
    }
    if (plan.status !== "approved" && parsed.data.action !== "approve") return NextResponse.json({ error: "Approve this package before its route can be created." }, { status: 409 });

    const analysis = plan.siteAnalysisId
      ? await db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.id, plan.siteAnalysisId) })
      : await db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) });
    const answers = (analysis?.answers ?? {}) as Record<string, string>;
    const destination = siteDestination(answers.location ?? "");
    if (!destination) return NextResponse.json({ error: "Save a recognized project location in Site Analysis before creating the shipment route." }, { status: 409 });
    const mode = plan.transportMode as "sea" | "air" | "land";
    const origin = supplyOriginFor(mode);
    const { plannedEta, requiredOnSite } = logisticsDates(mode);
    const route = await getShipmentRoute(origin.lat, origin.lng, destination.lat, destination.lng, mode);
    const weather = route.length ? await assessRouteThreats(route.flatMap((segment) => segment.coords)) : null;
    const calculated = calculateShipmentStatus({ plannedEta, requiredOnSite, portCongestion: false, weatherDelayFactor: weather?.dataAvailable ? weather.totalNewDelayHours : 0 });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project is outside the active scope." }, { status: 404 });
    const shipment = await db.transaction(async (tx) => {
      const [created] = await tx.insert(shipments).values({
        tenantId: project.tenantId,
        projectId,
        equipmentId: null,
        name: plan.name,
        transportMode: mode,
        originName: origin.name,
        originLat: String(origin.lat),
        originLng: String(origin.lng),
        destinationName: destination.name,
        destinationLat: String(destination.lat),
        destinationLng: String(destination.lng),
        currentLat: String(origin.lat),
        currentLng: String(origin.lng),
        positionSource: "simulated",
        plannedEta,
        weatherAdjustedEta: calculated.weatherAdjustedEta,
        weatherDelayFactor: String(calculated.weatherDelayFactor),
        telemetryReason: weather?.dataAvailable
          ? "Created automatically from an approved Site Analysis package; route weather was sampled at creation."
          : "Created automatically from an approved Site Analysis package; weather was unavailable, so no weather delay was assumed.",
        assessedThreats: weather?.newThreats.map((threat) => threat.fingerprint) ?? [],
        lastPolledAt: new Date(),
        requiredOnSite,
        portCongestion: false,
        status: calculated.status,
        lastNotifiedStatus: calculated.status,
        createdBy: actor.userId,
      }).returning();
      await tx.update(shipmentPlans).set({ status: "materialized", approvedBy: actor.userId, approvedAt: new Date(), materializedShipmentId: created.id, updatedAt: new Date() }).where(eq(shipmentPlans.id, plan.id));
      return created;
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "shipment_plan.materialized", entityType: "shipment_plan", entityId: plan.id, before: { status: plan.status }, after: { status: "materialized", shipmentId: shipment.id, routeAvailable: route.length > 0 } });
    return NextResponse.json({ item: { ...plan, status: "materialized", materializedShipmentId: shipment.id }, shipment, routeAvailable: route.length > 0, weatherAvailable: Boolean(weather?.dataAvailable) }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Unable to update shipment plan", error);
    return NextResponse.json({ error: "Could not generate the shipment plan. Please retry." }, { status: 500 });
  }
}
