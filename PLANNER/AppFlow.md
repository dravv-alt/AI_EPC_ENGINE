# Pramana Cx Application Flow

## Primary User Flows

### Flow: Create Project and Configure Access
**Entry point:** Project List
1. The administrator opens `Create Project` and enters project name, code, timezone, and retention policy.
2. The app validates required fields and checks the project code for duplicates.
3. The administrator creates the project and lands on `Project Settings`.
4. The administrator invites members and assigns project roles.
5. The app records membership changes and shows the `Project Dashboard`.
**Exit point:** Project Dashboard with configured members.

```mermaid
flowchart TD
  A([Entry: Project List]) --> B[Create Project]
  B --> C{Valid project details?}
  C -- No --> D[Validation error]
  D --> B
  C -- Yes --> E[Project Settings]
  E --> F[Invite Members]
  F --> G{Invitation accepted by service?}
  G -- No --> H[Pending invitation / retry]
  H --> F
  G -- Yes --> I([Exit: Project Dashboard])
  E --> J{Session valid?}
  J -- No --> K([Exit: Login])
```

### Flow: Ingest and Review Requirements
**Entry point:** Project Dashboard
1. A reviewer opens `Source Library` and selects `Upload Source`.
2. The app validates file type, size, project membership, and revision metadata.
3. The upload enters `Processing Status` while the source is stored and extracted.
4. The reviewer opens `Requirement Review Queue` and selects a proposal.
5. The reviewer accepts, edits, or rejects the proposal with its source citation visible.
6. Accepted requirements appear in `Requirement Detail` and can be related to systems, assets, gates, and evidence.
**Exit point:** Accepted requirement available to the readiness engine, or rejected proposal retained for audit.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Source Library]
  B --> C[Upload Source]
  C --> D{File and revision valid?}
  D -- No --> E[Upload validation error]
  E --> C
  D -- Yes --> F[Processing Status]
  F --> G{Processing completed?}
  G -- No --> H[Pending / retry / failed status]
  H --> F
  G -- Yes --> I[Requirement Review Queue]
  I --> J[Requirement Detail]
  J --> K{Reviewer decision}
  K -- Accept --> L([Exit: Accepted Requirement])
  K -- Edit --> M[Edited Proposal]
  M --> J
  K -- Reject --> N([Exit: Rejected Proposal])
  J --> O{Session expired?}
  O -- Yes --> P([Exit: Login])
```

### Flow: Review Gate Readiness and Resolve Blockers
**Entry point:** Project Dashboard
1. The commissioning manager opens `Readiness Board` and selects a system and gate.
2. The app loads the current rules version and displays `READY`, `BLOCKED`, `IN_REVIEW`, or `UNKNOWN`.
3. The manager opens a blocker to view `Evidence Detail`, source citations, related assets, and owner.
4. The manager creates or updates an action in `Finding Detail` and assigns an owner and due date.
5. The owner uploads evidence or records a test result through `Field Capture` or `Test Run Detail`.
6. The readiness engine recalculates after processing and shows the changed blocker set.
7. The manager may also open the gate's linked `Schedule & Critical Path Board` context panel to see whether a feeding critical-path task is delayed; this is informational only and never changes the readiness state shown in step 2.
**Exit point:** The gate is ready for approval, or remains visibly blocked with assigned actions.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Readiness Board]
  B --> C[Select System and Gate]
  C --> D{Readiness state}
  D -- Ready --> E[Gate Review]
  D -- Blocked --> F[Blocker Detail]
  D -- In Review --> G[Review Queue]
  D -- Unknown --> H[Missing Source / Configuration]
  F --> I[Finding Detail]
  I --> J[Assign Owner and Due Date]
  J --> K[Field Capture or Test Run Detail]
  K --> L{Evidence processed?}
  L -- No --> M[Pending sync / processing]
  M --> K
  L -- Yes --> B
  C --> S[Schedule Status Panel on Gate View]
  S --> B
  E --> N{Approver authorized?}
  N -- No --> O([Exit: Await authorized approver])
  N -- Yes --> P([Exit: Gate ready for decision])
  H --> Q([Exit: Configuration action required])
```

### Flow: Approve or Reject a Gate
**Entry point:** Gate Review
1. The approver opens `Gate Review` and verifies the readiness explanation and evidence baseline.
2. The app checks the approver's project role and TOTP-enabled session.
3. The approver selects approve, reject, or waive and enters a reason.
4. The app stores the evidence baseline, rule version, actor, and decision timestamp.
5. The app updates the gate status and sends the user to `Decision History`.
**Exit point:** Recorded decision with an immutable audit event.

```mermaid
flowchart TD
  A([Entry: Gate Review]) --> B{Authorized session?}
  B -- No --> C[Login / TOTP]
  C --> B
  B -- Yes --> D{Current blockers absent?}
  D -- No --> E([Exit: Cannot approve; blockers shown])
  D -- Yes --> F[Decision Form]
  F --> G{Action selected?}
  G -- None --> H[Validation error]
  H --> F
  G -- Approve / Reject / Waive --> I[Save Decision]
  I --> J{Save succeeded?}
  J -- No --> K[Conflict or retry error]
  K --> F
  J -- Yes --> L([Exit: Decision History])
```

