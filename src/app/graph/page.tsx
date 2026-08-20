import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { GraphWorkbench } from "@/components/graph-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { auditEvents, users } from "@/lib/db/schema";
import { getProjectGraph } from "@/lib/graph/entities";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const projectId = await getActiveProjectId();
  const [data, graph, audit] = await Promise.all([
    getDashboardData(projectId),
    getProjectGraph(projectId),
    db.select({ id: auditEvents.id, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, createdAt: auditEvents.createdAt, actorName: users.displayName, eventHash: auditEvents.eventHash }).from(auditEvents).leftJoin(users, eq(auditEvents.actorId, users.id)).where(eq(auditEvents.projectId, projectId)).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Assurance · connected context" title="Traceability" description="Inspect and create project-scoped typed relationships, then trace every controlled mutation through the append-only audit timeline.">
    <GraphWorkbench projectId={projectId} nodes={graph.nodes} edges={graph.edges} audit={audit} />
  </FeatureShell>;
}
