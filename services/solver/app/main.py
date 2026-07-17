from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator
from ortools.sat.python import cp_model

app = FastAPI(title="Pramana deterministic schedule solver", version="0.1.0")


class Task(BaseModel):
    id: str
    duration_hours: int = Field(ge=1, le=100_000)
    earliest_offset: int = Field(default=0, ge=0)
    deadline_offset: int | None = Field(default=None, ge=0)
    fixed_offset: int | None = Field(default=None, ge=0)


class Dependency(BaseModel):
    predecessor_id: str
    successor_id: str


class Resource(BaseModel):
    id: str
    capacity: int = Field(ge=1, le=100_000)


class Demand(BaseModel):
    task_id: str
    resource_id: str
    demand: int = Field(ge=1, le=100_000)


class Hint(BaseModel):
    task_id: str
    start_offset: int = Field(ge=0)


class SolveRequest(BaseModel):
    tasks: list[Task] = Field(min_length=1, max_length=5000)
    dependencies: list[Dependency] = Field(default_factory=list, max_length=20_000)
    resources: list[Resource] = Field(default_factory=list, max_length=2000)
    demands: list[Demand] = Field(default_factory=list, max_length=20_000)
    hints: list[Hint] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def validate_references(self):
        task_ids = {task.id for task in self.tasks}
        resource_ids = {resource.id for resource in self.resources}
        if len(task_ids) != len(self.tasks):
            raise ValueError("Task IDs must be unique")
        for dependency in self.dependencies:
            if dependency.predecessor_id not in task_ids or dependency.successor_id not in task_ids:
                raise ValueError("Dependency references an unknown task")
            if dependency.predecessor_id == dependency.successor_id:
                raise ValueError("A task cannot depend on itself")
        for demand in self.demands:
            if demand.task_id not in task_ids or demand.resource_id not in resource_ids:
                raise ValueError("Demand references an unknown task or resource")
        for hint in self.hints:
            if hint.task_id not in task_ids:
                raise ValueError("Hint references an unknown task")
        return self


@app.get("/health")
def health():
    return {"status": "ok", "service": "solver", "engine": "ortools-cp-sat"}


@app.post("/solve")
def solve(request: SolveRequest):
    total_duration = sum(task.duration_hours for task in request.tasks)
    horizon = max(
        total_duration + max((task.earliest_offset for task in request.tasks), default=0),
        total_duration + max((task.fixed_offset or 0 for task in request.tasks), default=0),
        max((task.deadline_offset or 0 for task in request.tasks), default=0),
        1,
    )
    model = cp_model.CpModel()
    starts, ends, intervals = {}, {}, {}
    tardiness = {}
    for task in request.tasks:
        starts[task.id] = model.new_int_var(0, horizon, f"start_{task.id}")
        ends[task.id] = model.new_int_var(0, horizon, f"end_{task.id}")
        intervals[task.id] = model.new_interval_var(starts[task.id], task.duration_hours, ends[task.id], f"interval_{task.id}")
        model.add(starts[task.id] >= task.earliest_offset)
        if task.deadline_offset is not None:
            tardiness[task.id] = model.new_int_var(0, horizon, f"tardiness_{task.id}")
            model.add(tardiness[task.id] >= ends[task.id] - task.deadline_offset)
        if task.fixed_offset is not None:
            model.add(starts[task.id] == task.fixed_offset)
    for dependency in request.dependencies:
        model.add(starts[dependency.successor_id] >= ends[dependency.predecessor_id])
    for resource in request.resources:
        resource_demands = [demand for demand in request.demands if demand.resource_id == resource.id]
        if resource_demands:
            model.add_cumulative([intervals[item.task_id] for item in resource_demands], [item.demand for item in resource_demands], resource.capacity)
    for hint in request.hints:
        model.add_hint(starts[hint.task_id], hint.start_offset)
    makespan = model.new_int_var(0, horizon, "makespan")
    model.add_max_equality(makespan, list(ends.values()))
    # Deadline overruns are softened so the caller receives the minimum-overrun
    # complete schedule instead of a silent empty result. Fixed-date, precedence,
    # and capacity contradictions remain genuinely infeasible.
    model.minimize(sum(tardiness.values()) * (horizon + 1) + makespan)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    status_name = solver.status_name(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": status_name, "assignments": [], "objective_hours": None, "critical_task_ids": [], "bottlenecks": ["Fixed-date, dependency, or resource-capacity constraints are mutually infeasible."], "overrun_hours": 0, "deadline_breaches": []}
    objective = solver.value(makespan)
    assignments = [{"task_id": task.id, "start_offset": solver.value(starts[task.id]), "end_offset": solver.value(ends[task.id])} for task in request.tasks]
    terminal = {dependency.predecessor_id for dependency in request.dependencies}
    critical = [item["task_id"] for item in assignments if item["end_offset"] == objective and item["task_id"] not in terminal]
    deadline_breaches = [
        {"task_id": task.id, "deadline_offset": task.deadline_offset, "end_offset": solver.value(ends[task.id]), "overrun_hours": solver.value(tardiness[task.id])}
        for task in request.tasks
        if task.deadline_offset is not None and solver.value(tardiness[task.id]) > 0
    ]
    overrun_hours = max((item["overrun_hours"] for item in deadline_breaches), default=0)
    bottlenecks = [f"{len(deadline_breaches)} deadline constraint(s) require a minimum overrun of {overrun_hours} hour(s)."] if deadline_breaches else []
    return {"status": status_name, "assignments": assignments, "objective_hours": objective, "critical_task_ids": critical, "bottlenecks": bottlenecks, "overrun_hours": overrun_hours, "deadline_breaches": deadline_breaches}
