import { asc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { SystemsWorkbench } from "@/components/systems-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, gates, systems } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function SystemsPage() {
  const projectId = await getActiveProjectId();
  const [data, systemRows, assetRows, gateRows] = await Promise.all([
    getDashboardData(projectId),
    db.select().from(systems).where(eq(systems.projectId, projectId)).orderBy(asc(systems.name)),
    db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(asc(assets.tag)),
    db.select().from(gates).where(eq(gates.projectId, projectId)).orderBy(asc(gates.sequenceNumber))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Authority graph" title="Systems, assets & gates" description="Configure the controlled hierarchy that every requirement, field record, test, decision, and schedule link must reference.">
    <SystemsWorkbench projectId={projectId} systems={systemRows} assets={assetRows} gates={gateRows} />
  </FeatureShell>;
}