### Flow: Capture Evidence Offline and Sync
**Entry point:** Field Capture
1. The field engineer opens `Field Capture` and selects an asset or gate.
2. The engineer records a photo, observation, measurement, or test result.
3. The app validates required fields and stores the item as `Pending Sync` when offline.
4. When connectivity returns, the app uploads the item and shows `Processing`.
5. The server validates the source and assigns `Accepted`, `Rejected`, or `Needs Review`.
**Exit point:** Evidence is visible with an explicit server-confirmed state.

```mermaid
flowchart TD
  A([Entry: Field Capture]) --> B[Select Asset or Gate]
  B --> C[Record Evidence]
  C --> D{Required fields valid?}
  D -- No --> E[Validation error]
  E --> C
  D -- Yes --> F{Network available?}
  F -- No --> G[Pending Sync]
  G --> H{Connection restored?}
  H -- No --> G
  H -- Yes --> I[Upload and Processing]
  F -- Yes --> I
  I --> J{Server validation}
  J -- Accepted --> K([Exit: Accepted Evidence])
  J -- Rejected --> L([Exit: Rejected Evidence])
  J -- Needs review --> M([Exit: Review Queue])
```

### Flow: Export Turnover Evidence Pack
**Entry point:** Project Dashboard
1. The operations-readiness lead opens `Exports` and selects a system and gate.
2. The app previews included accepted evidence, decisions, audit history, and source references.
3. The user requests an export and the app creates an `Export Job`.
4. The exporter builds the pack and hash manifest from a versioned evidence baseline.
5. The user downloads the pack through a short-lived signed URL served by the local Node server, or retries a failed job.
**Exit point:** Downloadable pack with manifest hash and verification metadata.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Exports]
  B --> C[Select System and Gate]
  C --> D[Export Preview]
  D --> E{Scope valid?}
  E -- No --> F[Scope validation error]
  F --> C
  E -- Yes --> G[Export Job]
  G --> H{Export completed?}
  H -- No --> I[Retry / failed job details]
  I --> G
  H -- Yes --> J[Manifest Verification]
  J --> K([Exit: Download Evidence Pack])
```

### Flow: Generate Baseline Schedule (US-09)
**Entry point:** Project Dashboard
1. The project scheduler opens `Schedule Baseline Setup` and selects `Upload Schedule Source`.
2. The scheduler uploads vendor contracts, mobilization timelines, purchase orders, and government approval documents.
3. The app validates file type, size, and project membership, then queues an extraction job shown as `Extraction Processing Status`.
4. The extraction job proposes task records (name, duration, dependencies, vendor, lead time, resource requirement, deadline type) and resource-capacity records (crew/equipment counts), each with confidence and a source-region citation.
5. The scheduler opens `Task Record Review Queue`; ambiguous or missing fields are flagged and cannot be auto-accepted.
6. The scheduler accepts, edits, or rejects each proposed record in `Task Record Detail`.
7. Once the scheduler confirms the accepted record set is a complete DAG, the app runs `Dependency Graph Validation`; a detected cycle blocks solving with a clear error.
8. The scheduler triggers `Baseline Solve Job`; the CP-SAT solver computes a feasible schedule respecting precedence, single-mode durations, resource capacity, and deadlines.
9. The app stores the result as immutable `Schedule Version v1` and opens the `Schedule & Critical Path Board` with the critical path highlighted.
**Exit point:** Baseline schedule version v1 available on the Schedule & Critical Path Board, cross-linked into the typed-edges graph.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Schedule Baseline Setup]
  B --> C[Upload Schedule Source]
  C --> D{File and membership valid?}
  D -- No --> E[Upload validation error]
  E --> C
  D -- Yes --> F[Extraction Processing Status]
  F --> G{Extraction completed?}
  G -- No --> H[Pending / retry / failed status]
  H --> F
  G -- Yes --> I[Task Record Review Queue]
  I --> J[Task Record Detail]
  J --> K{Field ambiguous or missing?}
  K -- Yes --> L[Flagged for mandatory review]
  L --> J
  K -- No --> M{Reviewer decision}
  M -- Accept --> N[Accepted Task Record]
  M -- Edit --> J
  M -- Reject --> O[Rejected Task Record]
  N --> P[Dependency Graph Validation]
  O --> P
  P --> Q{Cycle detected?}
  Q -- Yes --> R([Exit: Cycle error; solve blocked])
  Q -- No --> S[Baseline Solve Job]
  S --> T{Solver completed?}
  T -- No / timeout --> U[SOLVE_FAILED state]
  U --> S
  T -- Yes --> V[Schedule Version v1]
  V --> W([Exit: Schedule and Critical Path Board])
```

### Flow: Review Proposed Task and Resource Records
**Entry point:** Task Record Review Queue
1. The reviewer opens `Task Record Review Queue` and filters by document, vendor, or confidence level.
2. The reviewer selects a proposed record and opens `Task Record Detail`, viewing the extracted fields, confidence score, and exact source-region citation.
3. Fields the extractor marked ambiguous or missing are visually flagged and block a one-click accept.
4. The reviewer accepts the record as-is, edits a field before accepting, or rejects it with a reason.
5. The app records the reviewer's decision, actor, and timestamp for audit.
**Exit point:** Accepted record available to the baseline or re-solve pipeline; rejected record retained for audit and excluded from solving.

```mermaid
flowchart TD
  A([Entry: Task Record Review Queue]) --> B[Filter by document / vendor / confidence]
  B --> C[Task Record Detail]
  C --> D{Field flagged ambiguous or missing?}
  D -- Yes --> E[Manual field resolution required]
  E --> C
  D -- No --> F{Reviewer decision}
  F -- Accept --> G([Exit: Accepted Task Record])
  F -- Edit --> H[Edited Record]
  H --> C
  F -- Reject --> I([Exit: Rejected Task Record])
  C --> J{Session expired?}
  J -- Yes --> K([Exit: Login])
```

