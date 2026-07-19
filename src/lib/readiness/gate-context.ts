import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { decisions, edges, gates, scheduleAssignments, scheduleTasks, scheduleVersions, systems, users } from "@/lib/db/schema";
import { getGateReadinessDetail } from "@/lib/readiness/project-readiness";

export async function getGateReviewContext(projectId: string, gateId: string) {
  const gateRows = await db.select({ gate: gates, systemName: systems.name }).from(gates).innerJoin(systems, eq(gates.systemId, systems.id)).where(and(eq(gates.id, gateId), eq(gates.projectId, projectId))).limit(1);
  if (!gateRows[0]) return null;
  const [readiness, decisionRows, graphEdges, latestVersion] = await Promise.all([
    getGateReadinessDetail(projectId, gateId),
    db.select({ id: decisions.id, decision: decisions.decision, reason: decisions.reason, evidenceBaselineHash: decisions.evidenceBaselineHash, decidedAt: decisions.decidedAt, actorName: users.displayName }).from(decisions).innerJoin(users, eq(decisions.decidedBy, users.id)).where(and(eq(decisions.projectId, projectId), eq(decisions.gateId, gateId))).orderBy(desc(decisions.decidedAt)),
    db.select().from(edges).where(and(eq(edges.projectId, projectId), or(and(eq(edges.fromType, "schedule_task"), eq(edges.toType, "gate"), eq(edges.toId, gateId)), and(eq(edges.fromType, "gate"), eq(edges.fromId, gateId), eq(edges.toType, "schedule_task"))))),
    db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, projectId), orderBy: [desc(scheduleVersions.versionNumber)] })
  ]);
  const taskIds = [...new Set(graphEdges.map((edge) => edge.fromType === "schedule_task" ? edge.fromId : edge.toId))];
  const [taskRows, assignmentRows] = taskIds.length ? await Promise.all([
    db.select().from(scheduleTasks).where(and(eq(scheduleTasks.projectId, projectId), inArray(scheduleTasks.id, taskIds))),
    latestVersion ? db.select().from(scheduleAssignments).where(and(eq(scheduleAssignments.versionId, latestVersion.id), inArray(scheduleAssignments.taskId, taskIds))) : Promise.resolve([])
  ]) : [[], []];
  const assignmentByTask = new Map(assignmentRows.map((assignment) => [assignment.taskId, assignment]));
  const taskById = new Map(taskRows.map((task) => [task.id, task]));
  // Read-only schedule context: tasks with an AFFECTS edge to this gate surface so
  // a reviewer sees schedule impact when deciding the gate. No mutation affordance.
  const affectingTasks = graphEdges
    .filter((edge) => edge.relationshipType === "AFFECTS")
    .map((edge) => (edge.fromType === "schedule_task" ? edge.fromId : edge.toId))
    .filter((taskId, index, ids) => ids.indexOf(taskId) === index)
    .map((taskId) => taskById.get(taskId))
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .map((task) => ({ id: task.id, name: task.name, reviewState: task.reviewState, relationshipType: "AFFECTS" as const }));
  return { ...gateRows[0], readiness, decisions: decisionRows, affectingTasks, schedule: { version: latestVersion, tasks: taskRows.map((task) => ({ ...task, assignment: assignmentByTask.get(task.id) ?? null })) } };
}
