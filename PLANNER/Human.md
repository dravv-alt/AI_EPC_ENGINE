# Human.md — What + How (Quick Mental Map)

**Project:** Pramana Cx backend. AI-assisted EPC commissioning/evidence + schedule engine.
**Stack:** Python + FastAPI (one core app, all `/v1/*`) · SQLAlchemy 2.x + Alembic · Postgres 16 + pgvector + tsvector · Redis + ARQ (jobs) · MinIO (S3) · JWT cookie auth + RBAC + TOTP · CP-SAT solver microservice (ortools) · 2 separate agent-services (Cx, Supply Chain) w/ direct Gemini SDK · rest use core `ModelProvider`(Gemini adapter).
**Build model:** 2 backend devs, parallel branches. Frontend = separate colleague (Next.js), consumes OpenAPI. 4 phases, each ends in integration checkpoint (IC-1..4).

---

## PHASE 0 — Shared Foundation (both devs, then frozen)

- **B0-01** scaffold + docker-compose (Postgres/Redis/MinIO/api/worker) + CI + `/health`.
- **B0-02** full Schema.md migration (all tables/enums/indexes/pgvector) + synthetic seed.
- **B0-03** (Dev1) auth: JWT cookies, project RBAC, TOTP step-up. → `core/security.py`,`routers/auth.py`
- **B0-04** (Dev1) hash-chained audit + MinIO storage + projects/members CRUD. → `core/audit.py`,`core/storage.py`,`routers/projects.py`
- **B0-05** (Dev2) ARQ runner + idempotency + `ModelProvider`+Gemini/Mock adapters. → `core/jobs.py`,`core/model_provider.py`,`workers/runner.py`
- **B0-06** (both) frozen 4-event contract (`TEST_FAILED`,`SHIPMENT_DELAYED/RECOVERED`,`predicted_risk_delay`) + alert dedup rules. → `core/event_contract.py`

---

## DEV 1 — Evidence Control Plane + Document-side Agents
*Tech: FastAPI + Postgres + ARQ + pgvector/FTS + Gemini via ModelProvider. Pure libs: `lib/readiness`,`lib/compliance`,`lib/knowledge` (no network/LLM/UI).*

**Main tasks:** auth/RBAC/TOTP · audit chain + storage + projects · doc ingestion & requirement extraction · systems/assets/gates + typed graph · evidence/tests/findings · readiness engine · change-impact · gate decisions · turnover export · **agents: Spec-Compliance, RFI/Knowledge, TEST_FAILED consumer**.

### Phase 1 (tracer)
- **B1-01** thin full path: upload PDF→extract→review→readiness read. Proves whole stack wired. → `routers/documents,requirements,readiness`, `services/ingestion`, `workers/extraction_tasks`, `lib/readiness`(skeleton)

### Phase 2 (evidence depth)
- **B1-02** systems/assets/gates CRUD + CSV import + typed `edges` graph. → `routers/systems_assets_gates,edges`
- **B1-03** real Gemini requirement extraction + review queue + FTS search. → `workers/extraction_tasks`,`services/requirements`
- **B1-04** evidence + test procedures/runs + findings(issues) w/ owner/status. → `routers/evidence,findings`,`services/evidence`
- **B1-05** full deterministic readiness engine (READY/BLOCKED/IN_REVIEW/UNKNOWN, 6 blocker cats). → `lib/readiness`,`services/readiness`
- **B1-06** change impact: superseding doc version→stale evidence propagation. → `services/ingestion`,`workers/ingestion_tasks`
- **B1-07** authorized gate decisions (approve/reject/waive, TOTP re-check). → `routers/decisions`,`services/decisions`
- **B1-08** async turnover evidence-pack export (hash manifest, signed URL). → `routers/exports`,`workers/export_tasks`

### Phase 3 (document agents)
- **B1-09** TEST_FAILED consumer → creates finding + blocks gate + raises alert. → `services/test_failed_consumer`,`routers/internal_events`
- **B1-10** Spec-Compliance: ingest + tiered checks (numeric/categorical=pure; narrative=LLM suggestion→human). → `services/compliance_check`,`lib/compliance`,`routers/compliance`,`workers/compliance_tasks`
- **B1-11** Compliance grounding tools + groundedness gate + flag review→findings. → `services/compliance_check/tools`,`routers/compliance`
- **B1-12** RFI/Knowledge: embedding pipeline + scoped cited query (metadata filter→vector, never global). → `services/knowledge`,`lib/knowledge`,`routers/knowledge`,`workers/embedding_tasks`
- **B1-13** RFI similarity + interactive project graph/timeline (live edges+audit). → `routers/knowledge,graph`

