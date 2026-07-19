import { desc, eq, inArray } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { ScheduleWorkbench } from "@/components/schedule-workbench";
import { PredictiveRiskWorkbench } from "@/components/predictive-risk-workbench";
import { SourceUploadForm } from "@/components/source-upload-form";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { scheduleAssignments, scheduleDependencies, scheduleEvents, scheduleResources, scheduleRisks, scheduleTasks, scheduleVersions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const projectId = await getActiveProjectId();
  const [data, tasks, resources, dependencies, versions, events, riskRows] = await Promise.all([
    getDashboardData(projectId),
    db.select().from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)),
    db.select().from(scheduleResources).where(eq(scheduleResources.projectId, projectId)),
    db.select().from(scheduleDependencies).where(eq(scheduleDependencies.projectId, projectId)),
    db.select().from(scheduleVersions).where(eq(scheduleVersions.projectId, projectId)).orderBy(desc(scheduleVersions.versionNumber)),
    db.select().from(scheduleEvents).where(eq(scheduleEvents.projectId, projectId)).orderBy(desc(scheduleEvents.occurredAt)),
    db.select({ risk: scheduleRisks, taskName: scheduleTasks.name, eventProcessingStatus: scheduleEvents.processingStatus }).from(scheduleRisks).innerJoin(scheduleTasks, eq(scheduleRisks.taskId, scheduleTasks.id)).leftJoin(scheduleEvents, eq(scheduleRisks.scheduleEventId, scheduleEvents.id)).where(eq(scheduleRisks.projectId, projectId)).orderBy(desc(scheduleRisks.observedAt))
  ]);
  if (!data) throw new Error("Project not found");
  const assignments = versions.length ? await db.select({ id: scheduleAssignments.id, versionId: scheduleAssignments.versionId, taskId: scheduleTasks.id, taskName: scheduleTasks.name, startAt: scheduleAssignments.startAt, endAt: scheduleAssignments.endAt, isCritical: scheduleAssignments.isCritical }).from(scheduleAssignments).innerJoin(scheduleTasks, eq(scheduleAssignments.taskId, scheduleTasks.id)).where(inArray(scheduleAssignments.versionId, versions.map((item) => item.id))) : [];
  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Deterministic planning" title="Schedule management" description="Ingest cited inputs, review every task and resource, solve immutable CP-SAT versions, and trace real-world event impacts without letting AI alter dates.">
    <details className="surface history-panel"><summary>Upload schedule source</summary><SourceUploadForm projectId={projectId} documentType="timeline" titlePlaceholder="Vendor timeline, PO, contract, or approval" submitLabel="Control schedule source" /></details>
    <PredictiveRiskWorkbench projectId={projectId} hasCurrentVersion={versions.length > 0} risks={riskRows} />
    <ScheduleWorkbench projectId={projectId} tasks={tasks} resources={resources} dependencies={dependencies} versions={versions.map((version) => ({ ...version, assignments: assignments.filter((item) => item.versionId === version.id) }))} events={events} />
  </FeatureShell>;
}
