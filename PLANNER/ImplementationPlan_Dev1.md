# Implementation Plan — Dev 1 (Evidence Control Plane + Document-Side Agents)

Tracer-bullet build roadmap for the Pramana Cx hackathon backend, built by **two backend developers (Dev 1, Dev 2) in parallel on separate branches**, integrating with a separately-built Next.js frontend (colleague; out of scope here except for contract checkpoints). Every task is a vertical slice ending in runnable, observable behavior; entity names match `Schema.md` exactly; every approved invariant from PRD/TRD/Rules/DesignDecisions is preserved.

> **This file is canonical for:** the shared Phase 0 (B0-01…B0-06), all Dev 1 tasks (B1-xx), and the full integration-checkpoint definitions (IC-1…IC-4, joint with Dev 2). Dev 2's tasks live in `ImplementationPlan_Dev2.md`.

---

## Stack Note (user override — supersedes TRD's Node-core local stack)

The **entire backend is Python + FastAPI**. There is no Node.js API core. The TRD's local stack is reinterpreted as follows; everything not listed is unchanged:

| Layer | Decision |
|---|---|
| Core API | **FastAPI** — one app (`backend/app`) serving all `/v1/*` endpoints; the single authenticated front door |
| ORM / migrations | **SQLAlchemy 2.x + Alembic** on local Postgres (replaces Drizzle). Schema is exactly `Schema.md` |
| Vector / FTS | **pgvector** (`knowledge_chunks.embedding`) + Postgres **tsvector** — unchanged |
| Object store | Local **MinIO** (S3-compatible) / filesystem — unchanged |
| Jobs / queues | **ARQ on local Redis** (replaces BullMQ). *Justification: ARQ is async-native and runs in the same asyncio model as FastAPI with near-zero boilerplate, while still giving the TRD's required retryable/bounded-backoff/idempotent job semantics (job IDs as idempotency keys, `(schedule_version_id, event_id)` dedup) — Celery's process model and config surface buy nothing extra for a localhost hackathon.* |
| Auth | **FastAPI-native auth** (replaces Better Auth): JWT session cookies (HTTP-only), project-scoped RBAC from `project_members.role`, **TOTP required for approver actions**, fail-closed `403` |
| AI adapter rule | The core keeps the **`ModelProvider`** interface with a `GeminiModelProvider` adapter — no direct Gemini SDK calls anywhere in `backend/app` (Rules.md). The **two Python agent-services** (Commissioning QA, Supply Chain) keep their documented **direct-SDK exception** and their agent-local stores (Chroma, NetworkX) — never authoritative |
| Solver | **CP-SAT solver microservice** (Python/`ortools`, containerized, stateless, internal HTTP) — unchanged (ADR-009) |
| Agent-services | Cx QA Copilot and Supply Chain remain **separate FastAPI services** beside the core (same pattern as the solver); the core proxies `/v1/.../cx/*` and `/v1/.../shipments*` to them. The other three agents (Spec-Compliance, Predictive Risk single periodic-poll worker, RFI/Knowledge) run **inside the core app / its ARQ workers** |
| Frontend | Next.js (colleague) consumes the FastAPI API. **Every task exposing an endpoint states its contract** so the frontend can integrate without asking |

Naming: Python code uses `snake_case`; JSON payload properties keep the TRD's documented shapes; DB vocabulary matches `Schema.md` verbatim. The pure-module rule carries over: `app/lib/readiness`, `app/lib/scheduling`, `app/lib/compliance`, `app/lib/predictive_risk`, `app/lib/knowledge` have **zero model-provider, zero network, zero UI imports**.

All fixtures are **synthetic only** (synthetic standards excerpts, approved-equal precedent log, shipment records, schedule docs). Pilot placeholder: chilled water plant system, L4 IST gate.

---

## Dev 1 Module Ownership (no-collision rule)

**Dev 1 — evidence control plane + document-side agents** (branch `feat/dev1-*`):