### Flow: Event-Triggered Rescheduling (US-10)
**Entry point:** Schedule & Critical Path Board
1. A user or integration opens `Event Log / Trigger Entry` and logs a shipment delay, approval granted/rejected, or weather-delay event against a task.
2. The app validates the event against the current schedule version and referenced task.
3. The `Delta Detector` evaluates whether the event affects the critical path or a downstream dependency.
4. If it does not, the app updates only the task's actual status/date and returns to the `Schedule & Critical Path Board`; no new schedule version is created.
5. If it does, the app triggers a `Re-solve Job`; the CP-SAT solver is warm-started with completed tasks held fixed.
6. On success, the app stores a new immutable `Schedule Version vN` and updates the `Schedule & Critical Path Board`.
7. If the deadline is infeasible, the solver still returns a complete schedule and the board shows the minimum overrun and bottleneck constraint explicitly.
8. The app generates a `Re-solve Explainer` describing the triggering event, shifted tasks, and net deadline impact.
**Exit point:** Updated schedule version (or unchanged status-only update) visible on the Schedule & Critical Path Board, with an explainer available for any re-solve.

```mermaid
flowchart TD
  A([Entry: Schedule and Critical Path Board]) --> B[Event Log / Trigger Entry]
  B --> C{Event references valid task in current version?}
  C -- No --> D([Exit: Explicit error; event rejected])
  C -- Yes --> E[Delta Detector]
  E --> F{Critical path or downstream dependency affected?}
  F -- No --> G[Update task status/date only]
  G --> H([Exit: Schedule and Critical Path Board unchanged version])
  F -- Yes --> I[Re-solve Job - warm start]
  I --> J{Solver completed?}
  J -- No / timeout --> K[SOLVE_FAILED state]
  K --> I
  J -- Yes, feasible --> L[Schedule Version vN]
  J -- Yes, infeasible deadline --> M[Schedule Version vN with min overrun and bottleneck shown]
  L --> N[Re-solve Explainer]
  M --> N
  N --> O([Exit: Schedule and Critical Path Board updated])
```

### Flow: View Schedule History and Explainer (US-11)
**Entry point:** Schedule & Critical Path Board
1. The owner's representative opens `Schedule Version History` from the Schedule & Critical Path Board.
2. The user browses prior `Schedule Version` entries, each timestamped and immutable.
3. The user selects a version to open its `Re-solve Explainer`, showing the triggering event, tasks whose dates shifted, and the net deadline impact, clearly labelled as AI-generated.
4. The user may optionally compare two versions in a `Schedule Version Diff` view.
**Exit point:** User understands what changed and why, without any schedule date being altered by the explanation.

```mermaid
flowchart TD
  A([Entry: Schedule and Critical Path Board]) --> B[Schedule Version History]
  B --> C[Select Schedule Version]
  C --> D[Re-solve Explainer]
  D --> E{Compare with another version?}
  E -- Yes --> F[Schedule Version Diff]
  F --> B
  E -- No --> G([Exit: Explainer reviewed])
  B --> H{Session expired?}
  H -- Yes --> I([Exit: Login])
```

### Flow: Generate and Review IST Checklist (US-13)
**Entry point:** Project Dashboard
1. The commissioning engineer opens `IST Checklist Workspace` and selects a system, gate, equipment, and standard set.
2. The app confirms the chosen standards and test procedures are ingested into the RAG store with clause/section metadata and source citations before any generation runs.
3. The Commissioning QA Copilot RAG-generates a `Draft Checklist` of structured steps, acceptance criteria, and cited clauses.
4. The app verifies every LLM-generated clause citation against ingested-corpus metadata; a clause ID with no match is flagged as a possible hallucination rather than shown as verified.
5. A malformed or schema-invalid checklist is rejected with a clear error and routed for retry or human review instead of being partially rendered.
6. The engineer reviews the draft in `Checklist Review`, then accepts, edits, or rejects steps at the draft-acceptance gate; the draft is never treated as authoritative until accepted.
**Exit point:** An accepted checklist ready for test execution, or a rejected/retry draft retained for review.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[IST Checklist Workspace]
  B --> C[Select System, Gate, Equipment, Standards]
  C --> D{Standards and procedures ingested with citations?}
  D -- No --> E[Ingest Standards / Procedures into RAG store]
  E --> C
  D -- Yes --> F[RAG-Generate Draft Checklist]
  F --> G{Checklist schema valid?}
  G -- No --> H([Exit: Draft rejected; retry / human review])
  G -- Yes --> I[Verify Clause Citations vs Corpus Metadata]
  I --> J{Citation matches ingested clause?}
  J -- No --> K[Flag as possible hallucination]
  K --> L[Checklist Review]
  J -- Yes --> L
  L --> M{Engineer draft-acceptance decision}
  M -- Accept --> N([Exit: Accepted Checklist ready for execution])
  M -- Edit --> O[Edited Draft]
  O --> L
  M -- Reject --> P([Exit: Rejected Draft retained])
