# Implementation Plan — Index

Tracer-bullet backend build for the Pramana Cx hackathon, executed by **two backend developers in parallel on separate branches**, integrating with a separately-built Next.js frontend (colleague). The full plan is split into two self-sufficient per-developer files:

| File | Owner | Contents |
|---|---|---|
| [`ImplementationPlan_Dev1.md`](./ImplementationPlan_Dev1.md) | **Dev 1** | Shared **Phase 0** foundation (B0-01…B0-06), all Dev 1 tasks (B1-xx), and the full **integration-checkpoint** definitions (IC-1…IC-4, joint with Dev 2) |
| [`ImplementationPlan_Dev2.md`](./ImplementationPlan_Dev2.md) | **Dev 2** | All Dev 2 tasks (B2-xx) + a reference list of the integration checkpoints (full definitions live in Dev 1's file). **Prerequisite: Phase 0 in Dev 1's file must be complete/frozen first.** |

## Stack (user override — supersedes TRD's Node core)

Entire backend is **Python + FastAPI**. SQLAlchemy 2.x + Alembic on local Postgres · pgvector + tsvector · MinIO/filesystem object store · **ARQ on local Redis** for jobs · FastAPI-native auth (JWT cookies + project-scoped RBAC + TOTP for approver actions). Core keeps the `ModelProvider`/`GeminiModelProvider` adapter; the two Python agent-services (Commissioning QA, Supply Chain) + the CP-SAT solver stay as separate services beside the core. Frontend (Next.js, colleague) consumes the FastAPI API.

## Two-dev seam

- **Dev 1** (`feat/dev1-*`) — evidence control plane + Spec-Compliance agent + RFI/Knowledge agent + the `TEST_FAILED` consumer (findings / gate-BLOCKED half). 14 tasks.
- **Dev 2** (`feat/dev2-*`) — schedule module + CP-SAT solver service + both agent-services (Cx QA, Supply Chain) + Predictive Risk poll worker + Command Center alerts. 15 tasks.
- **Shared:** 6 Phase-0 foundation tasks + 4 integration checkpoints. Disjoint module ownership (see each file's ownership map); Alembic migrations additive-only, one owner per table, dev-prefixed filenames. Exactly **3 cross-track dependencies**, all mediated by the Phase-0-frozen `event_contract.py` (4-event contract: `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, `predicted_risk_delay`).

## Workflow

Each dev pushes to their own branch → rebase onto shared `integration` at each phase boundary (IC-1…IC-4: merge both tracks, run contract tests, smoke the tracer paths) → frontend integration checkpoint (IC-3) → final checks → merge `integration → main` (IC-4).
