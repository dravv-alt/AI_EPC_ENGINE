import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
import { getDashboardData } from "@/lib/dashboard-data";
import { CommandCenterWorkbench } from "@/components/command-center-workbench";
import { LiveFeed } from "@/components/live-feed";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const projectId = await getActiveProjectId();
  const [data, items] = await Promise.all([
    getDashboardData(projectId),
    db.select().from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.createdAt))
  ]);
  
  if (!data) throw new Error("Project not found");
  
  // Transform DB items slightly if needed or pass directly
  const initialAlerts = items.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    eventType: item.eventType,
    title: item.title,
    status: item.status as "active" | "cleared",
    payload: item.payload as Record<string, any>,
    createdAt: item.createdAt,
  }));
  
  return (
    <FeatureShell
      projectName={data.project}
      eyebrow="Unified event view"
      title="Command center"
      description="Read-only operational alerts cross-link agent events to project impacts without changing readiness or schedule dates."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "24px", alignItems: "start" }}>
        <div>
          <CommandCenterWorkbench initialAlerts={initialAlerts} projectId={projectId} />
        </div>
        
        <div>
          <LiveFeed projectId={projectId} />
        </div>
      </div>
    </FeatureShell>
  );
}
