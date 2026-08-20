import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { ShipmentWorkbench } from "@/components/shipment-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, shipments } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";
export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ shipment?: string; id?: string }> }) {
  const projectId = await getActiveProjectId();
  const { shipment, id } = await searchParams;
  const [data, items, assetRows] = await Promise.all([getDashboardData(projectId), db.select().from(shipments).where(eq(shipments.projectId, projectId)).orderBy(desc(shipments.createdAt)), db.select({ id: assets.id, tag: assets.tag, assetType: assets.assetType }).from(assets).where(eq(assets.projectId, projectId))]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Delivery · supply visibility" title="Shipments & Logistics" description="Track single-leg equipment movement with deterministic ETA/status, antimeridian-safe routes, explicit data provenance, and server-side schedule transitions."><ShipmentWorkbench projectId={projectId} initialShipments={items as any} assets={assetRows} initialShipmentId={shipment ?? id} /></FeatureShell>;
}
