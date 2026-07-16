# Implementation Plan — Dev 2 (Schedule/Event Side + Agents + Command Center)

Dev 2's track of the Pramana Cx hackathon backend build. Python + FastAPI backend per the Stack Note in `ImplementationPlan_Dev1.md`.

> **Prerequisite:** the shared **Phase 0 (B0-01…B0-06)** in `ImplementationPlan_Dev1.md` must be **complete and frozen** before this track proceeds past its Phase 0 pairing duties. Phase 0 defines the frozen 4-event contract (`backend/app/core/event_contract.py`, B0-06), the full Schema.md migration (B0-02), shared `core/` (auth, audit, storage, jobs, `ModelProvider` — Dev 2 authors B0-05), and the branch & integration workflow. Consult that file for those definitions — they are not duplicated here.

---

## Dev 2 Module Ownership (no-collision rule)

**Dev 2 — schedule/event side + agents + Command Center** (branch `feat/dev2-*`):

```
backend/app/routers/      schedule (documents/tasks/resources/baseline/events/
                          versions/current), risks, live_events, alerts, cx_proxy,
                          shipments_proxy
backend/app/services/     scheduling (incl. solver_client, delta_detector, explainer),
                          predictive_risk, alerts
backend/app/repositories/ schedule_tasks, resources, schedule_versions,
                          scheduled_tasks, schedule_events, schedule_risks,
                          risk_signal_readings, shipments, alerts
backend/app/lib/          scheduling, predictive_risk
backend/app/workers/      schedule_tasks (extraction/solve/explain), risk_poll_tasks,
                          alert_tasks
services/solver/          CP-SAT microservice
services/cx-agent/        Commissioning QA Copilot (FastAPI, Chroma, direct Gemini SDK)
services/supply-chain-agent/  Supply Chain agent (FastAPI, AIS/Open-Meteo, turfpy)
```

Migration ownership (additive-only after Phase 0): Dev 2 owns `schedule_*`, `scheduled_tasks`, `resources`, `shipments`, `schedule_risks`, `risk_signal_readings`, `alerts`, `cx_*`; migration files named `p{phase}_{dev}_{desc}.py`; Alembic heads merged only at checkpoints.