### Phase 4
- **B1-14** authz sweep + rate limits + audit verifier in CI + demo seed. → `tests/authz`,`scripts/seed_demo_evidence`

---

## DEV 2 — Schedule/Event Side + Agents + Command Center
*Tech: FastAPI + ARQ + CP-SAT microservice + Gemini explainer. Agent-services: `cx-agent`(Chroma+Gemini SDK+NetworkX), `supply-chain-agent`(AIS/Open-Meteo/turfpy, no LLM). Pure libs: `lib/scheduling`,`lib/predictive_risk`.*

**Main tasks:** ARQ job runner + ModelProvider (Phase 0) · CP-SAT solver microservice · schedule doc ingestion & extraction · task/resource review · baseline solve + re-solve + delta detector · version history/diff/explainer · **agents: Cx (Commissioning QA), Supply Chain, Predictive Risk** · Command Center alerts.

### Phase 1 (tracer)
- **B2-01** CP-SAT solver microservice (stateless, `POST /solve`, feasible|infeasible+bottleneck). → `services/solver`
- **B2-02** schedule tracer: accepted tasks→baseline solve→immutable v1→read. → `routers/schedule`,`services/scheduling`,`lib/scheduling`(skeleton),`workers/schedule_tasks`

### Phase 2 (schedule depth)
- **B2-03** schedule doc ingestion + Gemini task/resource extraction (reuses Dev1 ingestion). → `routers/schedule`,`workers/schedule_tasks`
- **B2-04** task/resource review queue (only accepted→solvable). → `routers/schedule`,`services/scheduling`
- **B2-05** full baseline solve: DAG assembly, cycle check, resources, infeasibility. → `lib/scheduling`,`services/scheduling`
- **B2-06** schedule events endpoint + delta detector + warm-start re-solve→new version. → `routers/schedule`,`services/scheduling/delta_detector`
- **B2-07** version history/diff + Gemini explainer (async, non-blocking, AI-labelled). → `routers/schedule`,`workers/schedule_tasks`

### Phase 3 (event agents + command center)
- **B2-08** Cx agent: standards ingest + draft checklist + citation verification (flagged=hallucination). → `services/cx-agent`,`routers/cx_proxy`
- **B2-09** Cx step execution: deterministic pass/fail + emits TEST_FAILED to Dev1. → `services/cx-agent/acceptance`,`routers/cx_proxy`
- **B2-10** Cx report draft/approve→evidence row (Dev1 svc), gate→in_review(never ready). → `services/cx-agent/report`,`routers/cx_proxy`
- **B2-11** Supply Chain agent: shipments + AIS/weather poll + deterministic ETA/R-A-G. → `services/supply-chain-agent`,`routers/shipments_proxy`
- **B2-12** shipment delay/recovery emission: dedup on status-change + fan-out to schedule pipeline. → `services/supply-chain-agent/emitter`
- **B2-13** Predictive Risk engine: single ARQ-cron poll→signals→material risks→`predicted_risk_delay` (proposals only, never mutates dates). → `services/predictive_risk`,`lib/predictive_risk`,`workers/risk_poll_tasks`,`routers/risks,live_events`
- **B2-14** Command Center: alerts for all 4 events, US-31 dedup/clear (recovery clears delay alert). → `services/alerts`,`routers/alerts`,`workers/alert_tasks`

### Phase 4
- **B2-15** authz/rate sweep + dedup golden set + solver/agent failure-mode tests + demo seed. → `tests/authz,golden`,`scripts/seed_demo_schedule`

---

## Integration Checkpoints (both devs merge→`integration`, Alembic heads merged, contract tests+smokes green, OpenAPI exported)
- **IC-1** (after B1-01,B2-02) — Phase 1 tracers pass.
- **IC-2** (after B1-08,B2-07) — combined smoke; readiness provably unaffected by schedule events.
- **IC-3** (after B1-13,B2-14 + frontend) — wire 3 cross-track seams live; 4 demo scenarios; frontend unblocked.
- **IC-4** (after B1-14,B2-15) — full suite green; merge `integration→main`.

## 3 cross-track seams
- B2-03 reuses B1-01 ingestion (read-only).
- B2-09 emits TEST_FAILED → B1-09 consumer (contract frozen B0-06).
- B1-09 uses B2-14 alert-write fn; B2-10 uses Dev1 evidence svc.
