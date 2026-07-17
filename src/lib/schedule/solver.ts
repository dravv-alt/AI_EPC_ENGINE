import { env } from "@/lib/env";
export interface SolverInput { tasks: Array<{ id: string; duration_hours: number; earliest_offset: number; deadline_offset: number | null; fixed_offset: number | null }>; dependencies: Array<{ predecessor_id: string; successor_id: string }>; resources: Array<{ id: string; capacity: number }>; demands: Array<{ task_id: string; resource_id: string; demand: number }>; hints?: Array<{ task_id: string; start_offset: number }> }
export interface SolverOutput { status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "MODEL_INVALID" | "UNKNOWN"; assignments: Array<{ task_id: string; start_offset: number; end_offset: number }>; objective_hours: number | null; critical_task_ids: string[]; bottlenecks: string[]; overrun_hours: number; deadline_breaches: Array<{ task_id: string; deadline_offset: number; end_offset: number; overrun_hours: number }> }
export async function solveSchedule(input: SolverInput): Promise<SolverOutput> { const response = await fetch(`${env.SOLVER_SERVICE_URL}/solve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); if (!response.ok) throw new Error(`CP-SAT service rejected the model with HTTP ${response.status}: ${await response.text()}`); return response.json() as Promise<SolverOutput>; }

export class ScheduleCycleError extends Error {
  constructor(readonly offendingEdge: { predecessorTaskId: string; successorTaskId: string }) {
    super(`Schedule dependencies contain a cycle at ${offendingEdge.predecessorTaskId} → ${offendingEdge.successorTaskId}.`);
  }
}

export function assertAcyclic(taskIds: string[], dependencies: Array<{ predecessorTaskId: string; successorTaskId: string }>) {
  const taskSet = new Set(taskIds);
  const outgoing = new Map(taskIds.map((id) => [id, [] as Array<{ predecessorTaskId: string; successorTaskId: string }>]));
  dependencies.filter((edge) => taskSet.has(edge.predecessorTaskId) && taskSet.has(edge.successorTaskId)).forEach((edge) => outgoing.get(edge.predecessorTaskId)!.push(edge));
  const state = new Map<string, "visiting" | "visited">();
  function visit(id: string) {
    state.set(id, "visiting");
    for (const edge of outgoing.get(id) ?? []) {
      if (state.get(edge.successorTaskId) === "visiting") throw new ScheduleCycleError(edge);
      if (!state.has(edge.successorTaskId)) visit(edge.successorTaskId);
    }
    state.set(id, "visited");
  }
  for (const id of taskIds) if (!state.has(id)) visit(id);
}