```
backend/app/routers/      documents, requirements, systems_assets_gates, evidence,
                          findings, readiness, decisions, exports, edges,
                          compliance, knowledge, graph
backend/app/services/     ingestion, requirements, evidence, readiness, decisions,
                          exports, compliance_check, knowledge, test_failed_consumer
backend/app/repositories/ documents, source_regions, requirements, systems, assets,
                          gates, evidence, test_*, findings, edges, decisions,
                          compliance_checks, knowledge_chunks
backend/app/lib/          readiness, compliance, knowledge
backend/app/workers/      ingestion_tasks, extraction_tasks, compliance_tasks,
                          embedding_tasks, export_tasks
```

(Dev 2's ownership map — schedule/event side, agents, Command Center, `services/solver`, `services/cx-agent`, `services/supply-chain-agent`, branch `feat/dev2-*` — is in `ImplementationPlan_Dev2.md`.)

**Shared (Phase 0, then frozen or additive-only):**

- `backend/app/core/` (config, db session, security/auth, audit chain, storage client, `ModelProvider`) — authored in Phase 0; **frozen after Phase 0** except by agreement at an integration checkpoint.
- `backend/app/models/` + `alembic/` — **the entire Schema.md schema is migrated in Phase 0 (B0-02)**. After Phase 0, migrations are **additive-only**, one owner per table (Dev 1: evidence-side + `compliance_checks`/`knowledge_chunks`; Dev 2: `schedule_*`, `scheduled_tasks`, `resources`, `shipments`, `schedule_risks`, `risk_signal_readings`, `alerts`, `cx_*`), and each dev names migration files `p{phase}_{dev}_{desc}.py` to avoid Alembic head collisions (merge heads only at checkpoints).
- `backend/app/core/event_contract.py` — the **4-event contract** (Pydantic schemas + emit/dedup rules for `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, `predicted_risk_delay`) — **frozen after Phase 0 (B0-06)**; changes require both devs at a checkpoint.
- Cross-track calls are allowed **read-only / via the other dev's service functions**, never by editing the other track's files. The only cross-track *dependencies* are flagged explicitly on the tasks (there are 3).

**Cross-track dependency flags relevant to Dev 1:**
- **B1-09 → B2-14 (alert-service interface):** Dev 1 raises Command Center alerts via Dev 2's alert-service function; the alert-write signature is part of the frozen B0-06 contract, so Dev 1 codes against it before B2-14 lands (integration proven at IC-3).
- **B2-03 consumes B1-01's ingestion service** read-only (merged at IC-1) — Dev 1's ingestion service must be stable/merged by IC-1.
- **B2-10 consumes Dev 1's evidence service functions** read-only — wired live at IC-3.

---

## Branch & Integration Workflow

- Branches: `main` (protected) ← `integration` ← `feat/dev1-*`, `feat/dev2-*`. Frontend colleague works on `feat/frontend-*` against the OpenAPI spec exported from `integration`.
- Each dev commits to their own feature branches and **rebases on `integration` at least daily**; only files in your ownership map may be touched (shared files only in Phase 0 / at checkpoints).
- **Integration checkpoints (IC tasks below) end every phase:** both tracks merge to `integration`, Alembic heads are merged, the contract-test suite + tracer smoke run green, and the auto-generated OpenAPI schema (`GET /openapi.json`) is committed as the frontend's contract artifact.
- Frontend integration checkpoint at IC-3 (all endpoints live); final checks (pytest, contract tests, lint/ruff, audit-chain verifier, dedup golden tests) at IC-4 before merging `integration → main`.

---

# Phase 0 — Shared Foundation (Both devs, done first, then frozen)

## B0-01: Repo scaffold, Docker Compose, health check

- **Owner:** Both (pair, <½ day)
- **Description:** Monorepo layout per the ownership map. `docker-compose.yml` with Postgres 16 + pgvector, Redis, MinIO. FastAPI app boots; ARQ worker container boots. CI (GitHub Actions): ruff + pytest + contract-test job. Branch protection + `integration` branch created.
- **Acceptance criteria:**
  - `docker compose up` starts Postgres/Redis/MinIO/core-api/worker; `GET /health` → `200 {status:"ok", db:true, redis:true, object_store:true}`.
  - CI runs on every PR to `integration`.
- **Endpoint contract:** `GET /health` → `200 {status, db, redis, object_store}` (unauthenticated).
- **Touches:** `docker-compose.yml`, `backend/app/main.py`, `backend/app/core/config.py`, `.github/workflows/ci.yml`
- **Depends on:** none

## B0-02: Full schema migration from Schema.md

- **Owner:** Both (pair)
- **Description:** SQLAlchemy models + one ordered Alembic migration set covering **every** Schema.md table (`tenants` … `alerts`), all CHECK enums, unique constraints (incl. `alerts (project_id, dedup_key) WHERE status='active'`, `schedule_risks (project_id, schedule_task_id, risk_type)`), indexes incl. pgvector ivfflat, and `edges.relationship_type` vocabulary with `TRACKS`. Seed script: synthetic tenant, project, users per role, chilled-water-plant system, L4 IST gate.
- **Acceptance criteria:**
  - `alembic upgrade head` from scratch is clean; every table/column/constraint matches Schema.md verbatim; seed script populates the pilot fixture.
  - Documented rule in `alembic/README`: additive-only after Phase 0, one owner per table, naming convention.
- **Touches:** `backend/app/models/*`, `alembic/versions/p0_*`, `scripts/seed_synthetic.py`
- **Depends on:** B0-01

## B0-03: FastAPI-native auth — JWT sessions, project RBAC, TOTP

- **Owner:** Dev 1 (Dev 2 reviews)
- **Description:** Register/login issuing HTTP-only JWT session cookies; dependency-injected guards: `require_project_member(role…)` reading `project_members`; TOTP enrolment + step-up check dependency for approver actions; role changes write `audit_events`. Fail-closed `403` that doesn't reveal record existence.
- **Acceptance criteria:**
  - Non-member → `403`; reviewer calling an approver action → `403`; approver without TOTP-verified session → `403`; every role change appends a hash-chained audit event.
- **Endpoint contract:** `POST /v1/auth/register {email, display_name, password}` → `201 {user}`; `POST /v1/auth/login {email, password}` → `200` + session cookie; `POST /v1/auth/totp/enroll` → `200 {otpauth_url}`; `POST /v1/auth/totp/verify {code}` → `200`; `POST /v1/auth/logout` → `204`. Error body everywhere: `{code, message, request_id}`.
- **Touches:** `backend/app/core/security.py`, `backend/app/routers/auth.py`
- **Depends on:** B0-02

## B0-04: Audit chain, storage service, projects API

- **Owner:** Dev 1
- **Description:** `core/audit.py` — append-only hash-chained `audit_events` writer (`before_hash/after_hash/event_hash/previous_event_hash`) used by both tracks. `core/storage.py` — single MinIO call-site with project-scope + content-hash verification and short-lived signed URLs. Projects CRUD + membership.
- **Acceptance criteria:**
  - Audit-chain verifier utility replays a project's chain and detects tampering; objects only retrievable via scoped signed URLs.
- **Endpoint contract:** `POST /v1/projects {name, code, timezone, retention_days}` → `201 {project}` (`409` duplicate code); `GET /v1/projects/{id}` → `200 {project, role}`; `POST /v1/projects/{id}/members {user_id, role}` → `201 {member}`.
- **Touches:** `backend/app/core/audit.py`, `backend/app/core/storage.py`, `backend/app/routers/projects.py`
- **Depends on:** B0-03

## B0-05: ARQ job runner, idempotency helpers, ModelProvider + Gemini adapter

- **Owner:** Dev 2
- **Description:** ARQ worker settings, bounded backed-off retries, job-status persistence readable by `GET /v1/jobs/{id}`; idempotency-key helper (used later as `(schedule_version_id, event_id)`). `core/model_provider.py`: abstract `ModelProvider` (`extract_structured`, `explain`, `embed`, `suggest`) + `GeminiModelProvider` implementation + `MockModelProvider` for tests. **No Gemini SDK import outside the adapter.**
- **Acceptance criteria:**
  - A retried job with the same idempotency key executes side-effects once; `GET /v1/jobs/{id}` reflects `pending/running/succeeded/failed` with retry count; lint rule/test asserts no `google.genai` import outside `core/model_provider.py` and the two agent-services.
- **Endpoint contract:** `GET /v1/jobs/{id}` → `200 {job_id, status, error?, result_ref?}`.
- **Touches:** `backend/app/workers/runner.py`, `backend/app/core/jobs.py`, `backend/app/core/model_provider.py`
- **Depends on:** B0-02

## B0-06: Frozen 4-event contract + schedule-events ingestion shape + alert semantics

- **Owner:** Both (pair — this is the seam both tracks code against)
- **Description:** `core/event_contract.py`: Pydantic payloads and emit rules exactly per the TRD orchestrator contract — `TEST_FAILED` (edge-triggered on `proposed_fail`; consumed into `findings` + gate `blocked`, evidence-graph pipeline only), `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` (status-change-only dedup vs `shipments.last_notified_status`), `predicted_risk_delay` (task + risk-type dedup, material-change re-emit only, ≥1 mitigation option). Fan-out rule: N affected tasks → N `schedule_events` rows per genuine transition. Pin the ingestion endpoint request/response and the `alerts` dedup/clear semantics (one active alert per `dedup_key`; `SHIPMENT_RECOVERED` clears the stale delay alert to history). **File frozen after this task.**
- **Acceptance criteria:**
  - Contract-test module validates all four payload schemas and dedup-rule table; both devs sign off in PR; CI fails if the file changes without a `contract-change` label.
- **Endpoint contract (pinned now, implemented by Dev 2 in B2-06):** `POST /v1/projects/{id}/schedule/events {task_id, event_type: shipment_received|shipment_delayed|shipment_recovered|approval_granted|approval_rejected|weather_delay|predicted_risk_delay, occurred_at, details}` → `202 {event_id, delta_check_job_id}`; errors `400/401/403/404/409`.
- **Touches:** `backend/app/core/event_contract.py`, `tests/contract/test_event_contract.py`
- **Depends on:** B0-02

---

# Phase 1 — Tracer Bullet (Dev 1 track)

## B1-01: Evidence tracer — upload → extract → review → readiness read

- **Owner:** Dev 1
- **Description:** Thinnest full path: upload a synthetic spec PDF → SHA-256 + `documents`/`document_versions` + MinIO object → ARQ extraction job (via `ModelProvider`, `MockModelProvider` acceptable here) creates `source_regions` + one `requirements` proposal → reviewer accepts it → `GET readiness` computes a real (if minimal) deterministic state for the seeded L4 gate. Proves FastAPI + Postgres/Alembic + Redis/ARQ + MinIO + auth + audit wired end-to-end.
- **Acceptance criteria:**
  - One curl script walks the whole path authenticated; duplicate upload by hash does not create a duplicate authoritative record; unaccepted proposal never affects readiness; empty project reads `UNKNOWN`, never `READY`; each step audit-evented.
- **Endpoint contract:**
  - `POST /v1/projects/{id}/documents` (multipart + `{document_type, revision}`) → `202 {job_id, document_version_id}`; `400/401/403/413/415`.
  - `GET /v1/projects/{id}/requirements?review_state=&cursor=` → `200 {items, next_cursor}`.
  - `POST /v1/requirements/{id}/review {action: accept|edit|reject, normalized_value?, unit?, reason?}` → `200 {requirement}`; `409` on conflict.
  - `GET /v1/projects/{id}/gates/{gate_id}/readiness` → `200 {state: READY|BLOCKED|IN_REVIEW|UNKNOWN, blockers[], evaluated_at, rule_version}`.
- **Touches:** `routers/documents.py`, `routers/requirements.py`, `routers/readiness.py`, `services/ingestion.py`, `workers/extraction_tasks.py`, `lib/readiness/` (skeleton), repositories listed in ownership map
- **Depends on:** B0-03, B0-04, B0-05

## IC-1: Phase-1 integration checkpoint *(joint with Dev 2)*

- **Owner:** Both
- **Description:** Merge both tracks to `integration`; merge Alembic heads; run contract tests + both tracer smoke scripts; export and commit `openapi.json`; hand the frontend colleague the auth + tracer contracts.
- **Acceptance criteria:** `integration` green in CI; both tracers pass on the merged branch; OpenAPI artifact committed.
- **Depends on:** B1-01, B2-02

---

# Phase 2 — Core Depth (Dev 1 track: evidence plane)

## B1-02: Systems, assets, gates, edges

- **Owner:** Dev 1
- **Description:** CRUD + CSV import (synthetic asset register/milestone templates) for `systems`/`assets`/`gates`; typed `edges` API with relationship-type validation and same-project checks; gate prerequisites by `sequence_number`.
- **Acceptance criteria:** `(project_id, tag)` uniqueness enforced; invalid `relationship_type` rejected; edges power graph traversal used by readiness and later agents.
- **Endpoint contract:** `POST /v1/projects/{id}/systems|assets|gates` → `201`; `GET` lists with cursors; `POST /v1/projects/{id}/edges {from_type, from_id, to_type, to_id, type}` → `201 {edge}` (`409` duplicate); `GET /v1/projects/{id}/edges?from_type=&from_id=` → `200 {items, next_cursor}`.
- **Touches:** `routers/systems_assets_gates.py`, `routers/edges.py`, repositories, CSV import service
- **Depends on:** B1-01

## B1-03: Real requirement extraction + full review queue

- **Owner:** Dev 1
- **Description:** Replace tracer stub with `GeminiModelProvider` extraction: schema-validated proposals with modality, numeric value/unit/tolerance, confidence, mandatory `source_region_id`; ambiguous/missing fields → `needs_review`, never silently defaulted (Rules.md); FTS (tsvector) indexing of `source_regions`/`requirements` for citation lookup.
- **Acceptance criteria:** schema-invalid model output rejected before DB write; zero auto-acceptance regardless of confidence; every proposal carries a resolvable citation; search endpoint returns exact-term hits.
- **Endpoint contract:** (extends B1-01 endpoints) plus `GET /v1/projects/{id}/search?q=&type=` → `200 {items: [{entity_type, entity_id, source_region_id, snippet}], next_cursor}`.
- **Touches:** `workers/extraction_tasks.py`, `services/requirements.py`, FTS migration (additive, Dev 1-owned)
- **Depends on:** B1-01

## B1-04: Evidence, test procedures/runs, findings

- **Owner:** Dev 1
- **Description:** `evidence` capture (document-backed and field-captured) with `validity_state` lifecycle; human-authored `test_procedures`/`test_steps`/`test_runs`; `findings` (issues) with mandatory owner/status, due dates, severity; overdue-open findings surfaced per gate/system.
- **Acceptance criteria:** creating/updating a finding requires owner + status; failed `test_runs` and open blocking `findings` visible on the gate; all state changes audit-evented.
- **Endpoint contract:** `POST /v1/projects/{id}/evidence` → `201 {evidence}`; `GET /v1/projects/{id}/evidence?system_id=&validity_state=` → `200 {items, next_cursor}`; `POST /v1/projects/{id}/issues {title, severity, owner_id, due_at, system_id?, gate_id?}` → `201 {finding}`; `GET /v1/projects/{id}/issues?status=&severity=` → `200 {items, next_cursor}`; test procedure/run CRUD analogous.
- **Touches:** `routers/evidence.py`, `routers/findings.py`, `services/evidence.py`, repositories
- **Depends on:** B1-02

## B1-05: Full deterministic readiness engine

- **Owner:** Dev 1
- **Description:** Complete `lib/readiness` (pure module — zero model-provider/network imports): mandatory accepted requirements/evidence, predecessor-gate approval, open blocking findings, passed test runs, approval signature → `READY/BLOCKED/IN_REVIEW/UNKNOWN` with categorized blockers (missing/stale/failed/blocked/unapproved/accepted). Never reads schedule state. `READY` impossible with any mandatory blocker.
- **Acceptance criteria:** golden unit suite covering all four states + all six blocker categories; import-purity test on `lib/readiness`; conflicting revisions yield `UNKNOWN`/`BLOCKED`, never inferred completion.
- **Endpoint contract:** finalizes `GET .../readiness` response (B1-01 shape, blockers now categorized: `{category, entity_type, entity_id, owner_id?, source_region_id?}`).
- **Touches:** `lib/readiness/`, `services/readiness.py`
- **Depends on:** B1-03, B1-04

## B1-06: Change impact & stale-evidence propagation

- **Owner:** Dev 1
- **Description:** A superseding `document_version` marks affected `evidence` `stale` via `SUPERSEDES`/`AFFECTS` traversal; impacted requirements/tests/prior decisions listed; readiness recomputes accordingly.
- **Acceptance criteria:** uploading a superseding revision flips linked evidence to `stale` and surfaces the blast radius; audit events recorded.
- **Endpoint contract:** `GET /v1/projects/{id}/documents/{doc_id}/impact?version_id=` → `200 {affected_requirements[], affected_evidence[], affected_decisions[]}`.
- **Touches:** `services/ingestion.py` (revision compare job), `workers/ingestion_tasks.py`, edges traversal
- **Depends on:** B1-05

## B1-07: Authorized gate decisions

- **Owner:** Dev 1
- **Description:** Approve/reject/waive with mandatory reason, evidence-baseline hash, `rule_version`, approver role + TOTP step-up re-checked at decision time; gate `status` transition; only humans transition gates.
- **Acceptance criteria:** reviewer role → `403`; no TOTP → `403`; decision stores action/reason/actor/timestamp/evidence_baseline; audit-chained.
- **Endpoint contract:** `POST /v1/gates/{id}/decisions {action: approve|reject|waive, reason, evidence_baseline}` → `201 {decision}`; `GET /v1/gates/{id}/decisions` → `200 {items}`.
- **Touches:** `routers/decisions.py`, `services/decisions.py`
- **Depends on:** B1-05

## B1-08: Turnover evidence-pack export

- **Owner:** Dev 1
- **Description:** Async export job builds a hash-manifested pack (source identifiers, file hashes, decision history, rule/model versions, audit-event hashes; solver + Gemini model versions when a schedule snapshot is included) into MinIO; manifest hash changes whenever content changes; signed-URL download, `410` on expiry.
- **Acceptance criteria:** manifest verifies against pack contents; re-export with changed content changes manifest hash; approved Cx test records (Phase 3) slot in without schema change.
- **Endpoint contract:** `POST /v1/projects/{id}/exports {gate_id, format}` → `202 {export_job_id}`; `GET /v1/exports/{id}` → `200 {status, download_url, manifest_hash}`; `410` expired.
- **Touches:** `routers/exports.py`, `workers/export_tasks.py`
- **Depends on:** B1-07

## IC-2: Phase-2 integration checkpoint *(joint with Dev 2)*

- **Owner:** Both
- **Description:** Merge to `integration`; Alembic head merge; contract tests + tracer smokes + a combined smoke (upload spec → readiness; upload contract → baseline → weather_delay event → re-solve → explanation). Export OpenAPI for frontend. Confirm gate-view cross-link works: schedule task `AFFECTS` gate renders as read-only context, never feeds readiness.
- **Acceptance criteria:** green CI on `integration`; readiness provably unchanged by schedule events (test).
- **Depends on:** B1-08, B2-07

---

# Phase 3 — Agent Suite + Command Center (Dev 1 track: document-side)

## B1-09: TEST_FAILED consumer — findings + gate BLOCKED (evidence-side half of the contract)

- **Owner:** Dev 1
- **Description:** Consumer service for the pinned `TEST_FAILED` payload: creates the `findings` NCR row, sets `gates.status='blocked'`, links finding↔gate, writes hash-chained audit events, and raises the Command Center alert via Dev 2's alert-service function (**flagged cross-track dependency** on B2-14's service interface — mitigated: the alert-write signature is part of the frozen B0-06 contract, so Dev 1 codes against it before B2-14 lands, integration proven at IC-3). `TEST_FAILED` never enters the schedule pipeline.
- **Acceptance criteria:** one `proposed_fail` → exactly one finding + one gate-blocked transition + audit events, atomically; `needs_human_review` never triggers it.
- **Endpoint contract (internal):** `POST /internal/events/test-failed {payload per event_contract}` → `201 {finding_id, gate_id, alert_id}` (internal-network only; called by the Cx agent path).
- **Touches:** `services/test_failed_consumer.py`, `routers/internal_events.py`
- **Depends on:** B1-04, B0-06

## B1-10: Spec-Compliance — ingestion + tiered deterministic checks

- **Owner:** Dev 1
- **Description:** `services/compliance_check`: submittal/PO/shop-drawing-text-callout ingestion through the same hash/version/`source_regions` path (`doc_type` incl. `standard`/`precedent` synthetic corpora); check job routed by `requirements.modality` — numeric/categorical/boolean via pure `lib/compliance` comparisons (auto-flaggable, zero LLM verdict); narrative → LLM "possible mismatch" **suggestion** via `ModelProvider`, always `verdict='possible_mismatch'` routed to mandatory human review. Results persist in `compliance_checks` with both citations.
- **Acceptance criteria:** 100% of proposed flags cite exact requirement clause + exact target line; narrative never auto-flags (forced post-processing per Rules.md); import-purity test on `lib/compliance`; text callouts only, no geometry.
- **Endpoint contract:** `POST /v1/projects/{id}/compliance/documents` (multipart + `{doc_type: submittal|po|shop_drawing|standard|precedent, revision}`) → `202 {job_id, document_version_id}`; `POST /v1/projects/{id}/compliance/checks {requirement_id, target_type, target_id}` → `202 {check_job_id}`; `GET /v1/compliance/checks/{id}` → `200 {check_id, modality, verdict, cited_requirement_clause, cited_target_line, confidence, groundedness_state?, proposed_finding_id?}`; `GET /v1/projects/{id}/compliance/checks?review_state=&verdict=` list.
- **Touches:** `services/compliance_check/`, `lib/compliance/`, `routers/compliance.py`, `workers/compliance_tasks.py`
- **Depends on:** B1-03, B1-04

## B1-11: Spec-Compliance — grounding tools, groundedness gate, flag review → findings

- **Owner:** Dev 1
- **Description:** Tool modules `lookup_standard_clause` (FTS/pgvector over ingested synthetic standards), `check_precedent` (existing `edges`/`decisions` approved-equal history), `compare_spec_values` (pure, in `lib/compliance`); groundedness gate before any equivalence flag — ungrounded → `needs_engineering_judgment`/`no_precedent_found`, never shown as a flag; client-spec-vs-standard conflicts surfaced two-source with hierarchy/date. Human flag review creates/accepts the `findings` row + audit entry; no flag closes/accepts itself.
- **Acceptance criteria:** golden tests: grounded equivalent, ungrounded downgrade, conflict surfacing; `ModelProvider` never substitutes tool return values (Rules.md).
- **Endpoint contract:** `POST /v1/compliance/flags/{id}/review {action: accept|reject, reason}` → `200 {finding}`.
- **Touches:** `services/compliance_check/tools.py`, `routers/compliance.py`
- **Depends on:** B1-10

## B1-12: RFI/Knowledge — embedding pipeline + scoped cited query

- **Owner:** Dev 1
- **Description:** Embedding worker populates `knowledge_chunks` (via `ModelProvider.embed`, 768-d pgvector) with mandatory metadata-filter columns; query pipeline: intent classification → doc-type routing → **mandatory-first deterministic SQL metadata filter** (`lib/knowledge` pure predicate builder, applied before any vector operator) → decomposition → `edges` graph traversal → scoped pgvector similarity → `ModelProvider` synthesis. Every claim cites `source_region_id` + `document_version` + content hash; uncitable claims dropped; filtered no-match → explicit no-results with zero uncited claims.
- **Acceptance criteria:** test proves no vector query ever executes without tenant/project predicates (query interception); citation completeness enforced; never-global guarantee tested.
- **Endpoint contract:** `POST /v1/projects/{id}/knowledge/queries {query, doc_type_hint?}` → `200 {answer, claims:[{text, source_region_id, document_version, content_hash}], no_results?}`.
- **Touches:** `services/knowledge/`, `lib/knowledge/`, `routers/knowledge.py`, `workers/embedding_tasks.py`
- **Depends on:** B1-03

## B1-13: RFI similarity + interactive project graph/timeline

- **Owner:** Dev 1
- **Description:** `doc_type='rfi'`-scoped similarity above a configurable cosine threshold, project-scoped only, advisory suggestions citing their source RFI; graph/timeline endpoints reading live `edges` + `audit_events` (no parallel datastore), node expansion via existing FK relations.
- **Acceptance criteria:** below-threshold candidates never surfaced; cross-project retrieval impossible (test); graph nodes expand docs/supply records/audits.
- **Endpoint contract:** `GET /v1/projects/{id}/knowledge/rfi-matches?query=|rfi_id=` → `200 {items:[{rfi_id, similarity, source_region_id, resolved_answer_ref}]}`; `GET /v1/projects/{id}/graph?entity_type=&since=&cursor=` → `200 {nodes[], edges[], next_cursor}`; `GET /v1/projects/{id}/graph/nodes/{node_id}` → `200 {node, linked_docs[], supply_records[], audit_events[]}`.
- **Touches:** `routers/knowledge.py`, `routers/graph.py`
- **Depends on:** B1-12

## IC-3: Phase-3 integration + **frontend integration checkpoint** *(joint with Dev 2)*

- **Owner:** Both (+ frontend colleague)
- **Description:** Merge both tracks; wire the three flagged cross-track seams live (B1-09↔B2-09, B1-09↔B2-14, B2-10↔evidence service); full contract-test suite; export final OpenAPI. Sit with the frontend colleague: walk every surface's endpoints (readiness board, schedule board, Cx workspace, supply-chain map, compliance queue, knowledge chatbot/graph, Live Events/Delays-Risks, Command Center), fix contract gaps found by the frontend against the committed `openapi.json`.
- **Acceptance criteria:** end-to-end demo scenarios pass on `integration`: (a) spec upload → requirement → readiness; (b) contract upload → baseline → shipment delay → re-solve → explanation → Command Center alert → recovery clears it; (c) checklist → failed step → finding + gate blocked + alert; (d) knowledge query returns cited answer. Frontend unblocked on all surfaces.
- **Depends on:** B1-13, B2-14, B1-09

---

# Phase 4 — Hardening, Final Checks, Merge (Dev 1 track)

## B1-14: Evidence-side hardening + demo seed

- **Owner:** Dev 1
- **Description:** Tenant/project-predicate authorization test sweep across all Dev 1 endpoints; rate limits on auth/upload/search/AI/export/compliance/knowledge routes; audit-chain verifier run in CI; synthetic demo dataset (docs, requirements, evidence, findings, standards, precedent log, RFIs) scripted for the demo walkthrough.
- **Acceptance criteria:** authz suite green (no endpoint reachable cross-tenant/cross-project); citation-integrity check: 100% of surfaced proposals/findings/claims resolve to a `source_region_id`.
- **Touches:** `tests/authz/`, `scripts/seed_demo_evidence.py`, rate-limit middleware config
- **Depends on:** IC-3

## IC-4: Final checks and merge to main *(joint with Dev 2)*

- **Owner:** Both
- **Description:** Final rebase of both tracks onto `integration`; full suite (pytest, contract tests, ruff, audit-chain verifier, golden dedup, purity-import tests); frontend smoke against `integration`; tag and merge `integration → main`.
- **Acceptance criteria:** all checks green; the four IC-3 demo scenarios pass on `main`; `openapi.json` on `main` matches what the frontend built against.
- **Depends on:** B1-14, B2-15

---

## Coverage & invariants checklist (traceability — full plan)

- **PRD Must-Have coverage:** RBAC/audit (B0-03/04, B1-07), ingestion/citations (B1-01/03), requirement review (B1-03), typed graph (B1-02), readiness (B1-05), change impact (B1-06), issues (B1-04), gate decisions (B1-07), export (B1-08), baseline schedule (B2-03–05), event rescheduling (B2-06), overrun/bottleneck (B2-05), explainer (B2-07), gate↔schedule cross-link (IC-2), Cx Copilot US-13–18 (B2-08–10 + B1-09), Supply Chain US-19–23 (B2-11/12), Command Center US-31 (B2-14), Spec-Compliance US-24–25 (B1-10/11), Predictive Risk US-26–27 (B2-13), RFI/Knowledge US-28–30 (B1-12/13). Nothing from PRD Out of Scope appears in any task.
- **Invariants preserved:** 4-event contract incl. `predicted_risk_delay` (B0-06); single periodic-poll predictive engine (B2-13); single-leg supply chain (B2-11); user-facing scoped pgvector RFI search, never global (B1-12); US-31 dedup/clear (B2-14); AI-advisory-only everywhere (per-task criteria); deterministic-engine ownership — CP-SAT owns schedule math (B2-01/05/06), readiness engine owns readiness (B1-05), all-pass → `PENDING_REVIEW` (B2-10); groundedness gating (B1-11); hash-chained audit events (B0-04 + per-task); synthetic-only fixtures (B0-02, B1-14, B2-15).
