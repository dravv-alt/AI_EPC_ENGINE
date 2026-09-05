import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { RackModelWorkbench } from "@/components/rack-model-workbench";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { rackModels } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
import { loadRackModel } from "@/lib/rack-model/load";

export const dynamic = "force-dynamic";

export default async function RackModelPage() {
  const projectId = await getActiveProjectId();
  const [dashboard, models] = await Promise.all([
    getProjectShellData(projectId),
    db.select().from(rackModels).where(eq(rackModels.projectId, projectId)).orderBy(desc(rackModels.revision)),
  ]);
  if (!dashboard) throw new Error("Project not found");
  const bundle = models[0] ? await loadRackModel(projectId, models[0].id) : null;
  return <FeatureShell projectName={dashboard.project} projectId={projectId} eyebrow="Engineering · RackDB-compatible planning" title="Digital Rack Model" description="Generate, inspect, review, and export traceable rack layouts from Site Analysis and controlled project records.">
    <RackModelWorkbench projectId={projectId} initialModels={models} initialBundle={bundle} />
  </FeatureShell>;
}
