import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { scheduleAssignments, scheduleDependencies, scheduleEvents, scheduleResources, scheduleTaskResources, scheduleTasks, scheduleVersions } from "@/lib/db/schema";
import { getModelProvider } from "@/lib/model/provider";
import { assertAcyclic, solveSchedule, type SolverInput } from "@/lib/schedule/solver";

const explanationSchema = z.object({ explanation: z.string().min(10).max(2000) });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function activeShipmentAvailability(events: Array<typeof scheduleEvents.$inferSelect>) {
  const latestByShipment = new Map<string, { recovered: boolean; availableAt?: string; affectedTaskIds: string[] }>();
  for (const event of events.filter((item) => ["SHIPMENT_DELAYED", "SHIPMENT_RECOVERED"].includes(item.eventType)).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    const payload = event.payload as { shipmentId?: string; availableAt?: string; affectedTaskIds?: string[] };
    if (!payload.shipmentId) continue;
    latestByShipment.set(payload.shipmentId, { recovered: event.eventType === "SHIPMENT_RECOVERED", availableAt: payload.availableAt, affectedTaskIds: payload.affectedTaskIds ?? [] });
  }
  const byTask = new Map<string, Date>();
  for (const state of latestByShipment.values()) {
    if (state.recovered || !state.availableAt) continue;
    const availableAt = new Date(state.availableAt);
    if (Number.isNaN(availableAt.getTime())) continue;
    for (const taskId of state.affectedTaskIds) if (!byTask.has(taskId) || byTask.get(taskId)! < availableAt) byTask.set(taskId, availableAt);
  }
  return byTask;
}