```

### Flow: Execute Test and Handle Failure (US-14–US-18)
**Entry point:** Accepted Checklist
1. The commissioning engineer opens `Test Execution` for the accepted checklist and runs each step, entering per-step field readings.
2. The app records who entered each reading and when, and persists step state so execution can be resumed without loss.
3. For each step, a deterministic acceptance check classifies numeric/threshold and boolean/presence steps as `proposed_pass` or `proposed_fail`; narrative/qualitative steps are always routed to `needs_human_review` and never auto-determined.
4. On a `proposed_fail`, a `TEST_FAILED` event emits, the affected gate goes `BLOCKED`, a `findings` (NCR) record is created via the existing typed-graph + audit-event pattern, and a `Command Center` alert is raised.
5. The engineer generates a `Draft Test Report` labelled "DRAFT — PENDING ENGINEER REVIEW".
6. The engineer edits and approves the report; export is possible only after approval.
7. When all steps pass, on approval the gate transitions to `PENDING_REVIEW` — never `READY`; only an authorized approver transitions it further.
8. The approved test record is linked as `evidence` to its gate and added to the turnover pack.
**Exit point:** An approved test record in the evidence graph and turnover pack, with the gate at `PENDING_REVIEW`, or a `BLOCKED` gate with an open finding on failure.

```mermaid
flowchart TD
  A([Entry: Accepted Checklist]) --> B[Test Execution]
  B --> C[Enter Per-Step Field Readings]
  C --> D[Deterministic Acceptance Check]
  D --> E{Step classification}
  E -- proposed_fail --> F[Emit TEST_FAILED]
  F --> G[Gate BLOCKED + Finding NCR + Command Center Alert]
  G --> H([Exit: Gate BLOCKED with open finding])
  E -- needs_human_review --> I[Route narrative step to human review]
  I --> C
  E -- proposed_pass --> J{All steps proposed_pass?}
  J -- No --> C
  J -- Yes --> K[Generate Draft Test Report - PENDING ENGINEER REVIEW]
  K --> L{Engineer edit / approve}
  L -- Edit --> K
  L -- Approve --> M[Gate PENDING_REVIEW]
  M --> N[Link Test Record as Evidence + Add to Turnover Pack]
  N --> O([Exit: Approved test record; gate PENDING_REVIEW])
```

### Flow: Track Shipments and Handle Delay (US-19–US-23)
**Entry point:** Project Dashboard
1. The MEP package manager opens the `Supply Chain Map` and its `Shipment Navigator`; shipments render on a Leaflet map with red/amber/green status alongside a navigator table.
2. The manager clicks a navigator row to zoom the map to that shipment's origin→destination route (single-leg only).
3. The app polls (~30s) the live AIS vessel position, falling back to great-circle interpolation when AIS is unavailable, with each position transparently labelled live or simulated.
4. The app computes a deterministic weather-adjusted ETA (an additive delay-factor multiplier on remaining transit duration, using weather at origin, current position, and destination) and classifies status against the required-on-site date minus a configurable buffer (🟢 on-time / 🟡 at-risk / 🔴 delayed).
5. On a status change into at-risk/delayed, `SHIPMENT_DELAYED` emits into the existing `schedule_events` → delta-detector → CP-SAT re-solve pipeline and raises a `Command Center` alert, deduplicated against the last-notified status so the ~30s poll cannot spam repeat emits.
6. On a return to on-time, `SHIPMENT_RECOVERED` emits to clear the stale alert rather than leaving a delayed status latched.
**Exit point:** Shipments visible with live, deterministically-classified status; material status changes fed once into the schedule pipeline and surfaced in the Command Center.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Supply Chain Map + Shipment Navigator]
  B --> C[Shipments render on Leaflet map with R/A/G status]
  C --> D[Click navigator row -> zoom to route]
  D --> E[Poll AIS position ~30s]
  E --> F{AIS available?}
  F -- No --> G[Great-circle interpolation - labelled simulated]
  F -- Yes --> H[Live position - labelled live]
  G --> I[Compute deterministic weather-adjusted ETA]
  H --> I
  I --> J[Classify status vs required-on-site date minus buffer]
  J --> K{Status changed since last notified?}
  K -- No --> E
  K -- Yes, into at-risk/delayed --> L[Emit SHIPMENT_DELAYED -> delta-detector / CP-SAT + Command Center Alert]
  K -- Yes, back to on-time --> M[Emit SHIPMENT_RECOVERED -> clear stale alert]
  L --> N([Exit: Delay fed to schedule pipeline + Command Center])
  M --> O([Exit: Recovery clears alert; shipment on-time])
```

