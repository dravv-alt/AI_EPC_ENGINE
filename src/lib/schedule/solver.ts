import { env } from "@/lib/env";
export interface SolverInput { tasks: Array<{ id: string; duration_hours: number; earliest_offset: number; deadline_offset: number | null; fixed_offset: number | null }>; dependencies: Array<{ predecessor_id: string; successor_id: string }>; resources: Array<{ id: string; capacity: number }>; demands: Array<{ task_id: string; resource_id: string; demand: number }>; hints?: Array<{ task_id: string; start_offset: number }> }
export interface SolverOutput { status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "MODEL_INVALID" | "UNKNOWN"; assignments: Array<{ task_id: string; start_offset: number; end_offset: number }>; objective_hours: number | null; critical_task_ids: string[]; bottlenecks: string[] }
export async function solveSchedule(input: SolverInput): Promise<SolverOutput> { const response = await fetch(`${env.SOLVER_SERVICE_URL}/solve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); if (!response.ok) throw new Error(`CP-SAT service rejected the model with HTTP ${response.status}: ${await response.text()}`); return response.json() as Promise<SolverOutput>; }

export function assertAcyclic(taskIds: string[], dependencies: Array<{ predecessorTaskId: string; successorTaskId: string }>) {
  const incoming = new Map(taskIds.map((id) => [id, 0])); const outgoing = new Map(taskIds.map((id) => [id, [] as string[]]));
  dependencies.forEach((edge) => { incoming.set(edge.successorTaskId, (incoming.get(edge.successorTaskId) ?? 0) + 1); outgoing.get(edge.predecessorTaskId)?.push(edge.successorTaskId); });
  const queue = taskIds.filter((id) => incoming.get(id) === 0); let visited = 0;
  while (queue.length) { const id = queue.shift()!; visited += 1; for (const successor of outgoing.get(id) ?? []) { const next = (incoming.get(successor) ?? 1) - 1; incoming.set(successor, next); if (next === 0) queue.push(successor); } }
  if (visited !== taskIds.length) throw new Error("Schedule dependencies contain a cycle. Resolve the cycle before solving.");
}