export async function createScheduleVersion(input: { projectId: string; actorId: string; horizonStart: Date; reason: string; triggerEventId?: string }) {
  const deterministic = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`schedule:${input.projectId}`}))`);
    const tasks = await tx.select().from(scheduleTasks).where(and(eq(scheduleTasks.projectId, input.projectId), eq(scheduleTasks.reviewState, "accepted")));
    if (!tasks.length) throw new Error("At least one accepted task is required.");
    const taskIds = tasks.map((item) => item.id);
    const [allDependencies, resources, demands, parent, eventRows] = await Promise.all([
      tx.select().from(scheduleDependencies).where(eq(scheduleDependencies.projectId, input.projectId)),
      tx.select().from(scheduleResources).where(and(eq(scheduleResources.projectId, input.projectId), eq(scheduleResources.reviewState, "accepted"))),
      tx.select().from(scheduleTaskResources).where(inArray(scheduleTaskResources.taskId, taskIds)),
      tx.select().from(scheduleVersions).where(eq(scheduleVersions.projectId, input.projectId)).orderBy(desc(scheduleVersions.versionNumber)).limit(1).then((rows) => rows[0]),
      tx.select().from(scheduleEvents).where(eq(scheduleEvents.projectId, input.projectId)).orderBy(asc(scheduleEvents.occurredAt))
    ]);
    const dependencies = allDependencies.filter((item) => taskIds.includes(item.predecessorTaskId) && taskIds.includes(item.successorTaskId));
    assertAcyclic(taskIds, dependencies);
    const acceptedResourceIds = new Set(resources.map((item) => item.id));
    if (demands.some((item) => !acceptedResourceIds.has(item.resourceId))) throw new Error("Every demanded resource must be accepted before solving.");
    const previousAssignments = parent ? await tx.select().from(scheduleAssignments).where(eq(scheduleAssignments.versionId, parent.id)) : [];
    const availability = activeShipmentAvailability(eventRows);
    const offset = (date: Date | null | undefined, mode: "ceil" | "floor") => date ? Math.max(0, Math[mode]((date.getTime() - input.horizonStart.getTime()) / 3_600_000)) : null;
    const constraints = {
      tasks: tasks.map((task) => ({
        id: task.id,
        duration_hours: task.durationHours,
        earliest_offset: Math.max(offset(task.earliestStart, "ceil") ?? 0, offset(availability.get(task.id), "ceil") ?? 0),
        deadline_offset: offset(task.deadline, "floor"),
        fixed_offset: offset(task.fixedStart, "ceil")
      })),
      dependencies: dependencies.map((item) => ({ predecessor_id: item.predecessorTaskId, successor_id: item.successorTaskId })),
      resources: resources.map((item) => ({ id: item.id, capacity: item.capacity })),
      demands: demands.map((item) => ({ task_id: item.taskId, resource_id: item.resourceId, demand: item.demand }))
    };
    const solverInput: SolverInput = {
      ...constraints,
      hints: previousAssignments.filter((item) => taskIds.includes(item.taskId)).map((item) => ({ task_id: item.taskId, start_offset: Math.max(0, Math.round((item.startAt.getTime() - input.horizonStart.getTime()) / 3_600_000)) }))
    };
    const inputHash = hash(constraints);
    const solved = await solveSchedule(solverInput);
    const [version] = await tx.insert(scheduleVersions).values({
      projectId: input.projectId,
      parentVersionId: parent?.id ?? null,
      triggerEventId: input.triggerEventId ?? null,
      versionNumber: (parent?.versionNumber ?? 0) + 1,
      reason: input.reason,
      solverStatus: solved.status,
      solverVersion: "ortools-cp-sat-v1",
      inputHash,
      objectiveHours: solved.objective_hours,
      criticalTaskIds: solved.critical_task_ids,
      bottlenecks: solved.bottlenecks,
      overrunHours: solved.overrun_hours,
      createdBy: input.actorId
    }).returning();
    if (solved.assignments.length) await tx.insert(scheduleAssignments).values(solved.assignments.map((item) => ({ versionId: version.id, taskId: item.task_id, startAt: new Date(input.horizonStart.getTime() + item.start_offset * 3_600_000), endAt: new Date(input.horizonStart.getTime() + item.end_offset * 3_600_000), isCritical: solved.critical_task_ids.includes(item.task_id) })));
    return { tasks, version, solved, inputHash, warmStartHintCount: solverInput.hints?.length ?? 0, activeShipmentConstraintCount: availability.size };
  });

  await writeAuditEvent({ projectId: input.projectId, actorId: input.actorId, action: "schedule.version_saved", entityType: "schedule_version", entityId: deterministic.version.id, after: { versionNumber: deterministic.version.versionNumber, solverStatus: deterministic.solved.status, inputHash: deterministic.inputHash, objectiveHours: deterministic.solved.objective_hours, overrunHours: deterministic.solved.overrun_hours, warmStartHints: deterministic.warmStartHintCount, activeShipmentConstraints: deterministic.activeShipmentConstraintCount } });
  const taskNames = new Map(deterministic.tasks.map((task) => [task.id, task.name]));
  const mock = { explanation: deterministic.solved.status === "INFEASIBLE" ? `Version ${deterministic.version.versionNumber} is infeasible: ${deterministic.solved.bottlenecks.join(" ")}` : `Version ${deterministic.version.versionNumber} schedules ${deterministic.tasks.length} accepted task${deterministic.tasks.length === 1 ? "" : "s"} over ${deterministic.solved.objective_hours} hours${deterministic.solved.overrun_hours ? ` with a minimum deadline overrun of ${deterministic.solved.overrun_hours} hours` : " with no deadline overrun"}. Critical completion is driven by ${deterministic.solved.critical_task_ids.map((id) => taskNames.get(id) ?? id).join(", ") || "the solved terminal path"}.` };
  try {
    const generated = await getModelProvider().generateStructured({ system: "Explain a saved deterministic schedule without changing dates or claiming authority.", prompt: JSON.stringify({ version: deterministic.version.versionNumber, reason: input.reason, solver: deterministic.solved }), schema: explanationSchema, mock });
    const explanationGeneratedAt = new Date();
    await db.update(scheduleVersions).set({ explanation: generated.data.explanation, explanationModelVersion: generated.model, explanationGeneratedAt, updatedAt: explanationGeneratedAt }).where(eq(scheduleVersions.id, deterministic.version.id));
    return { version: { ...deterministic.version, explanation: generated.data.explanation, explanationModelVersion: generated.model, explanationGeneratedAt }, solver: deterministic.solved, explanationProvider: generated.provider, warmStartHintCount: deterministic.warmStartHintCount };
  } catch (error) {
    return { version: deterministic.version, solver: deterministic.solved, explanationError: error instanceof Error ? error.message : "Explanation generation failed.", warmStartHintCount: deterministic.warmStartHintCount };
  }
}
