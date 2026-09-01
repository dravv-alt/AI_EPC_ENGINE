import { FeatureShell } from "@/components/feature-shell";
import { GraphWorkbench } from "@/components/graph-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { getProjectGraph } from "@/lib/graph/entities";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const projectId = await getActiveProjectId();
  const { focus } = await searchParams;
  const [data, graph] = await Promise.all([
    getDashboardData(projectId),
    getProjectGraph(projectId)
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Assurance · connected context" title="Traceability" description="Inspect and create project-scoped typed relationships, then trace every controlled mutation through the append-only audit timeline.">
    <GraphWorkbench projectId={projectId} nodes={graph.nodes} edges={graph.edges} initialFocusId={focus} />
  </FeatureShell>;
}
