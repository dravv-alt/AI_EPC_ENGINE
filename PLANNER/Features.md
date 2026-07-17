# Pramana Cx — Frontend Feature & Integration Guide

> Single context document for frontend developers. Everything here is sourced from TRD.md, PRD.md, StructuredPlan.md, AppFlow.md, and DesignDecisions.md. Where a detail is unspecified in those sources, it is listed under [Open Items for Frontend](#7-open-items-for-frontend) rather than invented.

---

## 1. Overview

Pramana Cx is an EPC project intelligence platform for mission-critical data-centre delivery. Its MVP has **two core modules** — (1) an **evidence control plane** (versioned document ingestion with exact source citations, human-reviewed requirement extraction, a typed evidence graph, a deterministic READY/BLOCKED/IN_REVIEW/UNKNOWN readiness board, authorized gate decisions, and a hash-manifested turnover-pack export) and (2) a **Proactive Schedule Management module** (LLM-extracted, human-reviewed task/resource records solved into an immutable, versioned baseline/re-solved schedule by a deterministic CP-SAT solver, with LLM explanations of each re-solve) — plus a **committed five-agent suite**: the Specification & Quality Compliance Agent, the Predictive Schedule Risk Engine, the Supply Chain Visibility & Risk Agent, the Commissioning QA Copilot, and the Project Knowledge & RFI Intelligence Agent. Everywhere, AI is advisory only: it proposes and explains; only deterministic engines (readiness rules, CP-SAT solver, threshold math) and authorized humans set state. The frontend stack is **React 19 + TypeScript** (platform web layer is Next.js 16.x with Tailwind CSS and Radix primitives; the agent UIs are React 19 + Tailwind + **Zustand** + **TanStack Query**), with **Leaflet/React-Leaflet + OpenStreetMap tiles** for the supply-chain map, **PDF.js and SheetJS** for source rendering/spreadsheet imports, and an **offline-capable PWA** field-capture path (ADR-008). Testing includes Vitest, Playwright, MSW, **axe-core**, and API contract tests.

---

## 2. Feature Map

| Feature | Backing endpoints | Primary screen(s) | User stories |
|---|---|---|---|
| Project creation, RBAC, membership | `POST /v1/projects`, `GET /v1/projects/{id}` | Project List, Create Project, Project Settings | US-01 |
| Versioned document ingestion + citations | `POST /v1/projects/{id}/documents` | Source Library, Upload Source, Processing Status | US-02 |
| Requirement extraction & human review | `GET /v1/projects/{id}/requirements`, `POST /v1/requirements/{id}/review` | Requirement Review Queue, Requirement Detail | US-03 |
| Typed graph / edges | `POST /v1/projects/{id}/edges` | Requirement Detail, Evidence Detail | US-03, US-06 |
| Deterministic gate readiness board | `GET /v1/projects/{id}/gates/{gate_id}/readiness` | Readiness Board, Gate Review, Blocker Detail | US-04, US-12 |
| Findings / issues / blocker ownership | `POST /v1/projects/{id}/issues` | Finding Detail, Blocker Detail | US-05 |
| Change impact / stale evidence | (readiness + requirements endpoints) | Readiness Board, Evidence Detail | US-06 |
| Authorized gate decisions | `POST /v1/gates/{id}/decisions` | Gate Review, Decision History | US-07 |
| Turnover evidence-pack export | `POST /v1/projects/{id}/exports`, `GET /v1/exports/{id}` | Exports, Export Preview, Export Job, Manifest Verification | US-08 |
| Offline field evidence capture | (upload/evidence endpoints via PWA queue) | Field Capture | US-04/US-05 edge cases |
| Baseline schedule generation | `POST /v1/projects/{id}/schedule/documents`, `GET .../schedule/tasks`, `POST /v1/schedule/tasks/{id}/review`, `GET .../schedule/resources`, `POST /v1/schedule/resources/{id}/review`, `POST .../schedule/baseline` | Schedule Baseline Setup, Task Record Review Queue, Task Record Detail | US-09 |
| Event-triggered rescheduling | `POST /v1/projects/{id}/schedule/events`, `GET .../schedule/current` | Event Log / Trigger Entry, Schedule & Critical Path Board | US-10 |
| Schedule history, diff, explanations | `GET .../schedule/versions`, `GET /v1/schedule/versions/{id}`, `.../diff`, `.../explanation` | Schedule Version History, Re-solve Explainer, Schedule Version Diff | US-11 |
| Schedule status on gate view (cross-link only) | readiness + schedule current/version endpoints | Gate Review → Schedule Status Panel | US-12 |
| Cx standards ingestion + draft checklist | `POST /v1/projects/{id}/cx/standards`, `POST /v1/projects/{id}/cx/checklists`, `GET /v1/cx/checklists/{id}` | IST Checklist Workspace, Checklist Review | US-13 |
| Guided IST step execution + deterministic verdicts | `POST /v1/cx/checklists/{id}/steps/{step_id}/reading` | Test Execution | US-14, US-15 |
| Test-failure → finding + gate BLOCKED | (`TEST_FAILED` event → findings via Workers core) | Test Execution, Command Center, Readiness Board | US-16 |
| Draft test report + approval + evidence linkage | `POST /v1/cx/checklists/{id}/report`, `GET /v1/cx/reports/{id}`, `POST /v1/cx/reports/{id}/approve` | Draft Test Report | US-17, US-18 |
| Shipment registration + tracking | `POST /v1/projects/{id}/shipments`, `GET /v1/projects/{id}/shipments`, `GET /v1/shipments/{id}` | Supply Chain Map, Shipment Navigator | US-19, US-20, US-21, US-22 |
| Shipment delay/recovery into schedule pipeline | `POST /v1/projects/{id}/schedule/events` (agent-emitted) | Command Center, Schedule & Critical Path Board | US-23 |
| Command Center unified alerts | reads `schedule_events`, `findings`, `edges`, `audit_events` records (no dedicated endpoint defined — see Open Items) | Command Center | US-31 |
| Spec & Quality Compliance checks | *no endpoints defined in TRD — see Open Items* | *(no screen in AppFlow — see Open Items)* | US-24, US-25 |
| Predictive Schedule Risk Engine | emits `schedule_events.event_type = predicted_risk_delay` via schedule events pipeline (no read endpoint defined — see Open Items) | "Live Events" / "Delays/Risks" tabs (StructuredPlan) | US-26, US-27 |
| Knowledge query / RFI intelligence / project graph | *no endpoints defined in TRD — see Open Items* | Query chatbot; Interactive project graph/timeline page (StructuredPlan) | US-28, US-29, US-30 |

---

## 3. Backend API Reference

All endpoints require authentication unless stated otherwise. Error bodies use:

```json
{ "code": "string", "message": "string", "request_id": "string" }
```

General semantics:
- `202` responses return job identifiers for async work; the frontend must show pending/processing states and poll or re-fetch (TRD: Workflows-driven ingestion, solve, export, checklist, report jobs). Failed jobs expose a retry action and job identifier; **retries are idempotent** (AppFlow edge cases).
- Cursor pagination: list endpoints take query filters + `cursor` and return `{items, next_cursor}`.
- Object URLs (downloads, artifacts) are short-lived signed URLs; expired URLs fail closed (`410` on exports).
- `403` must render an access-denied state that does not reveal whether the record exists.

### 3.1 Auth / Projects (evidence control plane)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects` | `{name, code, timezone, retention_days}` | `201 {project}` | `400, 401, 409` |
| `GET` | `/v1/projects/{id}` | none | `200 {project, role}` | `401, 403, 404` |

Auth itself is Better Auth sessions (secure HTTP-only cookies); **TOTP is required for approver roles**. No dedicated auth endpoints are listed in the TRD (see Open Items).

### 3.2 Documents & Ingestion

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/documents` | multipart file plus `{document_type, revision}` | `202 {job_id, document_version_id}` | `400, 401, 403, 413, 415` |

Semantics: SHA-256 computed, original stored in R2, `document`/`document_version` records created; unsupported type/size rejected before processing (`413`/`415`). Duplicate content is detected by hash and does not create a duplicate authoritative record. Document versions carry state `DRAFT` / `APPROVED` / `SUPERSEDED` / `REJECTED`. Extraction creates `source_region` records (page number, optional bounding box, extracted text, source hash) — the citation unit for everything in the UI.

### 3.3 Requirements Review

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `GET` | `/v1/projects/{id}/requirements` | query filters and cursor | `200 {items, next_cursor}` | `401, 403, 404` |
| `POST` | `/v1/requirements/{id}/review` | `{action, normalized_value?, unit?, reason?}` | `200 {requirement}` | `400, 401, 403, 409` |

Only `ACCEPTED` requirements affect readiness. Proposals are schema-validated with source-region references, confidence, normalized value, unit, and review state — all of which the review UI must display.

### 3.4 Readiness / Edges / Findings / Decisions

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/edges` | `{from_type, from_id, to_type, to_id, type}` | `201 {edge}` | `400, 401, 403, 409` |
| `GET` | `/v1/projects/{id}/gates/{gate_id}/readiness` | none | `200 {state, blockers, evaluated_at, rule_version}` | `401, 403, 404` |
| `POST` | `/v1/projects/{id}/issues` | `{title, severity, owner_id, due_at, ...}` | `201 {finding}` | `400, 401, 403` |
| `POST` | `/v1/gates/{id}/decisions` | `{action, reason, evidence_baseline}` | `201 {decision}` | `400, 401, 403, 409` |

Readiness `state` vocabulary: `READY` / `BLOCKED` / `IN_REVIEW` / `UNKNOWN`, with categorized blockers. The engine is deterministic and never reads schedule state. Decisions require the configured approver role (+ TOTP session) and store action, reason, actor, timestamp, evidence baseline.

### 3.5 Exports

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/exports` | `{gate_id, format}` | `202 {export_job_id}` | `400, 401, 403, 409` |
| `GET` | `/v1/exports/{id}` | none | `200 {status, download_url, manifest_hash}` | `401, 403, 404, 410` |

Async job: poll `GET /v1/exports/{id}` for status; `download_url` is a short-lived signed URL (`410` when expired). The manifest includes record identifiers, source hashes, audit-event hashes, rule/model versions (extended with CP-SAT solver version + Gemini model version when a schedule snapshot is included; approved Cx test records contribute evidence IDs, report-artifact hash, and agent model version).

### 3.6 Schedule Management

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/schedule/documents` | multipart file plus `{document_type: contract\|timeline\|po\|approval, revision}` | `202 {job_id, document_version_id}` | `400, 401, 403, 413, 415` |
| `GET` | `/v1/projects/{id}/schedule/tasks` | query filters (`review_state`, `vendor`, cursor) | `200 {items, next_cursor}` | `401, 403, 404` |
| `POST` | `/v1/schedule/tasks/{id}/review` | `{action: accept\|edit\|reject, duration?, dependencies?, vendor?, lead_time?, resource_requirement?, deadline_type?, reason?}` | `200 {task}` | `400, 401, 403, 409` |
| `GET` | `/v1/projects/{id}/schedule/resources` | query filters and cursor | `200 {items, next_cursor}` | `401, 403, 404` |
| `POST` | `/v1/schedule/resources/{id}/review` | `{action: accept\|edit\|reject, crew_count?, equipment_count?, reason?}` | `200 {resource}` | `400, 401, 403, 409` |
| `POST` | `/v1/projects/{id}/schedule/baseline` | `{}` (solves from currently accepted task DAG) | `202 {solve_job_id}` | `400, 401, 403, 409` (`409` on DAG cycle, with the offending edge identified) |
| `POST` | `/v1/projects/{id}/schedule/events` | `{task_id, event_type: shipment_received\|shipment_delayed\|shipment_recovered\|approval_granted\|approval_rejected\|weather_delay, occurred_at, details}` | `202 {event_id, delta_check_job_id}` | `400, 401, 403, 404, 409` |
| `GET` | `/v1/projects/{id}/schedule/current` | none | `200 {version_id, tasks[], critical_path[], status, overrun_days?, bottleneck?, generated_at}` | `401, 403, 404` |
| `GET` | `/v1/projects/{id}/schedule/versions` | query filters and cursor | `200 {items: [{version_id, created_at, trigger_event_id, status}], next_cursor}` | `401, 403, 404` |
| `GET` | `/v1/schedule/versions/{id}` | none | `200 {version_id, tasks[], critical_path[], solver_version, status}` | `401, 403, 404` |
| `GET` | `/v1/schedule/versions/{id}/diff` | `?against={version_id}` | `200 {shifted_tasks[], added[], removed[], net_deadline_impact_days}` | `400, 401, 403, 404` |
| `GET` | `/v1/schedule/versions/{id}/explanation` | none | `200 {summary, triggering_event_id, model_version, generated_at}` | `401, 403, 404, 409` (`409` if explanation generation is still in progress) |

Semantics the frontend must reflect:
- **Extraction is async** (`202 {job_id}`); ambiguous/missing fields are flagged `NEEDS_REVIEW` and **block one-click accept**. Only `ACCEPTED` tasks/resources are eligible for solving. Review state uses filter `review_state`.
- **Baseline solve is async** (`202 {solve_job_id}`); `409` on DAG cycle (with the offending edge identified — surface it). NFR: baseline p95 ≤ 60 s; re-solve p95 ≤ 30 s; solver timeout default 90 s.
- **Events** return `202 {event_id, delta_check_job_id}`. If the delta detector finds no critical-path/downstream impact, only the task's actual status/date is updated (no new version). If affected, a warm-started re-solve produces a new immutable version. Event against a task absent from the current version → explicit error (never silently ignored). Concurrent events on the same task are serialized.
- **`SOLVE_FAILED`**: on exhausted solver retries, the event is marked `SOLVE_FAILED` for manual retry; the prior schedule version and task statuses remain unchanged. The UI shows an explicit `SOLVE_FAILED` state with a retry action and job identifier.
- **Infeasibility is never silent**: a re-solve that cannot avoid deadline overrun still returns a complete schedule with `overrun_days` and `bottleneck` (bottleneck constraint), surfaced on the board and in the explainer.
- **Explanations** exist for every version beyond v1; `409` while generation is in progress (poll/retry). Explainer failure leaves the schedule version intact — surface a retryable error.
- Schedule versions are **immutable**; the version list/diff/explanation views must treat them as append-only history.

### 3.7 Commissioning QA Copilot (proxied to the Python agent-service via the Workers API)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/cx/standards` | multipart file plus `{standard_set, doc_type: standard\|procedure, revision}` | `202 {ingest_job_id, document_version_id}` | `400, 401, 403, 413, 415` |
| `POST` | `/v1/projects/{id}/cx/checklists` | `{system_id, gate_id, equipment_id, standard_set[]}` | `202 {checklist_job_id}` | `400, 401, 403, 409` (`409` on malformed/schema-invalid draft routed to review) |
| `GET` | `/v1/cx/checklists/{id}` | none | `200 {checklist_id, steps[], acceptance_criteria[], cited_clauses[], citation_verification[], status}` | `401, 403, 404` |
| `POST` | `/v1/cx/checklists/{id}/steps/{step_id}/reading` | `{readings, entered_by, entered_at}` | `200 {step, verdict: proposed_pass\|proposed_fail\|needs_human_review}` | `400, 401, 403, 409` |
| `POST` | `/v1/cx/checklists/{id}/report` | `{}` (drafts report from executed steps) | `202 {report_job_id}` | `400, 401, 403, 409` |
| `GET` | `/v1/cx/reports/{id}` | none | `200 {report_id, status: draft\|approved, artifact_url, label}` | `401, 403, 404` |
| `POST` | `/v1/cx/reports/{id}/approve` | `{reason}` | `200 {report, evidence_id, gate_state}` | `400, 401, 403, 409` |

Semantics:
- Standards/procedure ingestion **must complete before checklist generation** (US-13 precondition) — the workspace should confirm ingestion (with clause/section metadata + citations) before offering Generate.
- Checklist generation is async; a **malformed/schema-invalid draft is rejected with a clear error and routed for retry/human review, never partially rendered** (`409`).
- `citation_verification[]` conveys the deterministic post-generation check: a clause ID with no matching ingested clause is **flagged as a possible hallucination and never shown as verified**.
- Step readings return the deterministic verdict vocabulary: `proposed_pass` / `proposed_fail` / `needs_human_review`. Numeric/threshold and boolean/presence steps get deterministic verdicts; narrative/qualitative steps are **always** `needs_human_review`. Step state and readings persist and are resumable without loss; each reading records who entered it and when.
- A `proposed_fail` emits `TEST_FAILED` → findings (NCR) record + gate `BLOCKED` + Command Center alert (server-side; the UI reflects it).
- Report drafting is async (`202 {report_job_id}`); the drafted report is labelled **"DRAFT — PENDING ENGINEER REVIEW"** (`label` field); **export is possible only after approval**. On approval the response returns `evidence_id` and `gate_state` — a completed all-pass test sets the gate to **`PENDING_REVIEW`, never `READY`**.

### 3.8 Supply Chain Visibility & Risk (proxied to the Python agent-service via the Workers API)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/shipments` | `{equipment_id, origin, destination, mmsi, planned_eta, required_on_site, port_congested?}` | `201 {shipment}` | `400, 401, 403, 409` |
| `GET` | `/v1/projects/{id}/shipments` | query filters and cursor | `200 {items: [{shipment_id, position, position_source: live\|simulated, weather_adjusted_eta, status}], next_cursor}` | `401, 403, 404` |
| `GET` | `/v1/shipments/{id}` | none | `200 {shipment_id, position, position_source, route[], weather[], weather_adjusted_eta, status, last_notified_status}` | `401, 403, 404` |

Semantics:
- The agent polls AIS on a **~30 s interval**; the frontend re-fetching these read endpoints (TanStack Query polling) is how the map/table stay fresh — no push transport is specified (see §4).
- `position_source` is `live` | `simulated` — must be rendered as a transparent label on every position (ADR-017).
- `status` is the deterministic 🟢 on-time / 🟡 at-risk / 🔴 delayed classification (required-on-site date minus configurable buffer). `weather_adjusted_eta` is deterministic threshold math, **labelled an estimate, never a guaranteed delivery date**.
- `port_congested?` is a **manual boolean flag** (no live feed); planned transit duration defaults to a configurable placeholder when absent.
- Open-Meteo outage → delay factor defaults to 0; ETA is still returned as a labelled estimate. AIS outage → simulated positions; AIS reconnection resumes live positions without losing the shipment record.
- Delay/recovery events are emitted **server-side by the agent** into `POST /v1/projects/{id}/schedule/events`; the frontend never emits them.

### 3.9 Other agents (no endpoint tables in TRD)

The Specification & Quality Compliance Agent, Predictive Schedule Risk Engine, and Project Knowledge & RFI Intelligence Agent are committed PRD scope (US-24–US-30) but the TRD defines **no API endpoints** for them. The Predictive Risk Engine's output lands as `schedule_events.event_type = predicted_risk_delay` (affected task(s), estimated delay/probability, source signal, ≥1 mitigation option) — note this event_type is **not in the enum listed on `POST .../schedule/events`** in the TRD API table. See [Open Items](#7-open-items-for-frontend).

---

## 4. Realtime & Event-Driven UI

### Transport

The TRD specifies **no push/WebSocket transport to the frontend**. The agents use an in-process `asyncio` event bus (hackathon-local, no durability/replay) and post durable events through `POST /v1/projects/{id}/schedule/events`; the full orchestrator (durable transport, routing, replay/ordering) is explicitly **not-yet-settled**. Command Center rendering "reads from the existing `schedule_events`, `findings`, `edges`, and `audit_events` records the agents already write." Therefore: **the frontend obtains all event-driven state by API polling / re-fetching** (e.g., TanStack Query refetch intervals — a natural cadence for shipments is the agent's own ~30 s poll). No SSE/WS contract exists to build against.

### Event contract (orchestrator, emerging design — ADR-015)

| Event | Emitted by | Emit condition | Payload |
|---|---|---|---|
| `TEST_FAILED` | Commissioning QA Copilot | Deterministic check classifies a step `proposed_fail` (numeric/threshold or boolean/presence only — narrative steps go to `needs_human_review` and never emit this) | Affected test/step, the accepted acceptance criterion and the recorded reading that failed it, affected `gate`, affected `asset`/equipment, source-region citation. Consumed to create a `findings` (NCR) record and set the gate `BLOCKED`. |
| `SHIPMENT_DELAYED` | Supply Chain agent | Deterministic R/A/G status **changes** into at-risk (🟡) or delayed (🔴) | Affected equipment, old/new ETA, delay days, reason (weather factor / AIS lag / manual port-congestion flag), affected schedule task(s). |
| `SHIPMENT_RECOVERED` | Supply Chain agent | Status **changes** back to on-time (🟢) | Affected equipment, recovered ETA, affected schedule task(s); clears the prior stale alert. |

### UI-relevant semantics

- **Dedup — one alert per status transition.** Events fire on a status CHANGE only, never per poll cycle. The Command Center must show exactly one alert per transition; an unchanged status across poll cycles produces zero new alerts (US-31).
- **Recovery clears stale alerts.** A `SHIPMENT_RECOVERED` event clears the corresponding `SHIPMENT_DELAYED` alert from the active-alert view rather than leaving it latched; the cleared alert remains available in history.
- **Fan-out.** A delay/recovery affecting N schedule tasks persists as N `schedule_events` rows (one per affected task, resolved via the shipment's `AFFECTS` edges); dedup is per shipment, not per row — so the Command Center should group by triggering transition, not render N alerts.
- **Cross-links.** Each `TEST_FAILED` alert cross-links to the created `findings` (NCR) record and the gate it set `BLOCKED`; each `SHIPMENT_DELAYED` alert cross-links to affected schedule task(s) and, when a re-solve occurred, the resulting schedule version. The Command Center is a **read/cross-link surface only** — it never changes gate readiness, closes a finding, or alters a schedule date.
- **Routing.** `TEST_FAILED` enters the evidence-graph pipeline (finding + gate `BLOCKED`), not the schedule pipeline. Shipment events land as `event_type = 'shipment_delayed'` / `'shipment_recovered'` and flow through the delta-detector → CP-SAT re-solve pipeline; a recovery may trigger a re-solve to pull dates back in.

---

## 5. Screens & Components

Screens follow AppFlow's Navigation Map. Global rules applying to every authenticated screen: session expiry redirects to `Login` and returns the user to the original route after reauthentication; `403` shows access-denied without revealing record existence; failed jobs show a retry action + job ID; concurrent edits show a conflict state requiring reload before a review/decision can be saved.

### 5.1 Login
- **Purpose:** authentication; TOTP challenge for approver roles.
- **Components:** login form; TOTP step (required before approver actions — see Gate Review).
- **Data:** Better Auth session (no TRD endpoint defined).
- **States:** invalid credentials; expired session return-path handling.

### 5.2 Project List / Create Project / Project Settings
- **Purpose:** entry point; create a project; invite members and assign project roles.
- **Components:** project list; Create Project form (`name, code, timezone, retention policy`) with duplicate-code validation; member-invite panel with role assignment; pending-invitation/retry state.
- **Data:** `POST /v1/projects` (409 on duplicate), `GET /v1/projects/{id}` (returns caller's `role` — use it to gate UI affordances).
- **States:** validation error; invitation pending/retry (Resend delivery failures visible to admins); empty state.
- **Visual rules:** every role change creates an audit event (US-01).

### 5.3 Project Dashboard
- **Purpose:** hub; navigation into Source Library, Readiness Board, Field Capture, Schedule Baseline Setup, Schedule & Critical Path Board, IST Checklist Workspace, Supply Chain Map, Command Center, Exports, Decision History, Project Settings.
- **States:** **empty projects show setup guidance and `UNKNOWN` readiness — never `READY`, never a green state**.

### 5.4 Source Library / Upload Source / Processing Status
- **Purpose:** ingest authorized PDFs, CSVs, XLSX, images, email exports with revision metadata.
- **Components:** document table (revision state `DRAFT`/`APPROVED`/`SUPERSEDED`/`REJECTED`); Upload Source form (multipart + `document_type`, `revision`); Processing Status view (job id, pending/retry/failed).
- **Data:** `POST /v1/projects/{id}/documents` → `202 {job_id, document_version_id}`; poll processing status.
- **States:** upload validation error (400/413/415); pending/retry/failed processing; rate-limited ingestion returns a retryable response preserving upload state; duplicate uploads linked by hash (no duplicate authoritative record).

### 5.5 Requirement Review Queue / Requirement Detail
- **Purpose:** human review of extracted requirement proposals — the only path by which proposals affect readiness.
- **Components:** queue list (filters, cursor pagination); detail view with extracted fields, **confidence score, normalized value, unit, validation status, and exact page/region source citation** (clickable to source viewer); accept / edit / reject actions with reason; edge-creation UI to relate accepted requirements to systems/assets/gates/evidence.
- **Data:** `GET /v1/projects/{id}/requirements`, `POST /v1/requirements/{id}/review`, `POST /v1/projects/{id}/edges`.
- **States:** conflict (`409`) → reload; scanned/illegible/multilingual/table-heavy sources routed to manual review (cannot become authoritative automatically); rejected proposals retained for audit.
- **Visual rules:** proposals are visibly *proposals* (advisory AI output) until accepted; citation always visible during review.

### 5.6 Readiness Board
- **Purpose:** deterministic gate readiness per system/gate with blocker ownership.
- **Components:** system/gate selector; state chip **`READY` / `BLOCKED` / `IN_REVIEW` / `UNKNOWN`**; categorized blocker lists — **missing, stale, failed, blocked, unapproved, accepted** evidence, each with source link and owner; overdue open issues surfaced in the blocker view; `rule_version` + `evaluated_at` display.
- **Data:** `GET /v1/projects/{id}/gates/{gate_id}/readiness`.
- **States:** `UNKNOWN` → missing source/configuration guidance; empty project → setup guidance, no readiness claim.
- **Visual rules:** deterministic red/amber/green board coloring (StructuredPlan: "Deterministic readiness rules and a red/amber/green board with blocker ownership"); `READY` is impossible while any mandatory blocker remains; readiness is computed by the rules engine only — never AI-labelled.

### 5.7 Gate Review (+ Schedule Status Panel) / Decision History
- **Purpose:** approver verifies readiness explanation + evidence baseline and records approve/reject/waive; view decision history.
- **Components:** readiness explanation; evidence-baseline view; decision form (action + mandatory reason); TOTP/role check gate; **Schedule Status Panel** — read-only panel showing linked schedule tasks (via `PRECEDES`/`AFFECTS` edges) and their current delay status (e.g., "critical-path task feeding this gate is N days behind"); Decision History list (action, reason, actor, timestamp, evidence baseline, rule version).
- **Data:** readiness endpoint; `POST /v1/gates/{id}/decisions`; schedule current/version data for the panel.
- **States:** blockers present → "cannot approve; blockers shown"; unauthorized → await authorized approver; save conflict → retry.
- **Visual rules:** the Schedule Status Panel is **informational only and never changes the displayed readiness state**; only the configured approver role (TOTP session) can submit a decision.

### 5.8 Blocker Detail / Evidence Detail / Finding Detail / Test Run Detail
- **Purpose:** drill into a blocker; view evidence with citations, related assets, owner; create/update findings (issues) with owner + due date; record test results.
- **Components:** evidence viewer with source citation (exact page/region); finding form (`title, severity, owner_id, due_at, …` — owner and status required); stale-evidence indicators (superseding evidence propagates `STALE`); test-run recording.
- **Data:** `POST /v1/projects/{id}/issues`; readiness/requirements/edges reads.
- **Visual rules:** stale/superseded evidence visibly marked; change impact (affected requirement/evidence/prior decision relationships) surfaced on revision change (US-06).

### 5.9 Field Capture (offline-capable PWA)
- **Purpose:** field engineers capture photos, observations, measurements, test results against an asset or gate — including offline.
- **Components:** asset/gate selector; capture form with required-field validation; **local pending queue with explicit sync states** (`Pending Sync` → `Processing` → server-confirmed `Accepted` / `Rejected` / `Needs Review`).
- **States:** offline → items queued locally with a **visible sync state, never shown as accepted until uploaded and processed**; connectivity restored → upload + processing; authoritative readiness never changes from a local-only capture.
- **Visual rules:** explicit server-confirmed state labels; bounded (and encrypted where supported) local storage (ADR-008).

### 5.10 Exports / Export Preview / Export Job / Manifest Verification
- **Purpose:** build and download the hash-manifested turnover evidence pack.
- **Components:** system/gate scope selector; preview of included accepted evidence, decisions, audit history, source references; export job status with retry; manifest verification view (`manifest_hash`); download via short-lived signed URL.
- **Data:** `POST /v1/projects/{id}/exports` → `202 {export_job_id}`; poll `GET /v1/exports/{id}` → `{status, download_url, manifest_hash}` (`410` expired URL).
- **States:** scope validation error; failed job retry; expired-URL re-request.

### 5.11 Schedule Baseline Setup / Upload Schedule Source / Extraction Processing Status
- **Purpose:** upload vendor contracts, timelines, POs, government approval docs; monitor extraction.
- **Components:** upload form (`document_type: contract|timeline|po|approval`, `revision`); extraction job status (pending/retry/failed).
- **Data:** `POST /v1/projects/{id}/schedule/documents` → `202`.
- **States:** upload validation errors; Gemini extraction failure → `NEEDS_REVIEW`/`FAILED` job state with retryable error, prior state preserved.

### 5.12 Task Record Review Queue / Task Record Detail
- **Purpose:** mandatory human review of proposed `schedule_task` and `resource` records.
- **Components:** queue with filters (document, vendor, confidence, `review_state`); detail view showing extracted fields (name, duration, dependencies, vendor, lead time, resource requirement, hard/soft deadline type; crew/equipment counts for resources), confidence score, exact source-region citation; accept / edit / reject with reason; **visual flags on ambiguous/missing fields that block one-click accept** (manual resolution or explicit reject required).
- **Data:** `GET .../schedule/tasks`, `GET .../schedule/resources`, `POST /v1/schedule/tasks/{id}/review`, `POST /v1/schedule/resources/{id}/review`.
- **States:** session expiry mid-review returns to the same screen with unsaved-safe state; conflict → reload.
- **Visual rules:** zero silent auto-acceptance — flagged fields are never accepted without explicit human action; reviewer decision records actor + timestamp (audit).

### 5.13 Dependency Graph Validation / Baseline Solve Job
- **Purpose:** validate the accepted task DAG and trigger the CP-SAT baseline solve.
- **Components:** DAG validation result; **cycle error surfacing the offending edge** (blocks solving with a human-actionable error); solve job status; `SOLVE_FAILED` state with retry action + job identifier.
- **Data:** `POST /v1/projects/{id}/schedule/baseline` → `202 {solve_job_id}` (`409` on cycle).
- **States:** cycle detected → solve blocked; solver timeout → `SOLVE_FAILED`, prior version untouched.

### 5.14 Schedule & Critical Path Board
- **Purpose:** the schedule/Gantt/critical-path view of the current immutable schedule version.
- **Components:** task list/Gantt with **critical path highlighted**; version indicator + `generated_at`; **infeasibility banner** showing minimum `overrun_days` and `bottleneck` constraint explicitly (never a silent failure); links to Event Log / Trigger Entry, Re-solve Job Status, Schedule Version History; cross-links to gates via typed edges.
- **Data:** `GET /v1/projects/{id}/schedule/current`.
- **States:** no baseline yet → setup guidance; `SOLVE_FAILED` on re-solve → explicit state + retry, prior version shown untouched.
- **Visual rules:** schedule status is a **separate, cross-linked view** — never folded into gate readiness.

### 5.15 Event Log / Trigger Entry / Re-solve Job Status
- **Purpose:** log shipment/approval/weather-delay events against tasks and follow the delta-detect → re-solve outcome.
- **Components:** event form (`task_id`, `event_type` enum: `shipment_received|shipment_delayed|shipment_recovered|approval_granted|approval_rejected|weather_delay`, `occurred_at`, `details`); delta-check/job status; outcome display (status-only update vs. new version).
- **Data:** `POST /v1/projects/{id}/schedule/events` → `202 {event_id, delta_check_job_id}`.
- **States:** event against a task not in the current version → **explicit rejection error**; concurrent events serialized; `SOLVE_FAILED` → retry.

### 5.16 Schedule Version History / Re-solve Explainer / Schedule Version Diff
- **Purpose:** browse immutable version history; read AI explanations; compare any two versions (should-have: not only consecutive ones).
- **Components:** version list (`version_id, created_at, trigger_event_id, status`); explainer panel (`summary, triggering_event_id, model_version, generated_at`); diff view (`shifted_tasks[], added[], removed[], net_deadline_impact_days`).
- **Data:** `GET .../schedule/versions`, `GET /v1/schedule/versions/{id}`, `GET .../diff?against=`, `GET .../explanation` (`409` while generation in progress → poll).
- **Visual rules:** the explanation is **clearly labelled as an AI-generated summary** and never alters any date; versions are immutable/timestamped.

### 5.17 IST Checklist Workspace / Checklist Review (Commissioning QA Copilot)
- **Purpose:** ingest standards/procedures, select system + gate + equipment + standard set, generate and review the draft checklist.
- **Components:** standards/procedure ingest upload (`standard_set`, `doc_type: standard|procedure`, `revision`) with ingest-job status; selection form (system, gate, equipment, standard set); ingestion-precondition check (generation disabled until standards are ingested with clause metadata + citations); draft checklist renderer — steps, acceptance criteria, cited clauses; **citation-verification indicators** per clause; draft-acceptance gate (accept / edit / reject steps).
- **Data:** `POST /v1/projects/{id}/cx/standards`, `POST /v1/projects/{id}/cx/checklists` → `202 {checklist_job_id}`, `GET /v1/cx/checklists/{id}`.
- **States:** schema-invalid draft → rejected with clear error, routed to retry/human review, **never partially rendered**; ingestion pending.
- **Visual rules:** unverifiable clause citations flagged as **possible hallucination — never shown as verified**; the draft is advisory and never authoritative until engineer acceptance; synthetic standards excerpts are clearly labelled.

### 5.18 Test Execution (step-execution UI — ADR-016)
- **Purpose:** guided step-by-step IST execution with per-step field-reading capture.
- **Components:** step list with per-step reading entry (records `entered_by`, `entered_at`); **"Proposed" verdict badges** rendering `proposed_pass` / `proposed_fail` / `needs_human_review`; human-review routing indicator for narrative/qualitative steps; failure outcome panel (TEST_FAILED → gate `BLOCKED` + finding + Command Center alert, as one atomic recorded outcome); resume-in-place persistence (Zustand + TanStack Query state sync).
- **Data:** `POST /v1/cx/checklists/{id}/steps/{step_id}/reading` → `{step, verdict}`.
- **States:** interrupted execution resumable without loss; offline considerations per PWA rules where applicable.
- **Visual rules:** every verdict is visibly **"Proposed"** — never displayed as an accepted result; narrative steps never show pass/fail.

### 5.19 Draft Test Report
- **Purpose:** review, edit, approve, and export the auto-drafted test report.
- **Components:** report viewer/editor; persistent **"DRAFT — PENDING ENGINEER REVIEW"** label until approval; approve action (with reason); export control **enabled only after approval**; post-approval display of `evidence_id` and resulting `gate_state`.
- **Data:** `POST /v1/cx/checklists/{id}/report` → `202 {report_job_id}`; `GET /v1/cx/reports/{id}` → `{report_id, status: draft|approved, artifact_url, label}`; `POST /v1/cx/reports/{id}/approve`.
- **Visual rules:** an all-pass approval sets the gate to **`PENDING_REVIEW`, never `READY`** — reflect that exactly; the agent cannot certify/sign/close anything (advisory-only labelling).

### 5.20 Supply Chain Map / Shipment Navigator (ADR-017)
- **Purpose:** geospatial single-leg shipment tracking with a click-to-zoom navigator.
- **Components:** **Leaflet/React-Leaflet map on OpenStreetMap tiles with visible ODbL attribution**; shipment markers colored by status; **great-circle route polylines split at the antimeridian** (a ±180°-crossing route renders as continuous segments, never a wrong straight line — `@turf` client-side); weather overlays (origin, current position, destination); **live vs. simulated position label** on every rendered position; **navigator table** listing shipments with click-to-zoom to the selected shipment's origin→destination route; shipment registration form (`equipment_id, origin, destination, mmsi, planned_eta, required_on_site, port_congested?` — manual boolean congestion flag).
- **Data:** `POST /v1/projects/{id}/shipments`, `GET /v1/projects/{id}/shipments`, `GET /v1/shipments/{id}`; refresh via polling (~30 s agent poll cadence).
- **States:** AIS unavailable → simulated (interpolated) positions, labelled; Open-Meteo unavailable → delay factor 0, ETA still shown as labelled estimate; AIS reconnection resumes live labels without losing the record.
- **Visual rules:** **🟢 on-time / 🟡 at-risk / 🔴 delayed** status coloring (deterministic threshold math); **ETAs labelled as estimates, never guaranteed delivery dates**; a simulated position is never presented as a live fix; OSM attribution always visible.

### 5.21 Command Center
- **Purpose:** unified alert surface cross-linking each triggering event to its downstream impact.
- **Components:** active-alert list (`TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`); per-alert cross-links — TEST_FAILED → the created finding (NCR) + the gate set `BLOCKED`; SHIPMENT_DELAYED → affected schedule task(s) + (if re-solved) the resulting schedule version; alert history (cleared alerts remain available in history).
- **Data:** reads from existing `schedule_events`, `findings`, `edges`, `audit_events` records; **no dedicated Command Center endpoint is defined in the TRD** (see Open Items). Poll-based refresh.
- **Visual rules:** exactly **one alert per status transition** (dedup); a `SHIPMENT_RECOVERED` clears the corresponding stale delay alert rather than latching it; the surface is read/cross-link only — no actions that change gate readiness, close findings, or alter dates.

### 5.22 "Live Events" and "Delays/Risks" tabs (Predictive Schedule Risk Engine — StructuredPlan/US-27)
- **Purpose:** dedicated tab section showing real-time polled signals and flagged predicted risks, separate from but cross-linked to the schedule/critical-path view.
- **Components:** Live Events list (polled signals: procurement status, equipment lead times, workforce availability, weather forecast); Delays/Risks list — each flagged `predicted_risk_delay` with affected task(s), estimated delay/probability, source signal, and ≥1 mitigation option; cross-links to the affected task on the Schedule & Critical Path Board.
- **States:** a signal feed unavailable during a poll cycle → **explicit data-unavailable state** (never a fabricated risk, never silently dropped monitoring); a self-resolving risk updates on material change rather than latching stale in the view; unchanged risks are not re-emitted (task + risk-type dedup).
- **Visual rules:** mitigation options are **proposals only** — no UI action applies/selects one automatically (a human or the CP-SAT solver executes); risk detection is advisory and never alters a schedule date. *(No read API is defined for this surface in the TRD — see Open Items.)*

### 5.23 Knowledge query chatbot & Interactive Project Graph/Timeline (Project Knowledge & RFI Intelligence Agent — StructuredPlan/US-28–US-30)
- **Purpose:** (a) NL question in → cited NL answer + exact source PDF/doc region out; (b) an interactive node graph/timeline of all project events (completed/ongoing/upcoming) where **clicking a node expands** linked docs, vendor supply records, and audit history via existing FK relations.
- **Components:** chat surface where **every claim cites `source_region_id`, `document_version`, and content hash** and links to the exact source region; "previously resolved similar RFI" suggestion cards (advisory, citing their source RFI, above a cosine-similarity threshold only — never forced); graph/timeline page with clickable expanding nodes (entities: event/doc/test/decision), reading live state via API (no parallel datastore).
- **States:** no documents match the mandatory metadata filter → **explicit no-results answer with zero uncited claims**; claims that can't be tied to a `source_region_id` are dropped, never shown uncited.
- **Visual rules:** answers are advisory with citations + confidence; suggestions never auto-answer or close a query. *(No API endpoints are defined for this agent in the TRD — see Open Items.)*

### 5.24 Spec & Quality Compliance review surface (US-24/US-25)
The PRD commits deviation flags (exact clause vs. exact submittal/PO/drawing line, confidence score), auto-proposed findings pending human acceptance, "possible mismatch" narrative suggestions routed to mandatory review, equivalence claims shown only when grounded (else downgraded to "no precedent found, needs engineering judgment"), and conflicting client-spec-vs-standard sources surfaced with document hierarchy/date. **Neither AppFlow nor the TRD defines a screen or endpoints for this agent** — see Open Items. Findings it proposes land in the existing `findings` records and therefore appear in Blocker/Finding Detail.

---

## 6. Cross-Cutting Frontend Concerns

- **RBAC-driven UI.** `GET /v1/projects/{id}` returns the caller's `role`; gate affordances on it. At least three permission levels exist: viewer, reviewer/acceptor, approver/signer (plus field engineer, project scheduler/planner, commissioning engineer as scoped roles). A reviewer cannot perform an approver action; approver actions require a TOTP-enabled session; a non-member gets `403` with a non-revealing access-denied state. Every role change is an audit event.
- **Offline PWA queue + sync visibility (ADR-008).** Field capture queues locally with explicit `Pending Sync` → `Processing` → server-confirmed states; queued items are never shown as accepted; local storage bounded and encrypted where supported; authoritative readiness never changes from a local-only capture.
- **Citation links everywhere.** 100% of accepted AI proposals and surfaced findings carry a resolvable source-region reference (page + optional bbox + content hash). Every AI claim in the UI — requirement proposals, schedule task/resource proposals, Cx clause citations, compliance flags, knowledge answers — must open the exact source page/region. Unverifiable Cx clause citations are flagged, never shown verified.
- **Advisory-only labelling.** All AI output is a proposal: "Proposed" verdict badges, "DRAFT — PENDING ENGINEER REVIEW" report label, AI-generated labels on schedule explanations, ETA-is-an-estimate labels, live-vs-simulated position labels, "possible mismatch" suggestions, mitigation options as proposals. No UI flow may present AI output as an approval, certification, closure, or readiness state.
- **Audit/immutability cues.** Audit events are append-only and hash-chained; schedule versions are immutable and hash-linked to predecessor + triggering event; decisions store actor/timestamp/reason/evidence baseline/rule version; rejected proposals are retained for audit. Surface `rule_version`, `evaluated_at`, `solver_version`, `model_version` where the API returns them.
- **Configurable thresholds.** Product thresholds are named configurable defaults, not hardcoded (e.g., the shipment status buffer, planned-transit-duration placeholder, `CHECKLIST_COVERAGE_TARGET`, `CITATION_VERIFICATION_PASS_TARGET`, `ACCEPTANCE_CHECK_ACCURACY_TARGET`, `ETA_STATUS_ACCURACY_TARGET`). The R/A/G buffer is explicitly "configurable" — don't bake values into components.
- **Accessibility.** Core review, blocker, approval, schedule review/critical-path, and Commissioning step-execution flows must pass automated **axe checks and keyboard navigation tests** (TRD NFR; axe-core is in the test stack). R/A/G status must therefore not rely on color alone (labels/emoji accompany the coloring per PRD 🟢/🟡/🔴 usage).
- **Error/empty/conflict conventions.** Standard error body `{code, message, request_id}` (show `request_id` for support); retryable job failures with job IDs; conflict-on-concurrent-edit requiring reload; empty projects → setup guidance + `UNKNOWN`; expired sessions/signed URLs fail closed.

---

## 7. Open Items for Frontend

1. **Two agent UIs talk to proxied Python services (accepted stack override).** The Commissioning QA Copilot and Supply Chain agent are separate Python/FastAPI services; the Workers API is the single authenticated front door proxying `/v1/.../cx/*` and `/v1/.../shipments*`. Frontend code should treat them as ordinary platform endpoints, but expect hackathon-local behavior (localhost services, in-process bus). Whether the agents' React UIs live in the platform Next.js app or as separate React 19 bundles is not specified.
2. **Orchestrator transport not settled.** Durable transport, routing rules, and replay/ordering are explicitly deferred; only the three-event contract is pinned. There is **no push channel to the frontend** — build all event-driven surfaces (Command Center, map, board) on API polling until a transport is defined.
3. **No Command Center read endpoint.** US-31/AppFlow define the screen and the TRD says it "reads from the existing `schedule_events`, `findings`, `edges`, and `audit_events` records," but no aggregate alerts API is specified. A read endpoint (or client-side composition from list endpoints — themselves not all defined, e.g., no `GET .../schedule/events` list, no `GET` findings list, no audit-events endpoint appears in the TRD tables) needs definition.
4. **No endpoints for three of the five agents.** The Specification & Quality Compliance Agent (US-24/US-25), Predictive Schedule Risk Engine (US-26/US-27 — including how the frontend reads live signals/flagged risks for the "Live Events"/"Delays/Risks" tabs), and Project Knowledge & RFI Intelligence Agent (US-28–US-30 — query, RFI-similarity, and graph/timeline APIs) have committed features and UI surfaces but no API tables in the TRD.
5. **`predicted_risk_delay` not in the events-endpoint enum.** The TRD's `POST /v1/projects/{id}/schedule/events` request enum lists six event types and omits `predicted_risk_delay`, which the PRD commits as an emitted `schedule_events.event_type`. Reconciliation needed.
6. **Auth endpoints unspecified.** Better Auth + TOTP is committed, but no login/session/TOTP endpoint shapes appear in the TRD.
7. **Screens without listed endpoints.** Requirement Detail edge-listing/reads, Evidence Detail, Test Run Detail, Decision History reads, Field Capture's evidence-submission endpoint, and member-invitation endpoints are implied by AppFlow but have no TRD API rows.
8. **Localhost hackathon build.** The whole build targets localhost (Dockerized services), not deployed Cloudflare; the local substitute architecture (what stands in for D1/R2/Workers) is a TRD-stage decision left open — base URLs/environments for the frontend are undefined.
9. **Search UI.** FTS5 is the primary user-facing citation/evidence-lookup mechanism (hybrid search is a should-have), but no search endpoint is defined in the TRD API tables.
10. **Report editing shape.** US-17 requires the draft report be *editable* before approval, but the Cx API defines no edit endpoint — only draft (`POST .../report`), read, and approve.
11. **Multi-site map rendering** is "supported but untested" (single Mumbai destination for the demo); OSM tiles and AIS/Open-Meteo are free-tier/non-commercial only.