**Branch workflow (summary — full rules in Dev 1's file):** `main` (protected) ← `integration` ← `feat/dev2-*`; rebase on `integration` at least daily; touch only files in your ownership map (shared files only in Phase 0 / at checkpoints). Cross-track calls are read-only / via Dev 1's service functions, never by editing Dev 1's files.

**Cross-track dependency flags relevant to Dev 2:**
- **B2-03 → B1-01:** consumes Dev 1's ingestion service functions (merged at IC-1) — read-only reuse, no file edits.
- **B2-09 → B1-09:** `proposed_fail` emits the pinned `TEST_FAILED` payload to Dev 1's `POST /internal/events/test-failed` consumer — contract frozen since B0-06, both halves testable independently.
- **B2-14 ← B1-09:** Dev 2 exposes the alert-write function whose signature was pinned in B0-06; Dev 1's B1-09 consumes it (integration proven at IC-3). Also **B2-10 → Dev 1's evidence service** (read-only reuse).

---

# Phase 1 — Tracer Bullet (Dev 2 track)

## B2-01: CP-SAT solver microservice

- **Owner:** Dev 2
- **Description:** Containerized FastAPI + `ortools` service. Stateless `POST /solve`: task DAG (ids, durations, `PRECEDES` deps, resource demands/capacities, hard/soft deadlines, fixed completed tasks for warm start), objective = deadline-overrun-first / idle-time-second (fixed in code, ADR-011). Returns feasible schedule (per-task start/end, critical path) **or** explicit `{status:"infeasible", overrun_days, bottleneck_constraint}` — never a silent failure.
- **Acceptance criteria:**
  - Golden tests: feasible toy DAG; resource-capped DAG; infeasible-deadline DAG returns minimum overrun + bottleneck; warm-start holds fixed tasks. Container is stateless (no DB/store access) and internal-network only.
- **Endpoint contract (internal):** `POST /solve {tasks[], edges[], resources[], deadlines[], fixed[]}` → `200 {status: feasible|infeasible, scheduled[], critical_path[], overrun_days?, bottleneck_constraint?, solver_version}`; explicit 90s-default request timeout on the caller side.
- **Touches:** `services/solver/*`, `services/solver/Dockerfile`
- **Depends on:** B0-01

## B2-02: Schedule tracer — accepted tasks → baseline solve → immutable v1 → read

- **Owner:** Dev 2
- **Description:** Seed accepted `schedule_tasks` + `PRECEDES` edges + `resources` (script), then: `POST baseline` → ARQ job → `services/scheduling/solver_client.py` (single call-site, timeout + bounded retry) → persist immutable `schedule_versions` v1 + `scheduled_tasks` snapshot + audit event → `GET current`. Cycle in seed DAG blocks solve with the offending edge (`409`). Proves queue + solver + immutability discipline end-to-end.
- **Acceptance criteria:**
  - v1 written once, never updated; re-running the job with the same idempotency key creates no second version; solver timeout → `SOLVE_FAILED` job state, nothing persisted; cycle → `409` naming the edge.
- **Endpoint contract:**
  - `POST /v1/projects/{id}/schedule/baseline {}` → `202 {solve_job_id}`; `409` on DAG cycle (offending edge identified).
  - `GET /v1/projects/{id}/schedule/current` → `200 {version_id, tasks[], critical_path[], status, overrun_days?, bottleneck?, generated_at}`.
- **Touches:** `routers/schedule.py` (baseline/current), `services/scheduling/` (`solver_client.py`, persistence), `lib/scheduling/` (DAG assembly, cycle check skeleton), `workers/schedule_tasks.py`, schedule repositories
- **Depends on:** B0-05, B2-01

*→ IC-1 (joint checkpoint) ends this phase — see checkpoint reference list at the bottom; full definition in `ImplementationPlan_Dev1.md`.*

---

# Phase 2 — Core Depth (Dev 2 track: schedule module)

## B2-03: Schedule document ingestion + Gemini task/resource extraction

- **Owner:** Dev 2
- **Description:** Upload vendor contracts/timelines/POs/approvals through the shared hash/version/`source_regions` path (reusing Dev 1's Phase-0/1 ingestion service functions read-only); ARQ job via `GeminiModelProvider` proposes schema-validated `schedule_tasks` + `resources` with confidence, mandatory citations, `needs_review` on any ambiguous/missing field. **Flagged cross-track dependency:** consumes B1-01's ingestion service (already merged at IC-1) — read-only reuse, no file edits.
- **Acceptance criteria:** schema-invalid extraction rejected pre-write; zero silent defaults; dependency proposals land as `PRECEDES` `edges` between `schedule_task` rows, not in-row columns.
- **Endpoint contract:** `POST /v1/projects/{id}/schedule/documents` (multipart + `{document_type: contract|timeline|po|approval, revision}`) → `202 {job_id, document_version_id}`.
- **Touches:** `routers/schedule.py`, `workers/schedule_tasks.py` (extraction), `schedule_tasks`/`resources` repositories
- **Depends on:** B2-02, IC-1

## B2-04: Task & resource review queue APIs

- **Owner:** Dev 2
- **Description:** Accept/edit/reject with actor + timestamp; only `accepted` records solvable; `needs_review` blocks one-click accept.
- **Acceptance criteria:** review actions audit-evented; a `needs_review` record cannot be accepted without resolving flagged fields; only accepted tasks/resources enter DAG assembly.
- **Endpoint contract:** `GET /v1/projects/{id}/schedule/tasks?review_state=&vendor=&cursor=` → `200 {items, next_cursor}`; `POST /v1/schedule/tasks/{id}/review {action: accept|edit|reject, duration?, dependencies?, vendor?, lead_time?, resource_requirement?, deadline_type?, reason?}` → `200 {task}` (`409` conflict); resources analogous (`crew_count?`, `equipment_count?`).
- **Touches:** `routers/schedule.py`, `services/scheduling.py`
- **Depends on:** B2-03

## B2-05: Full baseline solve — DAG, cycle check, resources, deadlines, infeasibility

- **Owner:** Dev 2
- **Description:** Complete `lib/scheduling` (pure): DAG assembly from accepted tasks + `PRECEDES` edges, cycle detection naming the offending edge, solver request/response typing, critical-path helpers. Baseline uses real resource capacities + hard/soft deadlines; infeasibility persists `status='infeasible'` with `overrun_days` + `bottleneck_constraint` on the version — never hidden.
- **Acceptance criteria:** import-purity test on `lib/scheduling`; golden set: feasible, resource-capped, infeasible; version immutable and hash-linked; audit event per version.
- **Endpoint contract:** finalizes B2-02 endpoints; adds `GET /v1/projects/{id}/schedule/resources` list (shape as B2-04).
- **Touches:** `lib/scheduling/`, `services/scheduling.py`, `workers/schedule_tasks.py`
- **Depends on:** B2-04

## B2-06: Schedule events endpoint + delta detector + warm-started re-solve

- **Owner:** Dev 2
- **Description:** Implements the B0-06-pinned ingestion endpoint for all seven `event_type`s. Delta detector (pure predicate in `lib/scheduling`) always runs first: unaffected → update `scheduled_tasks.actual_status/actual_date` only, no version; affected → warm-start re-solve (completed tasks fixed) → new immutable version linked to predecessor + triggering event. Serialize concurrent events per task; reject events on tasks absent from the current version; `(schedule_version_id, event_id)` idempotency; exhausted retries → `solve_status='solve_failed'`, prior version untouched.
- **Acceptance criteria:** all Rules.md delta/solve patterns covered by tests (no unconditional re-solve, serialization, explicit rejection, SOLVE_FAILED leaves state untouched, no double-apply on retry).
- **Endpoint contract:** as pinned in B0-06; plus `GET /v1/projects/{id}/schedule/events?task_id=&cursor=` → `200 {items, next_cursor}` (Command Center + frontend read).
- **Touches:** `routers/schedule.py` (events), `services/scheduling/delta_detector.py`, `workers/schedule_tasks.py`
- **Depends on:** B2-05

## B2-07: Version history, diff, Gemini explainer

- **Owner:** Dev 2
- **Description:** Version list/get/diff (any two versions); explainer runs as a separate ARQ step after each re-solve via `GeminiModelProvider`, narrating triggering event / shifted tasks / net deadline impact into `schedule_versions.explanation_*`; explainer failure never blocks or reverts the persisted version; explanation labelled AI-generated.
- **Acceptance criteria:** every version > v1 gains an explanation (or an explicit pending/failed state retryable independently); diff returns shifted/added/removed + net impact; explainer writes no schedule date.
- **Endpoint contract:** `GET /v1/projects/{id}/schedule/versions` → `200 {items:[{version_id, created_at, trigger_event_id, status}], next_cursor}`; `GET /v1/schedule/versions/{id}` → `200 {version_id, tasks[], critical_path[], solver_version, status}`; `GET /v1/schedule/versions/{id}/diff?against=` → `200 {shifted_tasks[], added[], removed[], net_deadline_impact_days}`; `GET /v1/schedule/versions/{id}/explanation` → `200 {summary, triggering_event_id, model_version, generated_at}` (`409` while generating).
- **Touches:** `routers/schedule.py`, `workers/schedule_tasks.py` (explain step)
- **Depends on:** B2-06

*→ IC-2 (joint checkpoint) ends this phase.*

---

# Phase 3 — Agent Suite + Command Center (Dev 2 track: event-side)

## B2-08: Cx agent-service — standards ingestion + draft checklist + citation verification

- **Owner:** Dev 2
- **Description:** `services/cx-agent` (FastAPI; Chroma RAG; direct Gemini SDK per accepted override; NetworkX working graph — never authoritative). Core proxies `/v1/.../cx/*`. Synthetic standards/procedures ingest through the shared `documents`/`source_regions` path (clause metadata carried) + agent-local Chroma index; checklist generation → schema-validated draft persisted to `cx_checklists`/`cx_checklist_steps` (modality-typed) via the core; malformed draft rejected + routed to retry/review, never partially rendered; deterministic post-generation citation verification into `cx_clause_citations` (`flagged` = possible hallucination, never shown verified).
- **Acceptance criteria:** generation blocked until standards ingested; hallucinated clause ID → `flagged`; draft never authoritative until engineer acceptance; no Gemini SDK import leaks into `backend/app`.
- **Endpoint contract:** `POST /v1/projects/{id}/cx/standards` (multipart + `{standard_set, doc_type: standard|procedure, revision}`) → `202 {ingest_job_id, document_version_id}`; `POST /v1/projects/{id}/cx/checklists {system_id, gate_id, equipment_id, standard_set[]}` → `202 {checklist_job_id}` (`409` schema-invalid draft); `GET /v1/cx/checklists/{id}` → `200 {checklist_id, steps[], acceptance_criteria[], cited_clauses[], citation_verification[], status}`.
- **Touches:** `services/cx-agent/*`, `routers/cx_proxy.py`
- **Depends on:** IC-2

## B2-09: Cx step execution — deterministic acceptance + TEST_FAILED emission

- **Owner:** Dev 2
- **Description:** Per-step readings into `cx_test_records`/`cx_step_results` (who/when, resumable); numeric/boolean verdicts by pure deterministic comparison (`proposed_pass`/`proposed_fail`); narrative always `needs_human_review` (forced post-processing); `proposed_fail` emits the pinned `TEST_FAILED` payload to Dev 1's `POST /internal/events/test-failed` consumer (**flagged cross-track dependency** on B1-09 — contract frozen since B0-06, both halves testable independently against it).
- **Acceptance criteria:** zero LLM involvement in verdicts (test); narrative can never emit `TEST_FAILED`; interrupted execution resumes without loss; verdicts labelled "proposed" in responses.
- **Endpoint contract:** `POST /v1/cx/checklists/{id}/steps/{step_id}/reading {readings, entered_by, entered_at}` → `200 {step, verdict: proposed_pass|proposed_fail|needs_human_review}`.
- **Touches:** `services/cx-agent/acceptance.py`, `routers/cx_proxy.py`
- **Depends on:** B2-08, B0-06

## B2-10: Cx report draft/approve → evidence, PENDING_REVIEW, turnover linkage

- **Owner:** Dev 2
- **Description:** ReportLab draft labelled "DRAFT — PENDING ENGINEER REVIEW" stored immutable in MinIO (hash-referenced); approve endpoint materializes the `evidence` row (via Dev 1's evidence service functions, read-only reuse), links `PROVES`/`AFFECTS` edges, adds to turnover pack, sets gate to `in_review` (**PENDING_REVIEW — never `ready`**); export gated on approval.
- **Acceptance criteria:** export before approval → `409`; all-pass approval yields gate `in_review`, never `ready`; evidence row + report hash enter the B1-08 export manifest; audit-evented.
- **Endpoint contract:** `POST /v1/cx/checklists/{id}/report {}` → `202 {report_job_id}`; `GET /v1/cx/reports/{id}` → `200 {report_id, status: draft|approved, artifact_url, label}`; `POST /v1/cx/reports/{id}/approve {reason}` → `200 {report, evidence_id, gate_state}`.
- **Touches:** `services/cx-agent/report.py`, `routers/cx_proxy.py`
- **Depends on:** B2-09

## B2-11: Supply Chain agent-service — shipments, AIS/weather, deterministic ETA/status

- **Owner:** Dev 2
- **Description:** `services/supply-chain-agent` (FastAPI): shipment registration (durable `shipments` row via core; `TRACKS` asset + `AFFECTS` schedule-task edges); ~30s AIS poll (aisstream.io `websockets`) with turfpy great-circle fallback, positions labelled live/simulated; Open-Meteo weather with delay-factor→0 graceful degradation; deterministic additive delay-factor ETA + R/A/G vs required-on-site minus configurable buffer. All math threshold logic — no LLM anywhere in this service.
- **Acceptance criteria:** AIS outage → simulated-labelled positions, record survives reconnection; weather outage → ETA still returned as labelled estimate; ETA labelled estimate everywhere; port congestion manual boolean only.
- **Endpoint contract:** `POST /v1/projects/{id}/shipments {equipment_id, origin, destination, mmsi, planned_eta, required_on_site, port_congested?}` → `201 {shipment}`; `GET /v1/projects/{id}/shipments` → `200 {items:[{shipment_id, position, position_source: live|simulated, weather_adjusted_eta, status}], next_cursor}`; `GET /v1/shipments/{id}` → `200 {…, route[], weather[], last_notified_status}`.
- **Touches:** `services/supply-chain-agent/*`, `routers/shipments_proxy.py`, `shipments` repository
- **Depends on:** IC-2

## B2-12: Shipment delay/recovery emission — dedup + fan-out into the schedule pipeline

- **Owner:** Dev 2
- **Description:** On a genuine status **change** only (vs `shipments.last_notified_status`): emit `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` through `POST .../schedule/events` — one `schedule_events` row per affected task via `AFFECTS` edges; recovery may trigger a re-solve to pull dates back in; zero emits within an unchanged-status poll window.
- **Acceptance criteria:** golden dedup tests: exactly one delayed per transition, one recovered per return, zero duplicates across unchanged ~30s polls; N affected tasks → N rows, once.
- **Endpoint contract:** none new (producer into B2-06's endpoint).
- **Touches:** `services/supply-chain-agent/emitter.py`
- **Depends on:** B2-11, B2-06

## B2-13: Predictive Schedule Risk Engine — single periodic-poll worker

- **Owner:** Dev 2
- **Description:** **One** ARQ-cron poll worker (never a multi-agent system): reads latest `schedule_versions`/critical path; polls synthetic procurement/lead-time/workforce/weather-forecast feeds via swappable clients; per-poll observations (incl. explicit `data_available=false`) into `risk_signal_readings`; materiality-threshold + dedup logic in pure `lib/predictive_risk`; material risks upsert `schedule_risks` (unique `(project_id, schedule_task_id, risk_type)`), emit `predicted_risk_delay` (≥1 mitigation option, proposals only) through the schedule events endpoint only — never writes schedule tables or calls the solver client; self-resolved risks move to `resolved`.
- **Acceptance criteria:** repeated threshold crossings without material change → zero re-emits; missing feed → data-unavailable, never a fabricated risk; every emitted event carries tasks/delay/probability/signal/≥1 option; engine provably never mutates a date.
- **Endpoint contract:** `GET /v1/projects/{id}/schedule/risks?risk_type=&task_id=` → `200 {items:[{risk_id, task_ids[], risk_type, estimated_delay_days, probability, source_signal, mitigation_options[], schedule_event_id, flagged_at, state}], next_cursor}`; `GET /v1/projects/{id}/schedule/live-events` → `200 {items:[{signal_type, task_ids[], observed_at, value, data_available}], next_cursor}`.
- **Touches:** `services/predictive_risk/`, `lib/predictive_risk/`, `workers/risk_poll_tasks.py`, `routers/risks.py`, `routers/live_events.py`
- **Depends on:** B2-07, B0-06

## B2-14: Command Center — alerts with US-31 dedup/clear semantics

- **Owner:** Dev 2
- **Description:** Alert service + consumers for all four contract events, denormalizing into `alerts` (cross-links: `TEST_FAILED`→finding+blocked gate; `SHIPMENT_DELAYED`/`predicted_risk_delay`→tasks + resulting `schedule_version`); dedup on status change via `(project_id, dedup_key) WHERE status='active'`; `SHIPMENT_RECOVERED` clears the stale delay alert to history (`cleared_by_event_id`). Read/cross-link surface only — never mutates gates, findings, or dates. Exposes the alert-write function whose signature was pinned in B0-06 (consumed by Dev 1's B1-09).
- **Acceptance criteria:** golden US-31 suite: unchanged status across polls → zero new alerts; one transition → exactly one alert (grouped, not N-per-fan-out-row); recovery clears + retains history; endpoint is read-only.
- **Endpoint contract:** `GET /v1/projects/{id}/alerts?status=active|cleared&cursor=` → `200 {items:[{alert_id, alert_type, source_schedule_event_id?, source_finding_id?, impacted_gate_id?, impacted_schedule_task_id?, impacted_schedule_version_id?, status, created_at, cleared_at?}], next_cursor}`.
- **Touches:** `services/alerts.py`, `routers/alerts.py`, `workers/alert_tasks.py`, `alerts` repository
- **Depends on:** B2-12, B2-13 (consumes B1-09's producer path at IC-3)

*→ IC-3 (joint checkpoint + frontend integration) ends this phase.*

---

# Phase 4 — Hardening, Final Checks, Merge (Dev 2 track)

## B2-15: Event-side hardening + demo seed

- **Owner:** Dev 2
- **Description:** Same authz/rate-limit sweep for schedule/shipments/cx/risks/alerts routes; dedup golden set in CI (shipment transitions, risk re-emits, alert dedup/clear); solver/agent failure-mode tests (timeout → `SOLVE_FAILED`, AIS/weather/feed outages); synthetic demo dataset (schedule docs, shipments to Mumbai, risk feeds) + scripted event storyline for the demo.
- **Acceptance criteria:** 100% dedup correctness on golden set; zero silent solver failures; demo storyline runs unattended via script.
- **Touches:** `tests/authz/`, `tests/golden/`, `scripts/seed_demo_schedule.py`
- **Depends on:** IC-3

*→ IC-4 (joint checkpoint) ends this phase and merges `integration → main`.*

---

## Integration checkpoints — reference (full definitions in `ImplementationPlan_Dev1.md`)

| Checkpoint | Ends | Dev 2's stake |
|---|---|---|
| **IC-1** | Phase 1 | Merge `feat/dev2-*` → `integration`; B2-02 tracer smoke green; Alembic heads merged; OpenAPI exported. Depends on B1-01, B2-02. |
| **IC-2** | Phase 2 | Combined smoke incl. contract upload → baseline → weather_delay → re-solve → explanation; gate cross-link is read-only context. Depends on B1-08, B2-07. |
| **IC-3** | Phase 3 | Wire the three cross-track seams live (B1-09↔B2-09, B1-09↔B2-14, B2-10↔evidence service); frontend integration checkpoint; four demo scenarios. Depends on B1-13, B2-14, B1-09. |
| **IC-4** | Phase 4 | Full suite (pytest, contract tests, ruff, audit-chain verifier, golden dedup, purity-import tests); merge `integration → main`. Depends on B1-14, B2-15. |
