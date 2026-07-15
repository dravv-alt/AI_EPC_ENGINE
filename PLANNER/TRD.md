# Pramana Cx Technical Requirements Document

The MVP is a project-scoped commissioning evidence system with two integrated modules: (1) an **evidence control plane** that ingests authorized source files, creates human-reviewed structured requirements, relates them to systems, assets, gates, tests, evidence, findings, and decisions, computes deterministic readiness, and exports a verifiable turnover pack; and (2) a **Proactive Schedule Management module** that extracts task/resource-capacity records from vendor contracts, timelines, POs, and government approval documents, builds and deterministically re-optimizes a baseline schedule via a CP-SAT solver, and generates human-readable explanations of each re-solve. Both modules share the same tenant/project isolation, typed-edges provenance graph, RBAC, and AI-advisory-only boundary: AI proposes and explains; only deterministic engines (the readiness rules module, the CP-SAT solver) and authorized humans set state. Two additional domain agents — a **Commissioning Quality Assurance Copilot** and a **Supply Chain Visibility & Risk Agent** — are integrated in this document as separate Python agent-services that respect the same AI-advisory-only boundary while adopting an overriding local tech stack (see "Agent-services integration approach" and the dedicated agent sections below).

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Web | Next.js 16.x, React 19.x, TypeScript, Tailwind CSS, Radix primitives | Supports a responsive dashboard and PWA — including the readiness board and schedule/Gantt/critical-path views — from one typed codebase. |
| Runtime/API | Cloudflare Workers with OpenNext | Provides the serverless API and edge delivery within the freemium operating model, for both evidence and schedule endpoints. |
| Relational store | Cloudflare D1 with Drizzle ORM | Supports normalized project data, foreign keys, migrations, and bounded graph traversals, extended with schedule tables (`schedule_tasks`, `schedule_versions`, `resources`, `schedule_events`). |
| Object store | Cloudflare R2 | Stores originals (including vendor contracts/timelines/POs/approval docs), page renders, exports, and manifests without application-server disk dependence. |
| Search | D1 FTS5 plus Cloudflare Vectorize | Combines exact model/part/clause search with project-scoped semantic retrieval; Vectorize also supports internal task-to-system/asset mapping during schedule extraction, never as user-facing semantic search. |
| Jobs | Cloudflare Workflows and Queues | Provides retryable ingestion, fan-out, and human-review checkpoints; orchestrates the schedule pipeline (extraction → review → solve → explain) and the event → delta-detector → re-solve pipeline, with each external solver call as a discrete, retryable Workflow step. |
| Auth | Better Auth with project-scoped RBAC and TOTP | Keeps authorization decisions inside the application boundary; unchanged and reused as-is for the schedule module (no new auth mechanism introduced — same roles, e.g. project scheduler/planner, gain scoped permissions on schedule endpoints). |
| AI (evidence extraction) | Workers AI behind an internal `ModelProvider` interface; BYOK and private adapters | Allows evaluation and model replacement without coupling readiness logic to one provider. |
| AI (schedule extraction/explanation) | Gemini API, accessed only through a second concrete `ModelProvider` adapter (`GeminiModelProvider`) | Per PRD/StructuredPlan assumption, schedule extraction and explanation use Gemini rather than Workers AI/Claude. Implementing it as another `ModelProvider` adapter — rather than calling the Gemini SDK from the schedule services directly — preserves the existing "no direct vendor SDK calls outside a provider adapter" rule; it is a second provider implementation, not an exception to it. |
| **Schedule solver** | **CP-SAT (Google OR-Tools) run in a dedicated solver microservice**, invoked from a Cloudflare Workflow step over an internal HTTP API | See justification below. |
| PDF/tabular processing | PDF.js and SheetJS community | Supports source rendering and controlled spreadsheet imports for both requirement documents and vendor contracts/timelines/POs. |
| Observability | OpenTelemetry, structured audit logs, Sentry for UI errors | Separates operational diagnostics from product audit evidence; extended to trace solver latency and re-solve trigger chains. |
| Testing | Vitest, Playwright, MSW, axe-core, API contract tests | Covers deterministic rules (readiness engine and CP-SAT wrapper), browser workflows, mocked providers (including a mocked solver service and mocked Gemini adapter), and accessibility. |
| CI/security | GitHub Actions, CodeQL, Dependabot, Trivy, Gitleaks | Adds repeatable quality and secret/container scanning gates; Trivy also scans the solver microservice's container image. |
| **Commissioning QA Copilot agent-service** | **Python/FastAPI service** — Chroma (standards/procedure RAG), Neo4j/NetworkX (internal test↔gate↔equipment working graph), Gemini 2.5 Flash + Gemini embeddings via direct SDK, PyMuPDF, ReportLab/python-docx for report export; React 19 + Tailwind/Zustand/TanStack Query step-execution UI | Adopted as this agent's committed stack per user direction, **overriding** the Cloudflare-native/`ModelProvider`/Workers-AI stack for this agent. Integrated as a separate agent-service invoked by / integrated with the Workers core — the same reconciliation pattern as the CP-SAT solver microservice, not an exception. See "Agent-services integration approach — accepted override" below. |
| **Supply Chain Visibility & Risk agent-service** | **Python/FastAPI service** — `websockets` (aisstream.io AIS), `httpx` (Open-Meteo weather), `turfpy` (great-circle interpolation), Chroma, Neo4j/NetworkX, in-process `asyncio` event bus; React 19 + Leaflet/React-Leaflet, Tailwind/Zustand/TanStack Query UI, OpenStreetMap tiles (ODbL, attributed) | Same accepted override; a second separate Python agent-service integrated with the Workers core, emitting `schedule_events` into the existing delta-detector → CP-SAT re-solve pipeline. See "Agent-services integration approach — accepted override" below. |

### Solver integration approach — justification

CP-SAT (Google OR-Tools) is a mature, well-maintained, and correct constraint solver; per the Library-First Rule, we use it rather than hand-rolling a scheduling heuristic. The open question is *how* to invoke a C++-based solver from a Cloudflare Workers/OpenNext stack that is otherwise JS/WASM-only.

