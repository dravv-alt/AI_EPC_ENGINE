import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { edges, scheduleAssignments, scheduleVersions } from "@/lib/db/schema";

export async function equipmentTaskIds(projectId: string, equipmentId: string) {
  const mappings = await db.select().from(edges).where(and(eq(edges.projectId, projectId), eq(edges.relationshipType, "AFFECTS"), or(
    and(eq(edges.fromType, "asset"), eq(edges.fromId, equipmentId), eq(edges.toType, "schedule_task")),
    and(eq(edges.toType, "asset"), eq(edges.toId, equipmentId), eq(edges.fromType, "schedule_task"))
  )));
  return [...new Set(mappings.map((edge) => edge.fromType === "schedule_task" ? edge.fromId : edge.toId))];
}

export async function currentMappedTaskIds(projectId: string, equipmentId: string) {
  const mapped = await equipmentTaskIds(projectId, equipmentId); if (!mapped.length) return [];
  const latest = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, projectId), orderBy: [desc(scheduleVersions.versionNumber)] }); if (!latest) return [];
  const rows = await db.select({ taskId: scheduleAssignments.taskId }).from(scheduleAssignments).where(and(eq(scheduleAssignments.versionId, latest.id), inArray(scheduleAssignments.taskId, mapped)));
  return rows.map((row) => row.taskId);
}
