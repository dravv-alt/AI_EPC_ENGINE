import { asc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { FieldCaptureWorkbench } from "@/components/field-capture-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, systems } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function FieldCapturePage() {
  const projectId = await getActiveProjectId();
  const [data, systemRows, assetRows] = await Promise.all([
    getDashboardData(projectId),
    db.select({ id: systems.id, name: systems.name }).from(systems).where(eq(systems.projectId, projectId)).orderBy(asc(systems.name)),
    db.select({ id: assets.id, systemId: assets.systemId, tag: assets.tag }).from(assets).where(eq(assets.projectId, projectId)).orderBy(asc(assets.tag))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Field authority boundary" title="Field capture" description="Capture observations and artifacts online or offline with visible synchronization state. Only server-reviewed evidence can affect readiness.">
    <FieldCaptureWorkbench projectId={projectId} systems={systemRows} assets={assetRows} />
  </FeatureShell>;
}