**Chosen approach: a dedicated solver microservice**, packaged as a small containerized HTTP service (Python, using the official `ortools` package's `CpSolver`), running outside the Workers isolate (locally in Docker for the hackathon; on a container platform such as Cloud Run/Fly.io for a pilot). A Cloudflare Workflow step calls this service with the task DAG, resource capacities, and deadline constraints as JSON, and receives back the solved schedule (or an infeasibility/bottleneck report) as JSON. The Workflow step wraps the call with a timeout and retry, per the NFRs below.

**Rejected alternative: compiling OR-Tools/CP-SAT to WASM and running it inside the Worker.** This was rejected because:
- There is no official OR-Tools WASM build; community attempts are experimental and unmaintained, so adopting one would violate the Library-First Rule's intent (introducing custom build/maintenance risk instead of using a well-maintained library as-is).
- A WASM build would need to be single-threaded (Workers isolates cannot spawn native threads), which materially degrades CP-SAT's practical performance on anything beyond small toy DAGs.
- The compiled binary size for a full CP-SAT build is far larger than fits comfortably within a Workers script's size and memory limits, and Workers CPU-time limits per invocation are a poor fit for solver runs whose duration is workload-dependent (a re-solve on a large DAG could legitimately need more CPU time than a single Workers request is allowed).
- A separate solver service keeps the Workers/OpenNext codebase in its existing, well-supported JS/TS toolchain and keeps the solver itself trivially upgradable to newer OR-Tools releases without a WASM recompilation step.

The tradeoff accepted is an additional deployable service and a network hop per solve; this is mitigated by treating every solver call as an idempotent, retryable Workflow step (consistent with the existing "durable jobs must be retryable and idempotent" constraint) and by keeping the solver service stateless (all state — the DAG, resource data, prior fixed/completed tasks — is passed in on each call; the service does not itself read D1 or R2).

### Agent-services integration approach — accepted override

The Commissioning Quality Assurance Copilot and the Supply Chain Visibility & Risk Agent are committed (per StructuredPlan's agent-suite sections and the PRD's US-13–US-23) to a **Python/FastAPI + Chroma + Neo4j/NetworkX + direct Gemini SDK + in-process `asyncio`** stack. This **overrides** the platform's Cloudflare-native/`ModelProvider`/Workers-AI stack **for these two agents only**, as an explicit user decision recorded in StructuredPlan's Divergence Note and the PRD's "Stack override" constraint. This subsection records that override as **accepted** and reconciles it architecturally rather than hand-waving it as an exception — using the *same reconciliation pattern already applied to the CP-SAT solver microservice*: these are separate Python services invoked by / integrated with the Workers core, not code running inside a Workers isolate and not a second parallel product.

**Integration boundary (how the Workers core reaches the agent-services, and how their outputs land back in the platform's stores):**

- **Invocation.** Each agent-service exposes an internal HTTP API. The Workers API is the front door for all authenticated user traffic; it proxies agent-specific requests (checklist generation, step execution, report drafting; shipment registration, map/status reads) to the relevant agent-service over TLS on an internal network, passing only the project-scoped data a given operation needs — mirroring the solver microservice's "authenticated, internal-network requests, no public ingress, no tenant-identifying data beyond what the operation requires" rule. Where a task is long-running (standards ingestion, report drafting), the Workers core drives it as a Workflow step with the same timeout/retry/idempotency wrapper used for solver calls.
- **Outputs landing back in the system of record.** The agent-services own their local working stores (Chroma for RAG vectors, Neo4j/NetworkX for their internal working graphs) but are **not** the authoritative store for any platform record. Their durable outputs are written back through the Workers core into the platform's systems of record:
  - **Findings, evidence, and audit events** produced by the Commissioning agent (a drafted test record on approval becoming `evidence`; a `TEST_FAILED` producing a `findings`/NCR row and a gate `BLOCKED` transition) are created as normal typed records in **D1**, linked through the existing **`edges`** table, and each state change produces an append-only, hash-chained **audit event** — identical to how requirement acceptance and gate decisions already write to the graph. The agent-service proposes; the Workers review/decision APIs persist. The agent's own Neo4j/NetworkX graph is a working/derivation structure only, never the authoritative provenance graph.
  - **Report artifacts** (the drafted ReportLab/python-docx test report, and any exported package) are stored as immutable objects in **R2**, referenced by hash from the D1 `evidence`/turnover-pack records, exactly like every other source object and export.
  - **`schedule_events`** emitted by the Supply Chain agent (`SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`) are ingested through the existing `POST /v1/projects/{id}/schedule/events` path: a delay lands as `schedule_events.event_type = 'shipment_delayed'` and a recovery lands as the distinct `schedule_events.event_type = 'shipment_recovered'` (an enum value Schema.md already defines), both flowing through the same unchanged event → delta-detector → CP-SAT re-solve pipeline. A recovery clears the stale alert and may trigger a re-solve to pull dates back in. No new downstream solver logic is introduced; the agent is simply another producer of existing event types.
  - **Citations/provenance.** Standards excerpts and shipment records the agents ingest are stored and cited through the same **`source_regions`** discipline as the rest of the platform, so every agent-surfaced claim resolves to a source region + content hash.
- **Net effect.** From the platform's point of view, the two agents are peers of the solver microservice: external, stateless-with-respect-to-authoritative-state Python services that the Workers core calls and whose results it deterministically persists into D1/R2/the typed graph under the existing review, audit, and citation rules.

**Consequences already flagged — hackathon-local-only vs. genuinely committed:**

| Consequence | Status |
|---|---|
| **Chroma alongside Vectorize** (a second RAG store) | **Hackathon-local-only** as a *duplication*: the agents run their own Chroma locally because the whole hackathon build is localhost-only (per the existing Q12 assumption). A pilot/production reconciliation would decide whether the agents' RAG consolidates onto Vectorize or whether Chroma is retained; that choice is deferred, not committed. |
| **Neo4j/NetworkX alongside D1** (a second graph store) | **Hackathon-local-only** as an authoritative store: D1 + the `edges` table remain the single source of truth for provenance; Neo4j/NetworkX is the agents' *internal working graph* only. Whether a graph DB is retained in production is deferred. |
| **Direct Gemini SDK calls outside the `ModelProvider` boundary** | **Genuinely committed for these two agents** by explicit user override — this is the crux of the divergence. The schedule module's Gemini use remains behind `GeminiModelProvider`; these two agents deliberately do not. A future consolidation behind `ModelProvider` is possible but is not committed here. |
| **In-process `asyncio` event bus vs. Workflows/Queues** | **Hackathon-local-only.** The in-process bus is a demo-scoped transport; the platform's durable transport (Workflows/Queues) remains the production path, and the agents' emitted events reach the durable schedule pipeline through the Workers `schedule/events` endpoint regardless. Durable, replayable orchestrator transport is explicitly not-yet-settled (see the orchestrator event contract below). |

This split is consistent with the existing localhost-only hackathon-build assumption: the *duplicated stores* (Chroma, Neo4j) and the *in-process bus* are local-demo conveniences that a pilot must reconcile, while the *direct-Gemini override* is the one genuinely-committed architectural divergence the user has accepted for these agents.

### Orchestrator event contract (emerging design)

The full orchestrator agent remains **to be defined later** — its durable transport, routing rules, and replay/ordering semantics are explicitly **not-yet-settled** and are out of scope for this TRD. What *is* pinned down by the two agent designs, and recorded here as emerging design, is the **event contract** the orchestrator must eventually carry. Three event types are defined:

| Event type | Emitted by | Emit condition | Payload (per StructuredPlan/PRD) |
|---|---|---|---|
| `TEST_FAILED` | Commissioning QA Copilot | A deterministic acceptance check classifies a step `proposed_fail` (numeric/threshold or boolean/presence). Narrative/qualitative steps route to `needs_human_review` and never emit this event. | Affected test/step, the accepted acceptance criterion and the recorded reading that failed it, affected `gate`, affected `asset`/equipment, source-region citation. Consumed to create a `findings` (NCR) record and set the gate `BLOCKED`. |
| `SHIPMENT_DELAYED` | Supply Chain Visibility & Risk Agent | A shipment's deterministic R/A/G status **changes** into at-risk (🟡) or delayed (🔴). | Affected equipment, old/new ETA, delay days, reason (weather factor / AIS lag / manual port-congestion flag), and affected schedule task(s). |
| `SHIPMENT_RECOVERED` | Supply Chain Visibility & Risk Agent | A previously at-risk/delayed shipment's status **changes** back to on-time (🟢). | Affected equipment, recovered ETA, and affected schedule task(s); clears the prior stale alert. |

**Dedup rule (shared).** Events are emitted on a **status CHANGE only**, never on every poll cycle. The Supply Chain agent polls AIS on a ~30s interval; each shipment's last-notified status is retained, and an emission fires only when the newly-computed status differs from the last-notified one. This prevents 30-second poll spam into the schedule pipeline (one `SHIPMENT_DELAYED` per transition into at-risk/delayed, one `SHIPMENT_RECOVERED` per transition back to on-time, zero duplicate emits within an unchanged-status window). The Commissioning agent's `TEST_FAILED` is inherently edge-triggered (one per `proposed_fail` step verdict) and carries the same "state change, not re-assertion" intent.

**Fan-out rule (persistence of multi-task payloads).** The `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` payload may reference multiple affected schedule task(s), but `schedule_events.schedule_task_id` is a single FK: a delay (or recovery) affecting N schedule tasks persists as **N `schedule_events` rows — one per affected task** — with the affected tasks resolved via the shipment's `AFFECTS` edges. The status-change-only dedup rule applies **per shipment**, not per row: one genuine status transition yields exactly one fan-out set of N rows, never N per poll cycle.

**Mapping into the existing schedule pipeline.** `SHIPMENT_DELAYED` and `SHIPMENT_RECOVERED` map onto the existing `schedule_events` record types: a delay lands as `event_type = 'shipment_delayed'` and a recovery lands as the distinct `event_type = 'shipment_recovered'` (Schema.md already defines this enum value). The agent posts the event through `POST /v1/projects/{id}/schedule/events`, the **delta detector** checks the affected task(s) against the current `schedule_version`'s critical path and downstream dependencies, and — only if the critical path or a downstream dependency is affected — a warm-started **CP-SAT re-solve** produces a new immutable `schedule_version`. Unaffected events update only the task's actual status/date with no new version. A recovery clears the prior stale alert and may itself trigger a re-solve to pull dates back in. This is the same delta-detector → re-solve pipeline already specified; the Supply Chain agent is a new *producer* of existing event types, requiring no new downstream solver logic. `TEST_FAILED` does not enter the schedule pipeline; it enters the evidence-graph pipeline (findings + gate `BLOCKED`).

**Command Center (emerging).** StructuredPlan anticipates a unified "Command Center" alert surface that cross-links a triggering event to its downstream gate/finding/schedule impact. Its rendering reads from the existing `schedule_events`, `findings`, `edges`, and `audit_events` records the agents already write; the *durable orchestrator that would route and replay these events centrally* is the not-yet-settled piece.

## System Architecture Overview

> An architecture diagram will be generated separately via `/diagram`.

```mermaid
flowchart LR
  User[Engineer / Owner / Vendor / Scheduler] --> PWA[Next.js PWA]
  PWA --> API[Cloudflare Worker API]
  API --> Auth[Better Auth]
  API --> D1[(D1 relational data)]
  API --> R2[(R2 source objects)]
  API --> Search[FTS5 + Vectorize]
  API --> Jobs[Workflows + Queues]

  Jobs --> AI[Workers AI ModelProvider]
  AI --> Extract[Validated requirement extraction]
  Extract --> Review[Human review queue]
  Review --> D1
  D1 --> Rules[Deterministic readiness engine]
  Rules --> Board[Readiness + blast-radius views]
  D1 --> Export[Evidence-pack exporter]
  R2 --> Export

  Jobs --> GeminiAI[Gemini ModelProvider]
  GeminiAI --> SchedExtract[Schedule task/resource extraction]
  SchedExtract --> SchedReview[Human review queue]
  SchedReview --> D1

  D1 --> Delta[Delta detector]
  SchedEvent[Schedule event: shipment / approval / weather] --> Delta
  Delta -->|no critical-path impact| D1
  Delta -->|impacts critical path| Solver[CP-SAT solver microservice]
  Solver --> SchedVersion[(Immutable schedule version store)]
  SchedVersion --> GeminiAI2[Gemini ModelProvider: explainer]
  GeminiAI2 --> SchedExplain[Re-solve explanation]
  SchedExplain --> SchedVersion
  SchedVersion --> ScheduleBoard[Schedule / critical-path view]
  SchedVersion -.cross-link via edges.-> Board

  API --> CxAgent[Commissioning QA Copilot service: Python/FastAPI, Chroma, Neo4j, Gemini SDK]
  CxAgent -->|drafts + verdicts| API
  CxAgent -->|TEST_FAILED| D1
  CxAgent -->|report artifact| R2

  API --> ScAgent[Supply Chain Risk service: Python/FastAPI, AIS/Open-Meteo, turfpy]
  ScAgent -->|SHIPMENT_DELAYED / RECOVERED| SchedEvent
```

All tenant and project access passes through the Worker API. AI jobs (Workers AI for evidence, Gemini for schedule) can only propose typed records; only the review API can transition a proposal to `ACCEPTED`. The readiness engine and the CP-SAT solver are the two deterministic engines in the system — neither calls a language model, and neither can be bypassed by one. The two integrated agent-services (Commissioning QA Copilot, Supply Chain Visibility & Risk) sit outside the Workers isolate as separate Python services, reached through the Worker API and landing their durable outputs (findings, evidence, report artifacts, `schedule_events`) back into D1/R2/the typed graph under the same review, audit, and citation rules — the same integration posture as the CP-SAT solver microservice.

### Evidence control-plane flow (unchanged)

Upload → hash/version → extraction to `source_region`/requirement proposals → human review → typed graph edges → deterministic readiness engine → decisions/export. See "Functional Requirements — Evidence Graph and Readiness" below.

### Schedule module flow

1. **Extraction agent:** a Workflow job (triggered by uploading a vendor contract, timeline, PO, or approval document to `POST /v1/projects/{id}/schedule/documents`) runs RAG over the document's `source_region`s via the Gemini `ModelProvider` adapter, proposing schema-validated `schedule_task` and `resource` records (name, duration, dependencies, vendor, lead time, resource requirement, hard/soft deadline type, crew/equipment counts). Any missing or ambiguous field is flagged `NEEDS_REVIEW` and is never silently defaulted.
2. **Human review:** a reviewer accepts, edits, or rejects each proposed task/resource record via `POST /v1/schedule/tasks/{id}/review` and `POST /v1/schedule/resources/{id}/review`. Only `ACCEPTED` records are eligible for solving.
3. **DAG assembly and cycle check:** accepted tasks and their dependency edges are assembled into a DAG (stored via the existing `edges` table with schedule-specific relationship types alongside `PRECEDES`/`REQUIRES`). A cycle is detected and blocks solving with an explicit, human-actionable error before any CP-SAT call is made.
4. **Baseline solve:** `POST /v1/projects/{id}/schedule/baseline` triggers a Workflow that calls the CP-SAT solver microservice with the DAG, resource capacities, and deadline constraints. A feasible result (or an explicit infeasibility + bottleneck report) is stored as immutable `schedule_version` `v1`.
5. **Delta detector:** `schedule_event` records (shipment received/delayed, approval granted/rejected, weather delay) reported via `POST /v1/projects/{id}/schedule/events` are checked against the current critical path and downstream dependencies. If unaffected, only the task's actual status/date is updated (no new version). If affected, a Workflow step calls the solver microservice warm-started from the current version with completed tasks fixed, producing a new immutable `schedule_version`.
6. **Explainer agent:** after any re-solve, a Workflow step sends the before/after task-date diff to the Gemini `ModelProvider` explainer, which returns a human-readable summary (triggering event, shifted tasks, net deadline impact) stored against that schedule version. The explainer never alters any date — it only narrates the diff the solver already produced.
7. **Cross-linking, not readiness-folding:** schedule tasks reference `systems`/`assets`/`gates` via the existing `edges` table (e.g., a critical-path task `PRECEDES`/`AFFECTS` a gate). The gate view surfaces linked schedule/delay status as context; it never feeds the deterministic readiness computation.

### Commissioning QA Copilot flow

The Commissioning Quality Assurance Copilot is a separate Python/FastAPI agent-service that guides a data-centre commissioning engineer through IST execution for the bounded pilot (chilled water plant, L4 IST gate) and lands its durable outputs into the evidence graph. It **extends, not duplicates**, the existing evidence-graph pipeline: drafted test records become `evidence`, a `TEST_FAILED` creates a `findings`/NCR row and a gate `BLOCKED` transition through the existing typed-graph + audit-event pattern (Core Workflow steps 4–6), and requirement-modality tiering mirrors the platform's existing tiered evaluation.

1. **Standards + procedure ingestion (RAG-over-standards):** commissioning standards (synthetic, clearly-labelled excerpts — no licensed TIA-942/BICSI/Uptime text) and pre-defined/user-uploaded test procedures are ingested into the agent's **Chroma** RAG store with clause/section metadata and source citations. Embeddings use **Gemini embeddings** (direct SDK, per the accepted override); citations are carried as `source_regions` so every downstream clause reference resolves to a source region + content hash. Ingestion runs before any checklist generation (US-13 precondition).
2. **Draft checklist generation:** the engineer selects system + gate + equipment + standard set; the agent RAG-generates (Gemini 2.5 Flash) a **draft** structured checklist — steps, acceptance criteria, cited clauses — validated against a checklist JSON schema. A malformed/schema-invalid checklist is rejected with a clear error and routed for retry/human review rather than partially rendered. The draft is never treated as an accepted or authoritative test procedure until an engineer reviews it.
3. **Citation-verification post-step:** every LLM-generated clause citation is verified against ingested-corpus metadata **after generation**. A citation whose clause ID has no matching ingested clause is flagged as a possible hallucination and never shown as verified (US-13, Edge Cases). This is a deterministic post-generation check, not an LLM self-assessment.
4. **Guided step execution:** the engineer executes steps and enters per-step field readings; each reading records who entered it and when, and step state/readings persist and are resumable without loss (US-14). The React 19 step-execution UI (Tailwind/Zustand/TanStack Query) drives this surface.
5. **Deterministic acceptance-check engine vs. LLM narrative path:** each step is classified by modality —
   - **Numeric/threshold** and **boolean/presence** steps are classified `proposed_pass`/`proposed_fail` by **deterministic** value/unit/tolerance and presence/absence comparison against the acceptance criterion, with **no LLM involvement in the verdict** (US-15). This mirrors the Specification & Quality Compliance Agent's numeric/boolean evaluation tiers.
   - **Narrative/qualitative** steps ("corrosion resistant", "suitable for outdoor use") are **always** classified `needs_human_review` and never auto-determined; an LLM narrative comparison may surface a "possible mismatch" as a suggestion only, always routed to mandatory human review (US-15, Constraints). The LLM never judges conformance on qualitative criteria.
6. **`TEST_FAILED` → findings/gate-BLOCKED:** a `proposed_fail` emits a `TEST_FAILED` event (see orchestrator event contract). Consumed through the Workers core, it creates a `findings` (NCR) record via the existing typed-graph + audit-event pattern and sets the affected gate `BLOCKED`, with the finding linked to the gate and the block recorded as an audit event (US-16).
7. **Report drafting:** the agent auto-drafts a test report (**ReportLab/python-docx**) labelled **"DRAFT — PENDING ENGINEER REVIEW"** for engineer edit/approve/export; export is possible only after approval (US-17). The rendered report artifact is stored as an immutable object in R2 and referenced by hash from the D1 evidence record.
8. **Evidence + turnover linkage, advisory boundary:** on approval, the test record is created as `evidence`, linked to its gate, and added to the turnover/evidence pack (US-18). **A completed all-pass test sets the gate to `PENDING_REVIEW`, never `READY`** — only an authorized approver transitions a gate further. The agent cannot certify, close an NCR, grant a waiver, or sign a test. Checklists, acceptance assessments, and reports are all proposals; deterministic acceptance verdicts and the human-review routing are the only mechanisms that set step state.

### Supply Chain Visibility & Risk flow

The Supply Chain Visibility & Risk Agent is a separate Python/FastAPI agent-service that performs **single-leg (origin→destination)** geospatial tracking of critical equipment shipments (UPS, generators, cooling towers, switchgear) and emits deduplicated delay/recovery events into the existing schedule pipeline. All delay/ETA/status math is **deterministic threshold math, never LLM output**; the agent surfaces risk only and does not reschedule, change gate status, select vendors, or modify POs.

1. **Shipment records:** each record links equipment, origin/destination coordinates, MMSI, planned ETA, and required-on-site date, ingested via CSV / manual UI / optional ERP (synthetic/anonymized only for the hackathon). Port congestion is a **manual boolean flag** (no free live feed); planned transit duration defaults to a configurable placeholder when absent.
2. **AIS ingestion with simulated fallback:** the agent polls live AIS vessel position from **aisstream.io** over a `websockets` connection (~30s). When AIS is unavailable, it falls back to a **great-circle interpolated** position via **`turfpy`**; every position is transparently labelled **live vs. simulated** (US-19, Edge Cases). AIS lag/unavailability degrades gracefully to the simulated track rather than blocking.
3. **Weather fetch with graceful degradation:** weather is fetched (**`httpx`** to **Open-Meteo**) at origin, current position, and destination. If Open-Meteo is unavailable, the deterministic delay factor **defaults to 0** (no weather adjustment) rather than blocking or guessing an ETA (US-20, Edge Cases).
4. **Deterministic delay-factor + status engine:** a **deterministic additive delay-factor heuristic** applies a multiplier to *remaining transit duration* (not a raw day-count) to compute a weather-adjusted ETA, labelled an estimate and never a guaranteed delivery date; no LLM produces the ETA value (US-20). Status is classified against required-on-site-date minus a configurable buffer: 🟢 on-time / 🟡 at-risk / 🔴 delayed (US-21). All of this is threshold math.
5. **Map + navigator UI:** shipments, routes, and weather render on a **Leaflet/React-Leaflet** map (OpenStreetMap tiles, ODbL, attributed) with a click-to-zoom navigator table (US-22).
6. **Event emission with dedup:** on a status **change** into at-risk/delayed, the agent emits `SHIPMENT_DELAYED` (affected equipment, old/new ETA, delay days, reason, affected tasks), **deduplicated against the last-notified status** to prevent 30s poll spam; a return to on-time emits `SHIPMENT_RECOVERED` to clear the stale alert (US-23, and the orchestrator event contract above). A delay lands as `schedule_events.event_type = 'shipment_delayed'` and a recovery lands as the distinct `event_type = 'shipment_recovered'`; both flow through the same existing event → delta-detector → CP-SAT re-solve pipeline with no new downstream solver logic, and a recovery may trigger a re-solve to pull dates back in. The Predictive Schedule Risk Engine may consume the same events as a polling signal source.

### Functional Requirements

**Ingestion and Provenance** (shared by both modules)
- `POST /v1/projects/{project_id}/documents` (evidence) and `POST /v1/projects/{id}/schedule/documents` (schedule sources) both compute SHA-256, store the original in R2, create `document`/`document_version` records, and reject unsupported type/size before processing.
- Extraction creates `source_region` records with page number, optional bounding box, extracted text, and source hash — used as the citation both for requirement proposals and for schedule task/resource proposals.
- A document version identifies whether it is `DRAFT`, `APPROVED`, `SUPERSEDED`, or `REJECTED`.
- Commissioning standards excerpts and test procedures ingested by the Commissioning QA Copilot carry the same `source_regions` citation discipline (clause/section metadata + content hash), so every agent-surfaced clause reference resolves to a source region; shipment records ingested by the Supply Chain agent likewise carry their originating record reference.

**Requirement Review** (unchanged) — schema-validated proposals with source-region references, confidence, normalized value, unit, review state; only `ACCEPTED` requirements affect readiness.

**Evidence Graph** (unchanged) — systems, assets, gates, requirements, evidence, test procedures/steps/runs, findings, decisions, and typed edges are project-scoped; an edge must reference existing records in the same project and use an allowed relationship type; superseding evidence propagates `STALE`. Commissioning QA Copilot outputs enter this graph unchanged: a drafted test record becomes `evidence` on approval, a `TEST_FAILED` creates a `findings` row and a gate `BLOCKED` transition, all through the existing typed-edges + audit-event pattern; the agent's own Neo4j/NetworkX graph is an internal working structure, never the authoritative provenance graph.

**Readiness** (unchanged) — the engine evaluates mandatory accepted requirements/evidence, predecessor gate approval, absence of open blocking findings, passed test runs, and approval signature, returning `READY`/`BLOCKED`/`IN_REVIEW`/`UNKNOWN` with categorized blockers. It has zero model-provider or network imports and never reads schedule state. A completed all-pass Commissioning test sets its gate to `PENDING_REVIEW`, never `READY`; the readiness engine is unaffected by agent output beyond the accepted evidence/finding records that pass through human acceptance.

**Schedule Extraction and Review**
- The extraction Workflow emits schema-validated `schedule_task` and `resource` proposals with source-region references, confidence, and review state, identical in spirit to requirement proposals.
- The review API supports accept/edit/reject with actor and timestamp; only `ACCEPTED` tasks/resources are included in a solve.
- Numeric fields (duration, lead time, crew/equipment counts) pass schema/unit validation before acceptance; ambiguous or missing fields route to mandatory review and are never auto-accepted.

**Delta Detection and Solve**
- The delta detector reads the current `schedule_version`'s critical path and dependency structure to decide whether an incoming `schedule_event` requires a re-solve.
- Concurrent events against the same task are serialized; the second event's delta check and (if triggered) re-solve runs against the already-updated state.
- An event referencing a task absent from the current schedule version is rejected with an explicit error.
- The solver microservice call is idempotent per `(schedule_version_id, event_id)` so Workflow retries cannot double-apply a re-solve.
- `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` events emitted by the Supply Chain agent enter this same detector: a delay lands as `schedule_events.event_type = 'shipment_delayed'` and a recovery lands as the distinct `event_type = 'shipment_recovered'`, both through the same event → delta-detector pipeline; a recovery clears the stale alert and may trigger a re-solve to pull dates back in. Because `schedule_events.schedule_task_id` is a single FK, a delay or recovery affecting N schedule tasks persists as N `schedule_events` rows (one per affected task), resolved via the shipment's `AFFECTS` edges; the agent's status-change dedup applies per shipment, not per row, guaranteeing at most one fan-out set per genuine transition, so the detector is not driven by ~30s poll noise.

**Commissioning Acceptance Checks and Reporting**
- Each executed step is classified by modality: numeric/threshold and boolean/presence steps produce a `proposed_pass`/`proposed_fail` verdict by deterministic comparison only; narrative/qualitative steps are always `needs_human_review` and never auto-determined.
- Every LLM-generated clause citation is verified against ingested-corpus metadata post-generation; unverifiable citations are flagged, never shown as verified.
- A `proposed_fail` emits `TEST_FAILED`, which creates a `findings` (NCR) record and sets the affected gate `BLOCKED`, each recorded as an audit event.
- The drafted report is labelled "DRAFT — PENDING ENGINEER REVIEW"; edit/approve/export is engineer-driven and export is gated on approval. On approval the test record is created as `evidence`, linked to its gate, added to the turnover pack, and the all-pass gate state is `PENDING_REVIEW`, never `READY`.

**Supply Chain Tracking and Eventing**
- Live AIS position is polled and displayed; on AIS unavailability, a great-circle interpolated position is shown and labelled simulated rather than live.
- The weather-adjusted ETA is a deterministic additive delay-factor multiplier on remaining transit duration; on Open-Meteo unavailability the factor defaults to 0. The ETA is labelled an estimate, never a guaranteed delivery date, and no LLM produces it.
- Status is classified 🟢/🟡/🔴 deterministically against required-on-site-date minus a configurable buffer and never itself reschedules, changes gate status, selects vendors, or modifies POs.
- Delay/recovery events are emitted on status change only, deduplicated against the last-notified status, and posted through the existing schedule events endpoint.

**Explainability**
- Every `schedule_version` beyond `v1` has an associated Gemini-generated explanation identifying the triggering event, shifted tasks, and net deadline impact, clearly labelled as AI-generated.
- Explainer failures/timeouts leave the prior schedule version and status untouched and surface a retryable error.

**Decisions and Export** (unchanged) — approval/rejection/waiver require the configured role and reason; export jobs produce a manifest of record identifiers, source hashes, audit-event hashes, and rule/model versions (extended to include the CP-SAT solver version and Gemini model version when a schedule snapshot is included in an export). Approved Commissioning test records included in a turnover pack contribute their evidence identifiers, report-artifact hash, and the agent's model version to the same manifest.

### Data Storage and Retrieval

- D1 stores normalized entities and typed edges, extended with `schedule_tasks`, `schedule_versions`, `resources`, and `schedule_events`. Foreign keys, project identifiers, enum checks, and timestamps are enforced at the database layer for both evidence and schedule tables. Commissioning test records/findings/evidence and Supply Chain `schedule_events` land in these same D1 tables through the Workers core — the agents' Chroma/Neo4j stores hold only their local RAG vectors and internal working graphs, never authoritative platform state.
- R2 stores immutable source objects (including vendor contracts/timelines/POs/approval docs and drafted/approved Commissioning test-report artifacts) and generated exports.
- FTS5 indexes source text, normalized requirements, assets, findings, and schedule task names/vendors for exact/citation search. Vectorize is used only internally (extraction/classification matching for both requirements and schedule tasks), never as user-facing semantic search. The Commissioning agent's Chroma store is a separate, agent-local RAG index over synthetic standards/procedures and does not replace or feed the platform's FTS5/Vectorize retrieval.
- Each `schedule_version` is stored as a complete, immutable snapshot (task dates, critical path, solver status) plus a pointer to its predecessor and triggering `schedule_event`, never as an in-place mutation of a shared "current schedule" row — mirroring the existing "no authoritative readiness value stored as an unversioned mutable flag" rule.
- Readiness continues to be calculated only from accepted evidence-side records and is never invalidated or recalculated by schedule-version changes.

### Security (carried forward, extended)

- Better Auth sessions use secure, HTTP-only cookies; TOTP is required for approver roles. No new auth mechanism is introduced for the schedule module or the two agent-services — the same project-scoped RBAC roles (e.g., project scheduler/planner, commissioning engineer) gain scoped permissions, and the Worker API remains the single authenticated front door that proxies to the agent-services.
- Every query, including schedule tables, includes tenant and project predicates; object URLs are short-lived signed URLs.
- TLS is required for all network traffic, including calls from a Workflow step to the solver microservice and from the Worker API to the two agent-services; each agent-service accepts only authenticated, internal-network requests (no public ingress) and receives no tenant-identifying data beyond what its operation requires — the same posture as the solver microservice.
- Gemini prompt inputs (for schedule extraction/explanation, and for the Commissioning agent's checklist/report generation) are project-scoped, redacted for configured personal data, and excluded from shared training, identical to the Workers AI evidence-extraction path. The Commissioning agent's direct-Gemini calls (outside the `ModelProvider` boundary, per the accepted override) are still bound by these same project-scoping and no-shared-training rules.
- Audit events remain append-only and hash-chained; schedule version creation, task acceptance/rejection, event ingestion, Commissioning test acceptance/failure, and gate `BLOCKED` transitions each produce an audit event.

## API Design

All endpoints require authentication unless stated otherwise. Error bodies use `{ "code": string, "message": string, "request_id": string }`.

### Evidence control plane (unchanged)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects` | `{name, code, timezone, retention_days}` | `201 {project}` | `400, 401, 409` |
| `GET` | `/v1/projects/{id}` | none | `200 {project, role}` | `401, 403, 404` |
| `POST` | `/v1/projects/{id}/documents` | multipart file plus `{document_type, revision}` | `202 {job_id, document_version_id}` | `400, 401, 403, 413, 415` |
| `GET` | `/v1/projects/{id}/requirements` | query filters and cursor | `200 {items, next_cursor}` | `401, 403, 404` |
| `POST` | `/v1/requirements/{id}/review` | `{action, normalized_value?, unit?, reason?}` | `200 {requirement}` | `400, 401, 403, 409` |
| `POST` | `/v1/projects/{id}/edges` | `{from_type, from_id, to_type, to_id, type}` | `201 {edge}` | `400, 401, 403, 409` |
| `GET` | `/v1/projects/{id}/gates/{gate_id}/readiness` | none | `200 {state, blockers, evaluated_at, rule_version}` | `401, 403, 404` |
| `POST` | `/v1/projects/{id}/issues` | `{title, severity, owner_id, due_at, ...}` | `201 {finding}` | `400, 401, 403` |
| `POST` | `/v1/gates/{id}/decisions` | `{action, reason, evidence_baseline}` | `201 {decision}` | `400, 401, 403, 409` |
| `POST` | `/v1/projects/{id}/exports` | `{gate_id, format}` | `202 {export_job_id}` | `400, 401, 403, 409` |
| `GET` | `/v1/exports/{id}` | none | `200 {status, download_url, manifest_hash}` | `401, 403, 404, 410` |

### Schedule management (new)

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

### Commissioning QA Copilot (new — proxied to the agent-service)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/cx/standards` | multipart file plus `{standard_set, doc_type: standard\|procedure, revision}` | `202 {ingest_job_id, document_version_id}` | `400, 401, 403, 413, 415` |
| `POST` | `/v1/projects/{id}/cx/checklists` | `{system_id, gate_id, equipment_id, standard_set[]}` | `202 {checklist_job_id}` | `400, 401, 403, 409` (`409` on malformed/schema-invalid draft routed to review) |
| `GET` | `/v1/cx/checklists/{id}` | none | `200 {checklist_id, steps[], acceptance_criteria[], cited_clauses[], citation_verification[], status}` | `401, 403, 404` |
| `POST` | `/v1/cx/checklists/{id}/steps/{step_id}/reading` | `{readings, entered_by, entered_at}` | `200 {step, verdict: proposed_pass\|proposed_fail\|needs_human_review}` | `400, 401, 403, 409` |
| `POST` | `/v1/cx/checklists/{id}/report` | `{}` (drafts report from executed steps) | `202 {report_job_id}` | `400, 401, 403, 409` |
| `GET` | `/v1/cx/reports/{id}` | none | `200 {report_id, status: draft\|approved, artifact_url, label}` | `401, 403, 404` |
| `POST` | `/v1/cx/reports/{id}/approve` | `{reason}` | `200 {report, evidence_id, gate_state}` | `400, 401, 403, 409` |

### Supply Chain Visibility & Risk (new — proxied to the agent-service)

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/v1/projects/{id}/shipments` | `{equipment_id, origin, destination, mmsi, planned_eta, required_on_site, port_congested?}` | `201 {shipment}` | `400, 401, 403, 409` |
| `GET` | `/v1/projects/{id}/shipments` | query filters and cursor | `200 {items: [{shipment_id, position, position_source: live\|simulated, weather_adjusted_eta, status}], next_cursor}` | `401, 403, 404` |
| `GET` | `/v1/shipments/{id}` | none | `200 {shipment_id, position, position_source, route[], weather[], weather_adjusted_eta, status, last_notified_status}` | `401, 403, 404` |

## Non-Functional Requirements

| Requirement | Target and verification |
|---|---|
| API latency | p95 <= 500 ms for authenticated project reads under 100 concurrent users, excluding ingestion, export, and schedule-solve jobs. |
| Readiness calculation | p95 <= 2 seconds for a gate with up to 10,000 related edges and 2,000 evidence records. |
| Availability | 99.5% monthly availability for the pilot API and web application, excluding planned maintenance. |
| Ingestion durability | A successfully acknowledged source upload (evidence or schedule document) is retrievable by hash after worker restart or retry. |
| Citation integrity | 100% of accepted AI proposals and surfaced findings — including schedule task/resource proposals and Commissioning clause citations — contain a resolvable source-region reference. |
| Authorization | Every project-scoped read and write, including schedule and agent-service endpoints, checks tenant and project membership before data access. |
| Auditability | Every approval, role change, evidence state change, readiness decision, schedule task/resource review, schedule version creation, Commissioning test acceptance/failure, and gate `BLOCKED` transition produces an append-only audit event. |
| Accessibility | Core review, blocker, approval, schedule review/critical-path, and Commissioning step-execution flows pass automated axe checks and keyboard navigation tests. |
| Recovery | Daily database backup/export and documented restore procedure achieve RPO <= 24 hours and RTO <= 8 hours for the pilot, covering schedule tables. |
| Data retention | Project data follows a configured retention period; deletion produces an auditable deletion event and removes source objects, including schedule documents and versions. |
| **Baseline solve latency** | p95 <= 60 seconds for a DAG of up to 500 tasks and 50 resource types; solver microservice call has an explicit request timeout (configurable default 90 seconds). |
| **Re-solve latency** | p95 <= 30 seconds for a warm-started re-solve (completed tasks fixed) on the same DAG size, measured from event ingestion to new schedule version being queryable. |
| **Solver timeout/fallback** | On solver-service timeout or error, the Workflow step retries with backoff (bounded attempts); on exhausted retries, the prior schedule version and task statuses remain unchanged, the event is marked `SOLVE_FAILED` for manual retry, and no partial/inconsistent schedule version is ever persisted. |
| **Explainer latency** | 100% of successful re-solves that affect the critical path produce a corresponding explanation within the same processing job (per PRD success metric); explainer failure never blocks or reverts the already-persisted schedule version. |
| **Schedule version audit** | Every `schedule_version` is immutable once written and hash-linked to its predecessor and triggering event, enabling full before/after reconstruction for audit; version records are never updated or deleted, only superseded by a new version. |
| **Infeasibility reporting** | 100% of solver invocations (golden-set tested) return either a feasible schedule or an explicit `{overrun_days, bottleneck_constraint}` report — zero silent failures or unexplained non-results. |
| **Commissioning acceptance determinism** | 100% of numeric/threshold and boolean/presence step verdicts are produced by deterministic comparison with zero LLM involvement; 100% of narrative/qualitative steps route to `needs_human_review`; every LLM-generated clause citation is verified against ingested-corpus metadata and unverifiable citations are flagged, never shown as verified. |
| **AIS lag / fallback** | On AIS unavailability or stale position, the shipment position degrades to great-circle interpolation, transparently labelled simulated (never presented as a live fix); AIS reconnection resumes live positions without losing the shipment record. |
| **Open-Meteo outage handling** | On Open-Meteo unavailability or timeout, the deterministic delay factor defaults to 0 (no weather adjustment) and the ETA is still returned as a labelled estimate — the agent never blocks or guesses an ETA on a weather-fetch failure. |
| **Shipment event dedup** | Golden-set tested: exactly one `SHIPMENT_DELAYED` per transition into at-risk/delayed, exactly one `SHIPMENT_RECOVERED` per return to on-time, and zero duplicate emits within an unchanged-status ~30s poll window. |
| **Event-bus durability caveat** | The in-process `asyncio` event bus used by the agent-services is a hackathon-local demo transport with no durability/replay guarantee; durable delivery of agent-emitted events into the schedule pipeline is provided by posting through the Workers `schedule/events` endpoint (backed by Workflows/Queues), which remains the production path. A durable, replayable orchestrator transport is a not-yet-settled production requirement. |

## Third-Party Integrations

| Integration | Purpose | Failure behavior |
|---|---|---|
| Cloudflare R2 | Source and export storage (evidence and schedule documents, Commissioning report artifacts) | Upload remains pending and retries; readiness/solving does not advance without retrievable source evidence. |
| Workers AI / BYOK provider | Evidence extraction and classification proposals | Job enters `AI_REVIEW_REQUIRED` or `FAILED`; existing accepted data and readiness remain unchanged. |
| **Gemini API** | Schedule task/resource extraction and re-solve explanation (via `GeminiModelProvider`), and — via a direct SDK under the accepted agent-stack override — the Commissioning QA Copilot's checklist/report generation and Gemini embeddings. For the schedule module, chosen because the plan specifies Gemini rather than Workers AI/Claude and because Gemini's long-context RAG handling suits multi-document contract/timeline extraction; using the `ModelProvider` abstraction avoids coupling schedule logic to this one vendor. For the Commissioning agent, the direct-SDK use is a committed per-agent override (see Divergence). | Schedule extraction job enters `NEEDS_REVIEW` or `FAILED` on error/timeout; a failed explanation leaves the already-solved schedule version untouched. Commissioning checklist/report generation failures leave no accepted record — a malformed/schema-invalid draft is rejected and routed to human review, never partially rendered. |
| **CP-SAT (Google OR-Tools), run in a dedicated solver microservice** | Deterministic baseline and re-solve computation (precedence, resource-capacity, deadline constraints; deadline-overrun-first/idle-time-second objective) — chosen over a hand-written scheduling heuristic (Library-First Rule) and over a WASM-in-Worker build (see Tech Stack justification) for correctness, maintainability, and freedom from Workers CPU/size limits. | On timeout/error, the Workflow step retries with backoff; on exhausted retries, the event is marked `SOLVE_FAILED`, the prior schedule version is untouched, and the failure is surfaced for manual retry — never a silently approximated schedule. |
| **aisstream.io (AIS)** | Live AIS vessel position for single-leg shipment tracking (Supply Chain agent), free-tier/non-commercial for the hackathon; production requires a persistent single-socket AIS feed. | On unavailability/lag, position falls back to `turfpy` great-circle interpolation, labelled simulated; the shipment record and status math continue on the interpolated track. |
| **Open-Meteo (weather)** | Weather at origin, current position, and destination for the deterministic weather-adjusted ETA (Supply Chain agent), free-tier/non-commercial; production requires licensed weather. | On outage/timeout, the deterministic delay factor defaults to 0; the ETA is still returned as a labelled estimate, never blocked or guessed. |
| Vectorize | Semantic retrieval (internal use only, evidence and schedule matching) | Falls back to FTS5; citations remain mandatory. |
| Resend | Invitations and notifications | Queue retries; users can continue in-app and admins see delivery failure. |
| PostHog | Product usage analytics | Drop analytics event; never block product workflow. |
| Sentry / OpenTelemetry sink | Operational diagnostics, including solver and agent-service call tracing | Buffer or drop telemetry; audit events remain in the product store. |

## Technical Constraints

- Initial pilots use controlled file imports and exports rather than native project-system or scheduling-tool (P6, Procore, Aconex, etc.) synchronization; this applies equally to schedule source documents and to schedule outputs (no native write-back of computed dates).
- Durable jobs must be retryable and idempotent; duplicate delivery cannot duplicate authoritative evidence, requirement acceptances, schedule task/resource acceptances, schedule versions, event applications, Commissioning test/finding records, or shipment delay/recovery events.
- **Model output cannot mutate readiness, approval state, or schedule dates/critical path/feasibility directly.** Only the deterministic readiness rules engine computes gate readiness, and only the deterministic CP-SAT solver computes schedule dates, critical path, and feasibility. The Gemini-backed extraction and explainer agents are used only for (a) proposing schema-validated task/resource records for human review and (b) narrating the solver's before/after diff in natural language — never for setting or overriding a date. The Commissioning QA Copilot's acceptance verdicts (numeric/boolean) and the Supply Chain agent's ETA/status are likewise deterministic threshold math, never LLM output.
- **Ambiguous or missing extraction fields must never be silently guessed or auto-accepted**, for requirement extraction, schedule task/resource-capacity extraction, or Commissioning checklist generation; they are routed to a mandatory human review queue (narrative/qualitative acceptance steps always to `needs_human_review`), with zero silent auto-acceptance as a measured success metric.
- **Tenant/project isolation applies to all new schedule tables** (`schedule_tasks`, `schedule_versions`, `resources`, `schedule_events`) identically to existing tables — every read/write includes tenant and project predicates, and the solver microservice and the two agent-services are stateless with respect to authoritative state and receive no tenant-identifying data beyond what a given operation requires.
- Schedule entities are integrated into the existing typed-edges/provenance graph (via `edges` and `source_regions`), not built as a parallel disconnected data structure. Commissioning test records, findings, and evidence produced by the QA Copilot enter this same graph; the agent's Neo4j/NetworkX store is an internal working graph, never the authoritative provenance graph.
- Schedule/critical-path status is a separate, cross-linked view (via typed edges such as `PRECEDES`/`AFFECTS` to a gate) and must never be folded into or alter the deterministic gate readiness computation.
- Multi-mode task scheduling (duration varying by resource level) is out of MVP scope; every task has one fixed duration, and resource-capacity constraints only cap concurrent crew/equipment usage.
- Weather-delay events are modeled only as a discrete task-level event type flowing through the event → delta-detector → re-solve pipeline, never as a labor-capacity or calendar adjustment. This is distinct from the Supply Chain agent's Open-Meteo weather use, which adjusts a shipment ETA (a deterministic delay factor), not a labor calendar.
- A cycle detected in the accepted task dependency DAG blocks the CP-SAT solve with an explicit, human-actionable error before any solver call is made.
- The Commissioning QA Copilot and the Supply Chain Visibility & Risk Agent are advisory only: neither may certify, sign, close a gate, close an NCR, or grant a waiver. A completed all-pass Commissioning test sets its gate to `PENDING_REVIEW`, never `READY`; only an authorized approver transitions a gate.
- Standards and project content, and any vendor contract/timeline/PO/approval documents processed for scheduling, require customer authorization and appropriate licensing; no unlicensed TIA-942/BICSI/Uptime/client/vendor content in prompts, embeddings, templates, or demos. The Commissioning agent uses only small, clearly-labelled **synthetic** standards excerpts, swappable for a licensed corpus later without architectural change; the Supply Chain agent uses only synthetic/anonymized shipment records.
- **Stack override (accepted, reconciled above):** the Commissioning QA Copilot and Supply Chain Visibility & Risk Agent adopt a Python/FastAPI + Chroma + Neo4j/NetworkX + direct Gemini SDK + in-process `asyncio` stack, **overriding** the platform's committed Cloudflare-native/`ModelProvider`/Workers-AI stack for these two agents per user direction. Per the "Agent-services integration approach — accepted override" subsection, they are integrated as separate Python agent-services (the same pattern as the CP-SAT solver microservice), landing their durable outputs into D1/R2/the typed graph through the Workers core. Of the flagged consequences, the direct-Gemini-outside-`ModelProvider` divergence is genuinely committed for these agents; the duplicated stores (Chroma alongside Vectorize, Neo4j alongside D1) and the in-process event bus are hackathon-local-only conveniences a pilot must reconcile.
- **This build is a from-scratch prototype/MVP using synthetic/dummy commissioning and scheduling data**, with no confirmed design partner or licensed corpus at this stage, for all modules and both agents.
- **The SaaS-versus-private/self-hosted deployment profile is not decided at this stage** and must not be hardcoded as an assumption in any module's implementation; for this prototype, "self-hosted" is defined as strict tenant/data isolation within Cloudflare rather than true customer-premises deployment, and the solver microservice's and agent-services' own deployment targets (local Docker for the hackathon; a container platform for a pilot) are likewise not a commitment to a final production topology.
- The full orchestrator agent (durable transport, routing rules, replay/ordering) is **not settled** in this document; only its event contract (`TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED` — payloads, emit conditions, status-change dedup) is recorded as emerging design.
- Predictive (ML/statistical) schedule forecasting beyond the committed Predictive Schedule Risk Engine's advisory detection, multi-tier/multi-leg supplier visibility, live port-congestion feeds, geospatial route optimization, procurement-alternative modelling, drawing geometry comparison, broad RFI intelligence, live BMS/EPMS telemetry, multimodal photo/Gemini-Vision analysis, cross-project standards learning, and independent certification are not covered by this TRD.