### Flow: Review Compliance Deviations (US-24–US-25)
**Entry point:** Project Dashboard
1. The QA/QC lead opens `Compliance Review Queue`; the Specification & Quality Compliance Agent has compared vendor submittals, POs, and shop-drawing text callouts against accepted `requirements` (extending the existing requirement-extraction/evidence-graph pipeline, not a parallel one).
2. The lead selects a proposed flag and opens `Compliance Flag Detail`, which cites the exact requirement clause vs. the exact submittal/PO/drawing line with a confidence score.
3. The app routes evaluation by `requirements.modality`: numeric/threshold, categorical/enum, and boolean/presence deviations are deterministic and auto-flaggable; narrative/qualitative comparisons surface an LLM "possible mismatch" suggestion routed to mandatory human review and are never auto-flagged. Shop-drawing geometry is out of scope (text callouts only).
4. For an alternative/superior-spec claim, the agent must ground it via `lookup_standard_clause` or `check_precedent` (with `compare_spec_values`) before proposing a flag; an ungrounded claim is downgraded to "no precedent found, needs engineering judgment," and a client-spec-vs-standard conflict is surfaced with document hierarchy/date rather than silently resolved.
5. When a flag is proposed, the app auto-proposes a `findings` (NCR) record (owner, severity, due date) pending human acceptance plus an `audit_events` entry; no flag closes or accepts itself.
6. The lead accepts, edits, or rejects the proposed flag; on acceptance a `findings` record is persisted and, when it blocks a gate, a `Command Center` alert cross-links it.
**Exit point:** An accepted `findings` (NCR) record linked into the evidence graph, or a downgraded/rejected proposal retained for audit — never an AI-closed conformance decision.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Compliance Review Queue]
  B --> C[Compliance Flag Detail]
  C --> D{requirements.modality}
  D -- Numeric / enum / boolean --> E[Deterministic deviation - auto-flaggable]
  D -- Narrative / qualitative --> F[LLM possible-mismatch -> mandatory human review]
  C --> G{Equivalence / superior-spec claim?}
  G -- Yes --> H[Ground via lookup_standard_clause / check_precedent]
  H --> I{Grounded in clause or approved-equal precedent?}
  I -- No --> J[Downgrade: needs engineering judgment - not a flag]
  I -- Yes --> K[Propose flag citing clause vs line]
  G -- No --> K
  E --> K
  F --> L[Human review decision]
  K --> L
  L --> M{Reviewer decision}
  M -- Accept --> N[Persist findings NCR + audit_events]
  N --> O([Exit: Accepted finding; Command Center cross-link if gate-blocking])
  M -- Edit --> C
  M -- Reject --> P([Exit: Rejected proposal retained])
  J --> Q([Exit: Downgraded claim retained for judgment])
```

### Flow: Review Predicted Schedule Risk (US-26–US-27)
**Entry point:** Schedule & Critical Path Board
1. A single Predictive Schedule Risk Engine worker runs on a periodic local cron/job poll (not a multi-agent system), reading the latest schedule version/critical path and polling procurement status, equipment lead times, workforce availability, and weather forecast.
2. When a signal crosses a configurable materiality threshold against the critical path or a downstream dependency, the engine emits a `schedule_events.event_type = predicted_risk_delay` event carrying affected task(s), estimated delay/probability, source signal, and one or more mitigation options (proposals only).
3. The engine deduplicates by task + risk-type and re-emits only on material change — never every poll cycle — and updates its flagged-risk state when a risk self-resolves.
4. The commissioning manager opens the dedicated `Live Events` and `Delays/Risks` surface: `Live Events` lists the real-time polled signals and `Delays/Risks` lists the flagged `predicted_risk_delay` advisories with their affected tasks and mitigation options.
5. The manager opens a flagged risk in `Predicted Risk Detail`; it cross-links to the affected task on the `Schedule & Critical Path Board` and raises a `Command Center` alert, without itself altering any schedule date.
6. Acting on a mitigation option is a human/deterministic step only: a human or the CP-SAT solver (given a selected option as a constraint change) runs the re-solve through the existing delta-detector → re-solve pipeline. The engine never reschedules, selects, or applies an option.
**Exit point:** An advisory predicted-risk alert surfaced and cross-linked to its task, with any actual re-solve executed deterministically by a human/CP-SAT — never by the engine.

```mermaid
flowchart TD
  A([Entry: Schedule and Critical Path Board]) --> B[Periodic Local Cron/Job Poll]
  B --> C[Poll procurement / lead-time / workforce / weather forecast]
  C --> D{Signal available?}
  D -- No --> E[Explicit data-unavailable state - skip signal]
  E --> B
  D -- Yes --> F{Risk crosses materiality threshold vs critical path?}
  F -- No --> B
  F -- Yes --> G{Already flagged for task + risk-type without material change?}
  G -- Yes --> B
  G -- No --> H[Emit predicted_risk_delay + mitigation options]
  H --> I[Live Events / Delays-Risks surface]
  I --> J[Predicted Risk Detail]
  J --> K[Cross-link to affected task + Command Center Alert]
  K --> L{Human selects a mitigation option?}
  L -- No --> M([Exit: Advisory risk surfaced; no schedule change])
  L -- Yes --> N[Human / CP-SAT re-solve via delta-detector pipeline]
  N --> O([Exit: Deterministic re-solve; engine never applied it])
```

### Flow: Query Project Knowledge and Retrieve Similar RFIs (US-28–US-29)
**Entry point:** Project Dashboard
1. The MEP package manager opens the `Knowledge Query Chatbot` and asks a natural-language project question.
2. The Project Knowledge & RFI Intelligence Agent classifies intent and logically routes to a doc-type index (spec/submittal/test-record/RFI/change-order), then applies a mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) before any vector search.
3. The agent decomposes the query, traverses the existing `edges`-table typed graph for context, and runs vector similarity scoped only to the filtered+routed subset — never a global search — over the local (self-hosted) pgvector store.
4. The agent synthesizes a cited NL answer where every claim cites `source_region_id`, `document_version`, and content hash; uncitable claims are dropped rather than shown.
5. The user opens `Source Region Viewer` to jump to the exact source PDF/doc region backing a cited claim.
6. In parallel, for an RFI-style question the agent surfaces "previously resolved similar RFI" suggestions from a `doc_type = RFI`-scoped index above a cosine-similarity threshold; suggestions are advisory, cite their source RFI record, and never auto-answer or close the query.
**Exit point:** A fully cited answer (or an explicit no-results answer with zero uncited claims) plus any advisory similar-RFI suggestions, each resolvable to its exact source region.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Knowledge Query Chatbot]
  B --> C[Intent classification + doc-type routing]
  C --> D[Mandatory-first deterministic metadata filter]
  D --> E[Typed-graph traversal + scoped vector search - never global]
  E --> F{Any documents in filtered scope?}
  F -- No --> G([Exit: Explicit no-results; zero uncited claims])
  F -- Yes --> H[Synthesize NL answer - drop uncitable claims]
  H --> I{Every claim cites source_region_id + version + hash?}
  I -- No --> J[Drop uncited claim]
  J --> H
  I -- Yes --> K[Cited Answer]
  K --> L[Source Region Viewer - exact PDF/doc region]
  C --> M{RFI-style question?}
  M -- Yes --> N[Similar-RFI index scoped to doc_type=RFI]
  N --> O{Above cosine-similarity threshold?}
  O -- Yes --> P[Show previously-resolved-similar-RFI suggestion]
  O -- No --> Q[No suggestion surfaced]
  P --> R([Exit: Cited answer + advisory RFI suggestions])
  L --> R
  Q --> R
```

