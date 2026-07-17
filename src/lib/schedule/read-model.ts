import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scheduleAssignments, scheduleTasks, scheduleVersions } from "@/lib/db/schema";

export async function getScheduleVersion(versionId: string) {
  const version = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.id, versionId) });
  if (!version) return null;
  const assignments = await db.select({ id: scheduleAssignments.id, taskId: scheduleAssignments.taskId, taskName: scheduleTasks.name, startAt: scheduleAssignments.startAt, endAt: scheduleAssignments.endAt, isCritical: scheduleAssignments.isCritical }).from(scheduleAssignments).innerJoin(scheduleTasks, eq(scheduleAssignments.taskId, scheduleTasks.id)).where(eq(scheduleAssignments.versionId, version.id));
  return { ...version, assignments };
}

export async function getCurrentSchedule(projectId: string) {
  const version = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, projectId), orderBy: [desc(scheduleVersions.versionNumber)] });
  return version ? getScheduleVersion(version.id) : null;
}

export async function diffScheduleVersions(versionId: string, againstId?: string) {
  const current = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.id, versionId) });
  if (!current) return null;
  const against = againstId ? await db.query.scheduleVersions.findFirst({ where: and(eq(scheduleVersions.id, againstId), eq(scheduleVersions.projectId, current.projectId)) }) : current.parentVersionId ? await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.id, current.parentVersionId) }) : null;
  if (!against) return { current, against: null, shiftedTasks: [], added: [], removed: [], netDeadlineImpactHours: 0 };
  const rows = await db.select({ versionId: scheduleAssignments.versionId, taskId: scheduleAssignments.taskId, taskName: scheduleTasks.name, startAt: scheduleAssignments.startAt, endAt: scheduleAssignments.endAt }).from(scheduleAssignments).innerJoin(scheduleTasks, eq(scheduleAssignments.taskId, scheduleTasks.id)).where(inArray(scheduleAssignments.versionId, [current.id, against.id]));
  const currentRows = new Map(rows.filter((row) => row.versionId === current.id).map((row) => [row.taskId, row]));
  const againstRows = new Map(rows.filter((row) => row.versionId === against.id).map((row) => [row.taskId, row]));
  const shiftedTasks = [...currentRows.values()].filter((row) => againstRows.has(row.taskId) && (row.startAt.getTime() !== againstRows.get(row.taskId)!.startAt.getTime() || row.endAt.getTime() !== againstRows.get(row.taskId)!.endAt.getTime())).map((row) => ({ taskId: row.taskId, taskName: row.taskName, beforeStart: againstRows.get(row.taskId)!.startAt, afterStart: row.startAt, beforeEnd: againstRows.get(row.taskId)!.endAt, afterEnd: row.endAt, shiftHours: Math.round((row.endAt.getTime() - againstRows.get(row.taskId)!.endAt.getTime()) / 3_600_000) }));
  const added = [...currentRows.values()].filter((row) => !againstRows.has(row.taskId));
  const removed = [...againstRows.values()].filter((row) => !currentRows.has(row.taskId));
  const maxEnd = (values: Iterable<{ endAt: Date }>) => Math.max(...[...values].map((item) => item.endAt.getTime()), 0);
  return { current, against, shiftedTasks, added, removed, netDeadlineImpactHours: Math.round((maxEnd(currentRows.values()) - maxEnd(againstRows.values())) / 3_600_000) };
}
