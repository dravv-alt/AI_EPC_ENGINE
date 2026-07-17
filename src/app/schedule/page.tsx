import { desc, eq, inArray } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { ScheduleWorkbench } from "@/components/schedule-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { scheduleAssignments, scheduleTasks, scheduleVersions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function SchedulePage() { const projectId = await getActiveProjectId(); const [data, tasks, versions] = await Promise.all([getDashboardData(projectId), db.select().from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)), db.select().from(scheduleVersions).where(eq(scheduleVersions.projectId, projectId)).orderBy(desc(scheduleVersions.versionNumber))]); if (!data) throw new Error("Project not found"); const assignments = versions.length ? await db.select({ id: scheduleAssignments.id, versionId: scheduleAssignments.versionId, taskName: scheduleTasks.name, startAt: scheduleAssignments.startAt, endAt: scheduleAssignments.endAt, isCritical: scheduleAssignments.isCritical }).from(scheduleAssignments).innerJoin(scheduleTasks, eq(scheduleAssignments.taskId, scheduleTasks.id)).where(inArray(scheduleAssignments.versionId, versions.map((item) => item.id))) : []; return <FeatureShell projectName={data.project} eyebrow="Deterministic planning" title="Schedule" description="Only accepted tasks enter the CP-SAT model; every solve is immutable and explanations are generated after dates are saved."><ScheduleWorkbench projectId={projectId} tasks={tasks} versions={versions.map((version) => ({ ...version, assignments: assignments.filter((item) => item.versionId === version.id) }))} /></FeatureShell>; }