### Flow: Explore Interactive Project Graph / Timeline (US-30)
**Entry point:** Project Dashboard
1. The owner's representative opens the `Project Graph / Timeline` page, backed by the existing append-only, hash-chained `edges` + `audit_events` tables (no parallel datastore).
2. The page reads live state via the local Node API; nodes represent entities (event/doc/test/decision) sourced directly from the typed graph.
3. The user filters or scrolls the timeline and selects a node to open `Node Detail`.
4. Clicking a node expands its linked documents, vendor supply records, and audit history via existing FK relations.
5. The user follows a linked document into the `Source Region Viewer`, or follows a linked test/decision/finding into its detail screen, keeping the graph and the record views cross-linked.
**Exit point:** The user has traced any project event to its linked docs, supply records, and audit trail, all read live from the authoritative typed graph.

```mermaid
flowchart TD
  A([Entry: Project Dashboard]) --> B[Project Graph / Timeline]
  B --> C[Read live state via local Node API - edges + audit_events]
  C --> D[Render entity nodes: event/doc/test/decision]
  D --> E{Node selected?}
  E -- No --> D
  E -- Yes --> F[Node Detail]
  F --> G[Expand linked docs / vendor supply records / audits via FK relations]
  G --> H{Follow a link?}
  H -- Document --> I[Source Region Viewer]
  H -- Test / Decision / Finding --> J[Linked record detail]
  H -- No --> K([Exit: Event traced through graph])
  I --> K
  J --> K
  B --> L{Session expired?}
  L -- Yes --> M([Exit: Login])
```

### Flow: Triage Unified Alerts in the Command Center (US-31)
**Entry point:** Command Center
1. The commissioning manager opens the `Command Center`, a single unified alert surface fed by the four-event orchestrator contract: `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, and `predicted_risk_delay`.
2. Each active alert cross-links from its triggering event to its downstream impact: a `TEST_FAILED` links to the created `findings` (NCR) record and the gate it set to `BLOCKED`; a `SHIPMENT_DELAYED` links to the affected schedule task(s) and, when a re-solve occurred, the resulting schedule version; a `predicted_risk_delay` links to the affected task on the schedule/critical-path view and its mitigation options.
3. Alerts are deduplicated on status change: an unchanged status across poll cycles produces zero new alerts, and one status transition produces exactly one alert.
4. A `SHIPMENT_RECOVERED` event clears the corresponding stale `SHIPMENT_DELAYED` alert from the active view rather than leaving it latched; the cleared alert remains available in `Alert History`.
5. The manager opens an alert to follow its cross-link into the relevant gate/finding/schedule surface and act there. The Command Center is a read/cross-link surface only — it never changes gate readiness, closes a finding, or alters a schedule date.
**Exit point:** The manager sees, in one place, what fired, what it affected, and whether it is still live, then acts through the appropriate downstream deterministic/human surface.

```mermaid
flowchart TD
  A([Entry: Command Center]) --> B[Unified active-alert list]
  B --> C{Triggering event type}
  C -- TEST_FAILED --> D[Cross-link: findings NCR + BLOCKED gate]
  C -- SHIPMENT_DELAYED --> E[Cross-link: affected tasks + resulting schedule version]
  C -- predicted_risk_delay --> F[Cross-link: affected task + mitigation options]
  C -- SHIPMENT_RECOVERED --> G[Clear stale SHIPMENT_DELAYED alert -> Alert History]
  D --> H{Status changed since last alert?}
  E --> H
  F --> H
  H -- No --> I[No new alert - dedup]
  I --> B
  H -- Yes --> J[Exactly one alert per transition]
  J --> K[Open alert -> follow cross-link to gate/finding/schedule surface]
  K --> L([Exit: Act via downstream deterministic/human surface])
  G --> M([Exit: Recovery clears alert; retained in history])
```

## Edge Cases in Flow

- Any authenticated screen redirects to `Login` after session expiry and returns the user to the original route after reauthentication.
- A `403` response shows an access-denied state and does not reveal whether an inaccessible record exists.
- Network failures preserve unsent field evidence locally as `Pending Sync`; authoritative readiness never changes from a local-only capture.
- Concurrent edits show a conflict state and require reload before a review or decision can be saved.
- Empty projects show setup tasks and `UNKNOWN` readiness, never `READY`.
- Failed jobs expose a retry action and job identifier; retries are idempotent.

### Schedule Module Edge Cases

- Unauthenticated or unauthorized access to `Schedule Baseline Setup`, `Task Record Review Queue`, `Schedule & Critical Path Board`, `Event Log / Trigger Entry`, or `Re-solve Explainer` redirects to `Login` or shows an access-denied state without revealing record existence.
- A network failure, validation error, or API timeout during upload, extraction, or event logging shows a retryable error and preserves the prior valid state; retries are idempotent.
- A solver timeout on either the baseline solve or a re-solve enters an explicit `SOLVE_FAILED` state with a retry action and job identifier; the prior schedule version remains untouched until a retry succeeds.
- Session expiry mid-flow (e.g., mid-review in the `Task Record Review Queue` or mid-event-entry) redirects to `Login` and returns the user to the same screen and unsaved-safe state after reauthentication.
- An infeasible deadline after a re-solve never fails silently: the solver returns a complete schedule with the minimum unavoidable overrun and the bottleneck constraint identified, surfaced directly on the `Schedule & Critical Path Board` and in the `Re-solve Explainer`.
- An ambiguous or missing extracted field (task or resource-capacity) is flagged in the `Task Record Review Queue` and blocks one-click auto-accept; the reviewer must resolve or explicitly reject it.
- A dependency cycle detected among accepted task records blocks the CP-SAT solve at `Dependency Graph Validation` with a clear, human-actionable error rather than silently dropping an edge.
- Two events logged concurrently against the same task are serialized through the delta-detector/solve pipeline; the second event's re-solve runs against the already-updated schedule state rather than racing the first.
- An event reported against a task that no longer exists in the current schedule version is rejected with an explicit error and never silently ignored or misapplied.
- A Gemini API extraction or explanation failure/timeout leaves the prior schedule version and status untouched and surfaces a retryable error rather than a partially-applied schedule.
- Schedule delay or critical-path status shown in the `Schedule Status Panel` on the gate view never alters the deterministic `READY`/`BLOCKED`/`IN_REVIEW`/`UNKNOWN` computation.

### Commissioning QA Copilot Edge Cases

- Unauthenticated or unauthorized access to `IST Checklist Workspace`, `Test Execution`, or the `Command Center` redirects to `Login` or shows an access-denied state without revealing record existence.
- No checklist is generated until the selected standards and procedures are ingested into the RAG store with clause/section metadata and source citations.
- The LLM returns a malformed or schema-invalid checklist JSON: the draft is rejected with a clear error and routed for retry/human review rather than partially rendered as a valid checklist.
- The LLM cites a clause ID absent from the ingested-corpus metadata (hallucinated citation): the citation is flagged as unverifiable and never shown as verified.
- A narrative/qualitative acceptance criterion is never auto-passed or auto-failed; it is always routed to `needs_human_review`.
- A generated draft checklist is advisory only and never treated as an accepted or authoritative test procedure until an engineer accepts it at the draft-acceptance gate.
- A `proposed_fail` never silently passes: it emits `TEST_FAILED`, raises the finding, sets the gate `BLOCKED`, and surfaces a `Command Center` alert as one atomic outcome recorded in the audit trail.
- Test-step state and readings persist so an interrupted execution can be resumed without loss; the executing engineer and timestamp are recorded per reading.
- A completed all-pass test sets the gate to `PENDING_REVIEW`, never `READY`; only an authorized approver transitions it further, preserving the AI-advisory boundary.
- The draft test report is exportable only after engineer approval; the "DRAFT — PENDING ENGINEER REVIEW" label persists until approval.

### Supply Chain Agent Edge Cases

- Unauthenticated or unauthorized access to the `Supply Chain Map`, `Shipment Navigator`, or `Command Center` redirects to `Login` or shows an access-denied state without revealing record existence.
- AIS is unavailable: the shipment position falls back to great-circle interpolation and is transparently labelled simulated rather than live.
- The Open-Meteo weather service is unavailable: the deterministic delay factor defaults to 0 (no weather adjustment) rather than blocking or guessing an ETA.
- Delay detection, ETA, and R/A/G status are deterministic threshold math, never LLM output; ETAs are labelled estimates, never guaranteed delivery dates.
- Duplicate or stale `SHIPMENT_DELAYED` emissions from the ~30s poll are suppressed by deduplication against the last-notified status; only a genuine status change emits an event.
- A shipment that returns to on-time emits `SHIPMENT_RECOVERED` to clear the stale `Command Center` alert rather than leaving a delayed status latched.
- The agent surfaces risk only: emitting `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` never itself reschedules, changes a gate status, selects a vendor, or modifies a PO; the schedule effect is produced only by the downstream delta-detector → CP-SAT re-solve.
- Port congestion is a manual boolean flag, not a live feed; planned transit duration defaults to a configurable placeholder when absent.

### Specification & Quality Compliance Agent Edge Cases

- Unauthenticated or unauthorized access to the `Compliance Review Queue`, `Compliance Flag Detail`, or `Command Center` redirects to `Login` or shows an access-denied state without revealing record existence.
- Every proposed flag cites an exact requirement clause and an exact submittal/PO/drawing line with a confidence score; a flag missing either citation is never surfaced.
- A narrative/qualitative comparison is never auto-flagged: it surfaces an LLM "possible mismatch" suggestion routed to mandatory human review, and the LLM never directly judges conformance.
- An equivalence/superior-spec claim that neither `lookup_standard_clause` nor `check_precedent` can ground is downgraded to "no precedent found, needs engineering judgment" and is never auto-accepted, auto-rejected, or shown as a flag.
- A client spec conflicting with a referenced standard is surfaced with document hierarchy/date rather than one being silently chosen or resolved.
- Shop-drawing evaluation is limited to extracted text callouts; geometry/CAD comparison is out of scope and never attempted.
- No flag closes or accepts itself: acceptance persists a `findings` (NCR) record and an `audit_events` entry only through a human decision, preserving the AI-advisory boundary.

### Predictive Schedule Risk Engine Edge Cases

- Unauthenticated or unauthorized access to the `Live Events`, `Delays/Risks`, `Predicted Risk Detail`, or `Command Center` surfaces redirects to `Login` or shows an access-denied state without revealing record existence.
- An external signal feed (procurement status, equipment lead time, workforce availability, or weather forecast) is unavailable during a poll cycle: the engine skips that signal with an explicit data-unavailable state and never fabricates a risk or silently drops monitoring.
- A risk crossing the materiality threshold repeatedly across poll cycles without material change is suppressed by the task + risk-type dedup state; no duplicate `predicted_risk_delay` event is produced.
- A predicted risk that self-resolves (e.g., lead time recovers) before any human/solver action updates the flagged-risk state on the material change rather than latching a stale risk in the `Delays/Risks` view.
- Every emitted `predicted_risk_delay` carries affected task(s), estimated delay/probability, source signal, and ≥1 mitigation option; mitigation options are proposals only.
- The engine never reschedules, selects, or applies an option: any re-solve is executed by the deterministic CP-SAT solver or a human through the existing delta-detector → re-solve pipeline, and a flagged risk never itself alters a schedule date.

### Project Knowledge & RFI Intelligence Agent Edge Cases

- Unauthenticated or unauthorized access to the `Knowledge Query Chatbot`, `Project Graph / Timeline`, or `Source Region Viewer` redirects to `Login` or shows an access-denied state without revealing record existence.
- A mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) is always applied before any vector search; retrieval is scoped to the filtered+routed subset and never runs a global (unfiltered) semantic search over the local pgvector store.
- A query that matches no documents after the metadata filter returns an explicit no-results answer with zero uncited claims, never a hallucinated answer from outside the filtered scope.
- Retrieved chunks whose claims cannot be tied back to a `source_region_id` are dropped from the synthesized answer rather than shown uncited; every surfaced claim cites `source_region_id`, `document_version`, and content hash.
- A similar-RFI candidate below the cosine-similarity threshold is not surfaced, and no forced "previously resolved similar RFI" suggestion is shown; RFI similarity is project-scoped only, never cross-project.
- Similar-RFI suggestions are advisory and cite their source RFI record; they never auto-answer or close the current query.
- The `Project Graph / Timeline` reads live state from the existing append-only, hash-chained `edges` + `audit_events` tables via the local Node API; there is no parallel datastore, and clicking a node expands linked docs/supply records/audits only via existing FK relations.

## Navigation Map

- `Login`
- `Project List`
  - `Create Project`
  - `Project Dashboard`
    - `Project Settings`
    - `Source Library`
      - `Upload Source`
      - `Processing Status`
      - `Requirement Review Queue`
        - `Requirement Detail`
    - `Readiness Board`
      - `Gate Review`
        - `Schedule Status Panel` (linked schedule/critical-path context, read-only)
      - `Blocker Detail`
        - `Finding Detail`
      - `Evidence Detail`
      - `Test Run Detail`
    - `Field Capture`
    - `Schedule Baseline Setup`
      - `Upload Schedule Source`
      - `Extraction Processing Status`
      - `Task Record Review Queue`
        - `Task Record Detail`
      - `Dependency Graph Validation`
      - `Baseline Solve Job`
    - `Schedule & Critical Path Board`
      - `Event Log / Trigger Entry`
      - `Re-solve Job Status`
      - `Schedule Version History`
        - `Re-solve Explainer`
        - `Schedule Version Diff`
      - `Live Events` (Predictive Schedule Risk Engine polled signals)
      - `Delays/Risks` (flagged `predicted_risk_delay` advisories, cross-linked to the critical-path view)
        - `Predicted Risk Detail` (affected task + mitigation options; advisory only)
    - `IST Checklist Workspace` (Commissioning QA Copilot)
      - `Checklist Review` (draft-acceptance gate)
      - `Test Execution`
        - `Draft Test Report` ("DRAFT — PENDING ENGINEER REVIEW")
    - `Supply Chain Map`
      - `Shipment Navigator` (click-to-zoom table)
    - `Compliance Review Queue` (Specification & Quality Compliance Agent)
      - `Compliance Flag Detail` (clause vs. submittal/PO/drawing line; proposed `findings` pending human acceptance)
    - `Knowledge Query Chatbot` (Project Knowledge & RFI Intelligence Agent; cited NL answer + similar-RFI suggestions)
      - `Source Region Viewer` (exact source PDF/doc region for a cited claim)
    - `Project Graph / Timeline` (interactive nodes over `edges` + `audit_events`; click-to-expand via existing FK relations)
    - `Command Center` (unified alerts: TEST_FAILED, SHIPMENT_DELAYED / SHIPMENT_RECOVERED, predicted_risk_delay, cross-linked to the affected gate/finding/schedule impact; dedups on status change; SHIPMENT_RECOVERED clears stale alerts)
      - `Alert History` (cleared/dedup'd alerts retained)
    - `Exports`
      - `Export Preview`
      - `Export Job`
      - `Manifest Verification`
    - `Decision History`
