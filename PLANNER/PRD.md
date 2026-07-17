# Pramana Cx Product Requirements Document

## Problem Statement

Data-centre commissioning teams must prove that systems are ready for the next gate using specifications, asset registers, test procedures, inspection records, NCRs, approvals, and turnover evidence. These records are fragmented across PDFs, spreadsheets, email exports, and project systems. The team cannot reliably answer which requirement applies, what evidence proves it, whether that evidence is current and approved, or who owns the remaining blocker.

At the same time, the project schedule that governs when systems become available for commissioning is typically held in a separate spreadsheet or scheduling tool, rebuilt manually from vendor contracts and mobilization plans, and updated only sporadically when a shipment, approval, or weather delay actually happens. Nobody can say, at the moment an event occurs, whether it moves the critical path, by how much, or which gate it threatens.

The result is manual reconciliation, repeated evidence chasing, late discovery of missing prerequisites, handover packs that are difficult to audit, and schedules that are stale the day after they are published. Existing document search and commissioning tools do not provide a controlled chain from requirement to asset, test, evidence, issue, and authorized gate decision, nor a deterministic, explainable link from a real-world event to an updated, feasible schedule.

## Target Users

| Persona | Job to be done | Currently does instead |
|---|---|---|
| Commissioning manager / CxA | Review system and gate readiness; know if the schedule feeding a gate is slipping | Manually cross-checks spreadsheets, emails, and a separate P6/Excel schedule |
| Owner's representative | Verify claimed progress against evidence and against the live schedule | Requests weekly reports and reconciles contractor claims by hand |
| EPC / GC MEP package manager | Resolve missing prerequisites across contractors; understand which vendor delay threatens a work front | Chases evidence and schedule updates informally over email/calls |
| QA/QC lead | Manage inspections, NCRs, evidence, and sign-off authority | Rebuilds an auditable quality trail manually per gate |
| Operations-readiness lead | Receive complete asset and evidence handover on a predictable date | Cannot get a defensible answer on turnover timing until very late |
| Project scheduler / planner | Maintain a feasible baseline schedule and react to delay events with a re-solved plan | Manually re-sequences a spreadsheet or P6 file after each event, without a documented rationale |

## Core Features

### Must Have

- Project-scoped roles, tenant isolation, and immutable audit events.
- Versioned document and tabular ingestion with exact source citations and content hashes.
- Human-reviewed requirement extraction (schema-validated, confidence-scored, unit-checked); only accepted requirements affect readiness.
- Typed graph connecting requirements, systems, assets, gates, evidence, tests, findings, decisions, and owners.
- Deterministic readiness board (READY/BLOCKED/IN_REVIEW/UNKNOWN) with blocker ownership.
- Revision comparison and stale-evidence propagation on change.
- Issues, assignments, due dates, comments, and evidence capture.
- Authorized gate decisions (approve/reject/waive) with reason and audit history.
- Hash-manifested evidence-pack export.
- Document-derived baseline schedule: LLM extraction of tasks (name, duration, dependencies, vendor, lead time, resource requirement, deadline type) and resource-capacity records (crew/equipment counts) from specs, vendor contracts, POs, and approval documents, schema-validated with mandatory human review of ambiguous/missing fields.
- CP-SAT-computed baseline schedule (schedule version v1) respecting precedence, single-mode task duration, resource-capacity, and deadline constraints, with critical path highlighted.
- Event-triggered deterministic rescheduling: shipment, approval, and weather-delay events flow through a delta detector; affected schedules are warm-started and re-solved by CP-SAT, producing a new immutable schedule version with full history.
- Deadline-overrun-first, idle-time-second optimization objective, with explicit minimum-overrun and bottleneck reporting when a deadline is infeasible.
- LLM-generated, human-readable explanation of each schedule re-solve's diff (what changed, why, and the net deadline impact).
- Schedule entities integrated into the existing typed-edges/provenance graph, cross-linked to systems/assets/gates (e.g., a critical-path task `PRECEDES`/`AFFECTS` a gate), surfaced as contextual schedule status alongside a gate view without altering deterministic gate readiness rules.
- Commissioning Quality Assurance Copilot — standards-RAG draft checklist generation: ingest commissioning standards and test procedures into a RAG store with clause/section metadata and source citations, then RAG-generate a **draft** structured checklist (steps, acceptance criteria, cited clauses) for a chosen system/gate/equipment/standard set.
- Commissioning Quality Assurance Copilot — guided IST step execution with per-step engineer field-reading capture.
- Commissioning Quality Assurance Copilot — deterministic acceptance checks: numeric/threshold and boolean/presence steps classified `proposed_pass`/`proposed_fail` by deterministic comparison; narrative/qualitative steps always routed to `needs_human_review`, never auto-determined.
- Commissioning Quality Assurance Copilot — post-generation verification of every LLM-generated clause citation against ingested-corpus metadata; hallucinated clause IDs are flagged, never silently accepted.
- Commissioning Quality Assurance Copilot — `TEST_FAILED` handling: a `proposed_fail` emits a `TEST_FAILED` event that creates a `findings` (NCR) record and marks the affected gate `BLOCKED` through the existing typed-graph + audit-event pattern.
- Commissioning Quality Assurance Copilot — auto-drafted test report labelled "DRAFT — PENDING ENGINEER REVIEW" for engineer edit/approve/export.
- Commissioning Quality Assurance Copilot — evidence and turnover linkage: on approval, the test record is linked as `evidence` to its gate and added to the turnover pack; a completed all-pass test sets the gate to `PENDING_REVIEW`, never `READY`.
- Supply Chain Visibility & Risk Agent — single-leg (origin→destination) shipment tracking with live AIS vessel position and great-circle interpolation fallback, each position transparently labelled live or simulated.
- Supply Chain Visibility & Risk Agent — weather-adjusted **deterministic** ETA via an additive delay-factor heuristic (a multiplier on remaining transit duration, not raw day-count), using weather at origin, current position, and destination.
- Supply Chain Visibility & Risk Agent — red/amber/green at-risk status classification against the required-on-site date minus a configurable buffer.
- Supply Chain Visibility & Risk Agent — Leaflet map rendering of shipments, routes, and weather, plus a click-to-zoom navigator table.
- Supply Chain Visibility & Risk Agent — `SHIPMENT_DELAYED` and `SHIPMENT_RECOVERED` events (deduplicated against last-notified status) emitted into the existing `schedule_events` → delta-detector → CP-SAT re-solve pipeline; a delay lands as `event_type = 'shipment_delayed'` and a recovery lands as the distinct `event_type = 'shipment_recovered'`, and a delay affecting multiple schedule tasks persists as one `schedule_events` row per affected task.
- Command Center / unified alert surface — a single alert view that cross-links each triggering `TEST_FAILED`, `SHIPMENT_DELAYED`, or `SHIPMENT_RECOVERED` event to its downstream impact (the blocked gate and `findings` record for a test failure; the affected schedule tasks and resulting schedule version for a shipment delay), consistent with the AppFlow Command Center screen and the emerging orchestrator event contract; alerts are deduplicated on status change (one alert per status transition, not per poll), and a `SHIPMENT_RECOVERED` event clears the corresponding stale delay alert.
- Specification & Quality Compliance Agent — comparison of procurement orders, vendor submittals, and shop-drawing text callouts against accepted `requirements`, extending (not duplicating) the existing requirement-extraction and evidence-graph pipeline, built as a `services/compliance-check` service on the existing `ModelProvider`/`requirements`/`edges` infrastructure.
- Specification & Quality Compliance Agent — tiered evaluation routed by `requirements.modality`: numeric/threshold, categorical/enum, and boolean/presence checks are deterministic and auto-flaggable; narrative/qualitative comparisons surface an LLM "possible mismatch" suggestion routed to mandatory human review, never auto-flagged; shop-drawing geometry is out of scope (text callouts only).
- Specification & Quality Compliance Agent — equivalence/substitution grounding: an alternative/superior-spec claim must be grounded in a retrieved standards clause or an approved-equal precedent (`lookup_standard_clause`, `check_precedent`, `compare_spec_values` tools) before a flag is proposed; ungrounded claims are downgraded to "deviation requiring engineering judgment," and conflicting client-spec-vs-standard sources are surfaced with document hierarchy/date rather than silently resolved.
- Specification & Quality Compliance Agent — auto-proposed `findings` (NCR) record (owner, severity, due date) pending human acceptance, plus an `audit_events` entry, citing the exact clause vs. exact submittal/PO/drawing line with a confidence score.
- Predictive Schedule Risk Engine (core USP) — periodic-poll agent (Cloudflare Workflows/cron) that evaluates forward schedule risk against procurement status, equipment lead times, workforce availability, and weather forecast, and emits a `schedule_events.event_type = predicted_risk_delay` event with affected task(s), estimated delay/probability, source signal, and one or more mitigation options when a risk crosses a materiality threshold.
- Predictive Schedule Risk Engine — flagged-risk state/dedup: tracks what has already been flagged by task + risk-type and re-emits only on material change, never every poll cycle, to avoid trigger spam into the Schedule Manager.
- Predictive Schedule Risk Engine — mitigation options are proposals only (structured/text); the engine never reschedules, selects, or applies an option — a human or the deterministic CP-SAT solver (given a selected option as a constraint change) executes it. Only risk *detection* is predictive/advisory; the re-solve path stays deterministic.
- Predictive Schedule Risk Engine — dedicated "Live Events" and "Delays/Risks" UI surface showing real-time polled signals and flagged predicted risks, cross-linked to the schedule/critical-path view.
- Project Knowledge & RFI Intelligence Agent — NL query chatbot returning a cited NL answer plus the exact source PDF/doc region, using hybrid metadata-filter + existing typed-graph traversal + scoped vector search (not full GraphRAG); every claim cites `source_region_id`, `document_version`, and content hash.
- Project Knowledge & RFI Intelligence Agent — retrieval pipeline: intent classification, logical routing to a doc-type index (spec/submittal/test-record/RFI/change-order), a mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision), query decomposition, multi-representation index, `edges`-table graph traversal for context, and vector similarity scoped to the filtered+routed subset only (never global).
- Project Knowledge & RFI Intelligence Agent — RFI similarity match over a `doc_type = RFI`-scoped index surfacing prior resolved RFIs as "previously resolved similar RFI" suggestions above a cosine-similarity threshold.
- Project Knowledge & RFI Intelligence Agent — interactive project graph/timeline page backed by the existing append-only, hash-chained `edges` + `audit_events` tables (no parallel datastore): nodes are entities (event/doc/test/decision), a click expands linked docs, vendor supply records, and audits via existing FK relations, and the page reads live state via API.

### Should Have

- CSV templates for asset registers, milestones, and issue logs.
- Responsive PWA evidence capture with an offline queue.
- Hybrid exact-term and semantic source search.
- Project-configurable gate names, evidence types, and readiness rules.
- Schedule version comparison view (diff between any two schedule versions, not only consecutive ones).

### Won't Have in the MVP

- Autonomous compliance approval, certification, or AI-set gate readiness.
- Trained statistical/ML duration-prediction models (regression/boosting on labelled as-planned/as-built histories) and portfolio-level forecasting — forward-risk *detection* is committed via the Predictive Schedule Risk Engine, but the ML-trained duration sub-capability stays deferred.
- Multi-mode task scheduling (duration varying by assigned resource level).
- Native integrations with Primavera P6, Procore, Autodesk Construction Cloud, Aconex, CxAlloy, BMS, and EPMS.
- Advanced drawing geometry comparison and BIM-aware relationships.
- Multi-tier/multi-leg supplier tracking, live port-congestion feeds, geospatial route optimization, and alternative-sourcing models — single-leg shipment tracking is committed via the Supply Chain Visibility & Risk Agent.
- Unlicensed TIA-942, BICSI, Uptime Institute, client, or vendor content.
- A general-purpose project chatbot answering without source-region citations, cross-project similar-RFI retrieval, and full GraphRAG — a project-scoped, citation-grounded RFI/knowledge agent is committed via the Project Knowledge & RFI Intelligence Agent.
- A broad autonomous multi-agent EPC system that acts without human acceptance; all agents remain advisory only.

## Agent Suite

A one-stop per-agent summary of the five committed domain agents. Details live in Core Features, User Stories, and Constraints; this section cross-references rather than repeats them.

### Commissioning Quality Assurance Copilot

- **Purpose:** Guides engineers through integrated system testing — RAG-generating draft IST checklists from ingested standards, capturing per-step field readings, and drafting the test report and turnover evidence.
- **Inputs:** Commissioning standards and test procedures (synthetic excerpts for the prototype) ingested into a RAG store with clause metadata; engineer per-step field readings; existing `systems`/`assets`/`gates`/`requirements` graph data.
- **Outputs / events emitted:** Draft structured checklist with verified clause citations; per-step `proposed_pass`/`proposed_fail`/`needs_human_review` classifications; `TEST_FAILED` events creating `findings` (NCR) records and setting the gate `BLOCKED`; a "DRAFT — PENDING ENGINEER REVIEW" test report; approved test records linked as gate `evidence` and added to the turnover pack.
- **Human/AI boundary:** Numeric/boolean acceptance verdicts are deterministic comparisons; narrative steps always go to human review. The LLM only drafts checklists and reports; every clause citation is post-verified against corpus metadata. An all-pass test sets the gate to `PENDING_REVIEW`, never `READY`.
- **User stories:** US-13–US-18.
- **UI surface:** Checklist execution UI (guided step-by-step IST with reading capture and report review/export).

### Supply Chain Visibility & Risk Agent

- **Purpose:** Tracks critical equipment shipments single-leg (origin→destination) with live AIS position, deterministic weather-adjusted ETA, and red/amber/green at-risk alerting against required-on-site dates.
- **Inputs:** Shipment records (equipment link, origin/destination coordinates, MMSI, planned ETA, required-on-site date); live AIS positions (great-circle fallback, labelled live vs. simulated); weather at origin/current position/destination; manual port-congestion flag.
- **Outputs / events emitted:** Deterministic weather-adjusted ETA; 🟢/🟡/🔴 status; `SHIPMENT_DELAYED` and `SHIPMENT_RECOVERED` as `schedule_events.event_type` rows (deduplicated against last-notified status; one row per affected task), feeding the delta-detector → CP-SAT re-solve pipeline.
- **Human/AI boundary:** All ETA/delay/status math is deterministic threshold math, never LLM output; the agent surfaces risk only — it does not reschedule, change gate status, select vendors, or modify POs.
- **User stories:** US-19–US-23.
- **UI surface:** Leaflet map (shipments, routes, weather) + click-to-zoom navigator table.

### Specification & Quality Compliance Agent

- **Purpose:** Compares procurement orders, vendor submittals, and shop-drawing text callouts against accepted `requirements` and proposes non-conformance flags before site delivery, extending the existing requirement-extraction/evidence-graph pipeline.
- **Inputs:** Accepted `requirements`; submittals/POs/shop-drawing text callouts; ingested (synthetic) standards excerpts and an approved-equal precedent log.
- **Outputs / events emitted:** Proposed deviation flags citing exact clause vs. exact submittal/PO/drawing line with confidence score; auto-proposed `findings` (NCR) records (owner, severity, due date) pending human acceptance; `audit_events` entries.
- **Human/AI boundary:** Numeric/enum/boolean checks are deterministic and auto-flaggable; narrative comparisons are LLM "possible mismatch" suggestions routed to mandatory human review, never auto-flagged; equivalence claims must be grounded via `lookup_standard_clause`/`check_precedent`/`compare_spec_values` or are downgraded to "needs engineering judgment." No flag closes or accepts itself.
- **User stories:** US-24–US-25.
- **UI surface:** Flags/review queue (proposed findings pending human acceptance).

### Predictive Schedule Risk Engine

- **Purpose:** Core USP — a periodic-poll agent that detects forward schedule risk weeks ahead and emits trigger events with mitigation options; it never reschedules itself.
- **Inputs:** Latest schedule version/critical path; procurement status, equipment lead times, workforce availability, and weather forecast, polled on an interval (Cloudflare Workflows/cron).
- **Outputs / events emitted:** `schedule_events.event_type = predicted_risk_delay` carrying affected task(s), estimated delay/probability, source signal, and ≥1 mitigation option; deduplicated by task + risk-type, re-emitted only on material change.
- **Human/AI boundary:** Only risk *detection* is predictive/advisory; mitigation options are proposals only — a human or the deterministic CP-SAT solver (given a selected option as a constraint change) executes the re-solve through the existing delta-detector pipeline.
- **User stories:** US-26–US-27.
- **UI surface:** Dedicated "Live Events" and "Delays/Risks" tabs, cross-linked to the schedule/critical-path view.

### Project Knowledge & RFI Intelligence Agent

- **Purpose:** Answers natural-language project questions with fully cited answers and surfaces previously resolved similar RFIs, over the existing typed graph — not full GraphRAG.
- **Inputs:** Specifications, submittals, test records, RFI logs, change orders; existing evidence-graph data (`edges`, `source_regions`, requirements, decisions, audit events).
- **Outputs / events emitted:** Cited NL answers (every claim cites `source_region_id`, `document_version`, content hash, linked to the exact source region); "previously resolved similar RFI" suggestions above a cosine-similarity threshold.
- **Human/AI boundary:** A mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) scopes all retrieval — vector search is never global; the LLM synthesizes answers only from filtered, cited chunks, and uncitable claims are dropped. Suggestions are advisory and never auto-answer or close a query.
- **User stories:** US-28–US-30.
- **UI surface:** Chatbot + interactive project graph/timeline page (nodes backed by `edges` + `audit_events`, click-to-expand via existing FK relations).

The five agents share an emerging orchestrator and a Command Center unified alert surface (US-31): the event contract — `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, `predicted_risk_delay`, each agent's emit/dedup conditions, and cross-links from a triggering event to its downstream gate/finding/schedule impact — is recorded in StructuredPlan.md, while durable transport, routing rules, and replay remain TRD-stage items (see Known Gaps Carried From Fit Analysis). Note that agents 1–2 (Commissioning QA Copilot, Supply Chain Visibility & Risk) run on a per-agent stack override deferred to TRD-stage reconciliation — see the stack-override constraint in Constraints.

## Out of Scope

- This version will not support independent Tier III/IV, TIA-942, BICSI, statutory, or contractual certification.
- This version will not support automatic closure of findings, NCRs, waivers, tests, or readiness gates by AI.
- This version will not support native write-back to external CDE or scheduling platforms (P6, Procore, Aconex, etc.).
- This version will not support live BMS/EPMS time-series validation.
- This version will not support general CAD/BIM interpretation or arbitrary shop-drawing approval.
- This version will not use customer data for shared model training or cross-tenant retrieval.
- This version will not support multi-mode/variable-duration task scheduling (RCPSP with resource-dependent durations); every task has one fixed duration and resource capacity only caps concurrency.
- This version will not fold schedule/critical-path status into the deterministic gate readiness rules engine; schedule status is a separate, cross-linked view only.
- This version will not model weather as a labor-capacity or calendar adjustment; weather is only a discrete task-level delay event.
- This version will not perform live, API-integrated supply-chain, shipment, or geospatial tracking beyond manually or API-reported event ingestion.
- Commissioning Quality Assurance Copilot: this version will not perform automated telemetry / BMS-EPMS integrated-system-test validation.
- Commissioning Quality Assurance Copilot: this version will not perform multimodal photo / Gemini-Vision analysis of field evidence.
- Commissioning Quality Assurance Copilot: this version will not perform cross-project standards learning.
- Commissioning Quality Assurance Copilot: this version will not issue certification; it produces proposals and draft documentation only.
- Supply Chain Visibility & Risk Agent: this version will not track multi-tier or multi-leg suppliers; tracking is single-leg (origin→destination) only.
- Supply Chain Visibility & Risk Agent: this version will not ingest live port-congestion feeds; port congestion is a manual boolean flag only.
- Supply Chain Visibility & Risk Agent: this version will not perform geospatial route optimization.
- Supply Chain Visibility & Risk Agent: this version will not model procurement alternatives or alternative sourcing.
- Specification & Quality Compliance Agent: this version will not perform shop-drawing geometry/CAD comparison; only text callouts and dimension labels are extracted via the existing OCR path.
- Specification & Quality Compliance Agent: this version will not let the LLM directly judge conformance; only deterministic or retrieval-grounded checks may produce a flag, and equivalence claims must be grounded in a cited clause or precedent.
- Specification & Quality Compliance Agent: this version will not ingest licensed standards text; only small, clearly-labelled synthetic standard excerpts and a synthetic approved-equivalents log are used.
- Predictive Schedule Risk Engine: this version will not itself reschedule, select, or apply a mitigation option; it detects risk and proposes options only, with all re-solving done by the deterministic CP-SAT solver.
- Predictive Schedule Risk Engine: this version will not use a trained statistical/ML duration-prediction model requiring labelled as-planned/as-built histories; forward-risk detection is signal/threshold-based, and the historical-duration regression sub-capability stays deferred.
- Project Knowledge & RFI Intelligence Agent: this version will not perform full GraphRAG (LLM re-deriving an entity graph from text); it reuses the existing typed graph and scopes vector search to a pre-filtered candidate set.
- Project Knowledge & RFI Intelligence Agent: this version will not perform cross-project similar-RFI retrieval; RFI similarity is scoped within the project.
- Project Knowledge & RFI Intelligence Agent: this version will not answer with any claim lacking a source-region citation, and will not run a global (unfiltered) semantic search.

## User Stories & Acceptance Criteria

### US-01: Project Access
As a commissioning manager, I want to create a project and assign project-scoped roles so that only authorized people can view, edit, review, or approve project records.
- A user without project membership receives `403`.
- A reviewer cannot perform an approver action.
- Every role change creates an audit event.

### US-02: Source Ingestion
As a QA/QC lead, I want to upload authorized PDFs, CSVs, XLSX files, images, and email exports so that originals, revisions, hashes, and source locations are preserved.
- Each accepted upload stores a SHA-256 hash, revision state, uploader, timestamp, and source location.
- Duplicate content is detected by hash and does not create a duplicate authoritative record.

### US-03: Requirement Review
As a commissioning engineer, I want extracted requirements to show exact source citations, confidence, units, and review status so that I can accept, edit, or reject them before they affect readiness.
- No proposed requirement changes readiness until a reviewer accepts it.
- Every proposal contains a page/region citation and validation status.

### US-04: Evidence Readiness
As a commissioning manager, I want to select a system or gate and see its accepted evidence, failed tests, stale records, and missing prerequisites so that I can decide what blocks acceptance.
- For a selected gate, the board separately lists missing, stale, failed, blocked, unapproved, and accepted evidence.
- `READY` is impossible when any mandatory blocker remains.

### US-05: Action Ownership
As an MEP package manager, I want to assign blockers with owners and due dates so that unresolved evidence gaps have accountable next actions.
- Creating or updating an issue requires an owner and status.
- Overdue open issues appear in the selected system's or gate's blocker view.

### US-06: Change Impact
As a QA/QC lead, I want a revised requirement or asset record to identify affected evidence and approvals so that superseded evidence cannot silently remain valid.
- A superseding document version marks affected evidence as stale.
- The system records the affected requirement, evidence, and prior decision relationships.

### US-07: Gate Decision
As an authorized approver, I want to approve, reject, or waive a gate with a reason and audit record so that the project has a defensible decision history.
- Only a user with the configured approval role can create a gate decision.
- The decision stores action, reason, actor, timestamp, and evidence baseline.

### US-08: Turnover Export
As an operations-readiness lead, I want to export a source-linked evidence pack with hashes and decisions so that handover records can be independently checked.
- An export contains source identifiers, file hashes, decision history, rule/model versions, and a manifest.
- The manifest hash changes whenever included content changes.

### US-09: Baseline Schedule Generation
As a project scheduler, I want the platform to extract tasks, dependencies, and resource capacity from vendor contracts and mobilization plans and produce a baseline critical-path schedule so that I do not have to build it manually from scratch.
- Extracted task and resource-capacity fields are schema-validated; any missing or ambiguous field is flagged in a mandatory human review queue and is never silently guessed or auto-accepted.
- Accepted tasks form a DAG; a cycle in the accepted dependency graph is detected and blocks solving with a clear error before CP-SAT runs.
- The CP-SAT solver produces a feasible schedule respecting precedence, single-mode durations, resource-capacity, and deadline constraints, with the critical path explicitly marked, stored as immutable schedule version v1.

### US-10: Event-Triggered Rescheduling
As a commissioning manager, I want a shipment, approval, or weather-delay event to automatically trigger a schedule re-solve only when it actually matters so that the schedule stays accurate without noisy churn.
- Logging an event that does not affect the current critical path or any downstream dependency updates only the task's actual status/date; no new schedule version is created.
- Logging an event that does affect the critical path or a downstream dependency triggers a CP-SAT re-solve, warm-started from current state with completed tasks held fixed, and produces a new immutable schedule version with full history retained.
- If the deadline becomes infeasible after re-solving, the system reports the minimum unavoidable overrun and identifies the bottleneck constraint rather than failing silently or hiding the delay.

### US-11: Schedule Change Explanation
As an owner's representative, I want a plain-language summary of what changed and why after every schedule re-solve so that I can understand delay impact without reading a raw solver diff.
- Every stored schedule version beyond v1 has an associated LLM-generated explanation identifying the triggering event, the tasks whose dates shifted, and the net deadline impact.
- The explanation is clearly labelled as an AI-generated summary and never itself alters any schedule date.

### US-12: Schedule Status on the Gate View
As a commissioning manager, I want to see whether a critical-path task feeding my gate is behind schedule, cross-linked from the gate view, so that I have schedule context without it silently changing my gate's readiness state.
- A gate view displays linked schedule tasks (via typed edges such as `PRECEDES`/`AFFECTS`) and their current delay status, if any.
- Schedule delay/critical-path status never changes the deterministic READY/BLOCKED/IN_REVIEW/UNKNOWN computation for that gate.

### US-13: Standards-Driven Draft Checklist Generation
As a commissioning engineer, I want the Commissioning QA Copilot to generate a draft IST checklist from ingested standards and procedures for a chosen system, gate, equipment, and standard set so that I do not build test steps from scratch.
- Standards and procedures are ingested into the RAG store with clause/section metadata and source citations before any checklist is generated.
- The generated checklist is a structured draft of steps, acceptance criteria, and cited clauses; it is never treated as an accepted or authoritative test procedure until an engineer reviews it.
- Every clause citation on the draft is verified against ingested-corpus metadata; a citation with no matching clause is flagged as a possible hallucination, not shown as verified.

### US-14: Guided IST Step Execution
As a commissioning engineer, I want to execute checklist steps and record my field readings per step so that test execution is captured as structured, attributable data.
- Each step accepts the executing engineer's reading(s) and records who entered them and when.
- Step state and readings are persisted and can be resumed without loss.

### US-15: Deterministic Acceptance Checks
As a QA/QC lead, I want numeric and boolean acceptance criteria evaluated deterministically and qualitative criteria routed to human review so that no pass/fail decision is made by the LLM.
- A numeric/threshold or boolean/presence step is classified `proposed_pass` or `proposed_fail` by deterministic comparison against the acceptance criterion, with no LLM involvement in the verdict.
- A narrative/qualitative step is always classified `needs_human_review` and is never auto-determined as pass or fail.

### US-16: Test-Failure Gate Blocking
As a commissioning manager, I want a failed acceptance check to raise a finding and block the affected gate so that a failure cannot be silently overlooked.
- A `proposed_fail` emits a `TEST_FAILED` event that creates a `findings` (NCR) record via the existing typed-graph + audit-event pattern.
- The affected gate is set to `BLOCKED` and the finding is linked to it; the block is recorded as an audit event.

### US-17: Auto-Drafted Test Report
As a commissioning engineer, I want the copilot to auto-draft the test report so that I can edit, approve, and export it rather than author it manually.
- The generated report is labelled "DRAFT — PENDING ENGINEER REVIEW" until an engineer approves it.
- The draft can be edited, approved, and exported; export is possible only after approval.

### US-18: Evidence and Turnover Linkage
As an operations-readiness lead, I want an approved test record linked as gate evidence and added to the turnover pack so that commissioning results appear in the auditable handover.
- On approval, the test record is created as `evidence` and linked to its gate.
- A completed all-pass test sets the gate to `PENDING_REVIEW`, never `READY`; only an authorized approver transitions the gate further.
- The approved test record is included in the turnover/evidence pack.

### US-19: Single-Leg Shipment Tracking
As an MEP package manager, I want single-leg tracking of a critical equipment shipment with live AIS position and a fallback so that I can see where it is even when AIS is unavailable.
- A shipment record links equipment, origin/destination coordinates, MMSI, planned ETA, and required-on-site date.
- Live AIS position is polled and displayed; when AIS is unavailable, a great-circle-interpolated position is shown and transparently labelled simulated rather than live.

### US-20: Weather-Adjusted Deterministic ETA
As a project scheduler, I want a weather-adjusted ETA computed deterministically so that estimated arrival reflects weather without being an LLM guess.
- The ETA applies a deterministic additive delay-factor multiplier to remaining transit duration using weather at origin, current position, and destination.
- The ETA is labelled an estimate, never a guaranteed delivery date; no LLM produces the ETA value.

### US-21: At-Risk Status Classification
As a commissioning manager, I want each shipment classified red/amber/green against its required-on-site date so that I can see at a glance which deliveries threaten a work front.
- Status is computed deterministically against required-on-site-date minus a configurable buffer: 🟢 on-time, 🟡 at-risk, 🔴 delayed.
- The classification is threshold math only and does not itself reschedule, change gate status, select vendors, or modify POs.

### US-22: Shipment Map and Navigator
As an MEP package manager, I want shipments, routes, and weather on a map with a navigator table so that I can inspect any shipment spatially and in list form.
- Shipments, routes, and weather render on a Leaflet map.
- A navigator table lists shipments and supports click-to-zoom to the selected shipment on the map.

### US-23: Shipment Events into the Schedule Pipeline
As a project scheduler, I want a shipment status change to emit deduplicated delay/recovery events into the schedule pipeline so that a slipping delivery re-solves the schedule without 30-second poll spam.
- A status change into at-risk/delayed emits `SHIPMENT_DELAYED` carrying affected equipment, old/new ETA, delay days, reason, and affected tasks, deduplicated against the last-notified status; a delay affecting multiple schedule tasks persists as one `schedule_events` row per affected task.
- A return to on-time emits `SHIPMENT_RECOVERED` to clear stale alerts.
- A delay lands as `event_type = 'shipment_delayed'` and a recovery lands as the distinct `event_type = 'shipment_recovered'`; both flow through the same existing `schedule_events` → delta-detector → CP-SAT re-solve pipeline with no new downstream solver logic.

### US-24: Submittal/PO Compliance Check
As a QA/QC lead, I want the Specification & Quality Compliance Agent to compare a vendor submittal, PO, or shop-drawing callout against the accepted requirement and flag deviations so that non-conformances are caught before site delivery.
- A numeric/threshold, categorical/enum, or boolean/presence deviation is detected by deterministic comparison and cites the exact requirement clause vs. the exact submittal/PO/drawing line.
- A narrative/qualitative comparison is surfaced as an LLM "possible mismatch" suggestion routed to mandatory human review and is never auto-flagged.
- Each proposed flag creates a `findings` (NCR) record (owner, severity, due date) pending human acceptance plus an `audit_events` entry; no flag closes or accepts itself.

### US-25: Equivalence / Approved-Equal Grounding
As a commissioning engineer, I want an alternative-or-superior-spec claim in a submittal to be grounded in a standard clause or an approved-equal precedent before it is flagged so that the agent does not freehand-judge equivalence.
- Before any equivalence claim is shown as a flag, the agent retrieves a supporting standards clause (`lookup_standard_clause`) or an approved-equal precedent (`check_precedent`); a groundedness check downgrades unsupported claims to "no precedent found, needs engineering judgment."
- When a client spec and a referenced standard conflict, both are surfaced with document hierarchy/date rather than one being silently chosen.

### US-26: Predictive Schedule Risk Detection
As a project scheduler, I want the Predictive Schedule Risk Engine to warn me weeks in advance when a forward risk threatens the critical path so that I can act before it becomes a delay.
- The engine polls procurement status, equipment lead times, workforce availability, and weather forecast on an interval and, when a risk crosses a materiality threshold, emits a `schedule_events.event_type = predicted_risk_delay` event carrying affected task(s), estimated delay/probability, source signal, and one or more mitigation options.
- A risk already flagged for a given task + risk-type is re-emitted only on material change, never every poll cycle.
- The engine never reschedules, selects, or applies a mitigation option; the re-solve is executed only by the deterministic CP-SAT solver or a human, and the event flows through the existing delta-detector → re-solve pipeline.

### US-27: Live Events and Risk Surface
As a commissioning manager, I want a dedicated "Live Events" and "Delays/Risks" view so that I can see polled real-time signals and flagged predicted risks separately from, but cross-linked to, the critical-path view.
- The view lists real-time polled signals and any flagged predicted risks with their affected tasks and mitigation options.
- Each flagged risk cross-links to the affected task on the schedule/critical-path view without itself altering any schedule date.

### US-28: Project Knowledge Query with Citations
As an EPC/GC MEP package manager, I want to ask a natural-language question about the project and get a cited answer with the exact source region so that I can resolve technical/contractual queries in seconds without manual document search.
- The answer is retrieved via a mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision), doc-type routing, existing typed-graph traversal, and vector similarity scoped only to the filtered+routed subset — never a global search.
- Every claim in the answer cites `source_region_id`, `document_version`, and content hash, and links to the exact source PDF/doc region.

### US-29: Similar-RFI Retrieval
As an EPC/GC MEP package manager, I want the agent to surface previously resolved similar RFIs so that I can reuse prior answers instead of re-opening a resolved question.
- A `doc_type = RFI`-scoped similarity index returns prior resolved RFIs above a cosine-similarity threshold, labelled "previously resolved similar RFI."
- Suggestions are advisory and cite their source RFI record; they do not auto-answer or close the current query.

### US-30: Interactive Project Graph / Timeline
As an owner's representative, I want an interactive project graph/timeline of all project events so that I can click any event and see its linked documents, supply records, and audit history.
- Nodes represent entities (event/doc/test/decision) sourced from the existing append-only, hash-chained `edges` + `audit_events` tables, with no parallel datastore.
- Clicking a node expands its linked docs, vendor supply records, and audits via existing FK relations, and the page reads live state via API.

### US-31: Command Center Unified Alert Surface
As a commissioning manager, I want a Command Center that shows every active alert with a link from the triggering event to its downstream impact so that I can see, in one place, what fired, what it affected, and whether it is still live.
- Each `TEST_FAILED` alert cross-links to the created `findings` (NCR) record and the gate it set to `BLOCKED`; each `SHIPMENT_DELAYED` alert cross-links to the affected schedule task(s) and, when a re-solve occurred, the resulting schedule version.
- Alerts are deduplicated on status change: an unchanged status across poll cycles produces zero new alerts, and one status transition produces exactly one alert.
- A `SHIPMENT_RECOVERED` event clears the corresponding stale `SHIPMENT_DELAYED` alert from the active-alert view rather than leaving it latched; the cleared alert remains available in history.
- The Command Center is a read/cross-link surface consistent with the AppFlow Command Center screen and the emerging orchestrator event contract; it never itself changes gate readiness, closes a finding, or alters a schedule date.

## Success Metrics

- 100% of surfaced findings and schedule tasks open to their exact source page or region.
- At least 98% exact match for extracted values and units in the pilot golden set (requirements and schedule tasks/resources).
- At least 90% recall on manually labelled requirement clauses.
- At least 90% precision for high-severity findings in a blinded engineer review.
- At least 60% reduction in weekly readiness-report or evidence-pack preparation time.
- At least 70% of assigned pilot evidence tasks completed in-product.
- 100% of accepted schedule tasks and resource-capacity records with ambiguous/missing fields routed to human review, with zero silent auto-acceptance.
- 100% of event-triggered re-solves that affect the critical path produce both a new schedule version and a corresponding LLM explanation within the same processing job.
- CP-SAT solver returns a feasible schedule or an explicit infeasibility/bottleneck report for every solve attempt (zero silent failures) in golden-set testing.
- At least a configurable-default checklist-coverage target (e.g., `CHECKLIST_COVERAGE_TARGET`) of the golden-set IST steps present in the draft checklist for a chosen system/gate/equipment/standard set.
- 100% of LLM-generated clause citations verified against ingested-corpus metadata, meeting a configurable-default citation-verification pass-rate target (e.g., `CITATION_VERIFICATION_PASS_TARGET`); all unverifiable citations flagged, none shown as verified.
- Deterministic acceptance-check agreement with the golden-set expected verdicts at a configurable-default target (e.g., `ACCEPTANCE_CHECK_ACCURACY_TARGET`) for numeric/boolean steps; 100% of narrative steps routed to human review.
- Weather-adjusted ETA and R/A/G status accuracy against a synthetic ground-truth proxy at a configurable-default target (e.g., `ETA_STATUS_ACCURACY_TARGET`).
- 100% correct alert deduplication in golden-set testing (one `SHIPMENT_DELAYED` per status change, `SHIPMENT_RECOVERED` on recovery, zero duplicate emits within an unchanged-status poll window).
- Specification & Quality Compliance Agent: 100% of proposed compliance flags cite an exact requirement clause and an exact submittal/PO/drawing line; 100% of narrative/qualitative comparisons routed to human review with zero LLM auto-flagging; deterministic deviation detection meets a configurable-default target (e.g., `COMPLIANCE_DEVIATION_ACCURACY_TARGET`) on the golden set.
- Specification & Quality Compliance Agent: 100% of equivalence/substitution claims are groundedness-gated — none reach a reviewer as a flag without a cited standard clause or approved-equal precedent; ungrounded claims are downgraded, not shown as flags.
- Predictive Schedule Risk Engine: 100% of emitted `predicted_risk_delay` events carry affected task(s), estimated delay/probability, source signal, and ≥1 mitigation option; zero duplicate emits for an unchanged task + risk-type within a poll window; risk-detection lead time meets a configurable-default target (e.g., `RISK_LEAD_TIME_TARGET`) on the golden set.
- Project Knowledge & RFI Intelligence Agent: 100% of answer claims cite `source_region_id`, `document_version`, and content hash; zero answers produced from an unfiltered global vector search (metadata filter always applied first); similar-RFI retrieval precision/recall meets a configurable-default target (e.g., `RFI_MATCH_ACCURACY_TARGET`) on the golden set.
- Two paid design partners or signed pilot-to-paid conversion criteria by week eight.

## Edge Cases

- A scanned, illegible, multilingual, handwritten, or table-heavy source is routed to manual review and cannot become authoritative automatically.
- Conflicting revisions remain `UNKNOWN` or `BLOCKED` until a precedence rule or human decision is recorded.
- Duplicate uploads are linked by hash and do not create duplicate authoritative evidence.
- Offline field captures remain queued locally with a visible sync state and are never shown as accepted until uploaded and processed.
- A concurrent edit produces a conflict requiring the later user to reload; it must not overwrite the earlier accepted decision.
- Expired sessions, revoked project membership, and expired signed URLs fail closed.
- Rate-limited ingestion returns a retryable response and preserves the original upload state.
- Empty projects show setup guidance and no readiness claim rather than a green state.
- A dependency-graph cycle detected among accepted schedule tasks blocks the CP-SAT solve with a clear, human-actionable error rather than silently dropping an edge.
- Two events (e.g., a shipment delay and an approval) arriving concurrently for the same task are serialized through the delta-detector/solve pipeline; the second event triggers its own re-solve against the already-updated state rather than racing the first.
- An event reported against a task that no longer exists in the current schedule version (e.g., removed in a later revision) is rejected with an explicit error, not silently ignored or misapplied.
- A re-solve that cannot avoid overrunning the hard deadline still returns a complete, usable schedule with the minimum overrun and bottleneck constraint identified, never an unexplained failure.
- Gemini API extraction/explanation failures or timeouts leave the prior schedule version and status untouched and surface a retryable error, never a partially-applied schedule.
- The LLM returns a malformed or schema-invalid checklist JSON; the draft is rejected with a clear error and routed for retry/human review rather than partially rendered as a valid checklist.
- The LLM cites a clause ID that does not exist in the ingested-corpus metadata (hallucinated citation); the citation is flagged as unverifiable and never shown as verified.
- A narrative/qualitative acceptance criterion is never auto-passed or auto-failed; it is always routed to `needs_human_review`.
- AIS is unavailable; the shipment position falls back to great-circle interpolation and is transparently labelled simulated rather than live.
- The Open-Meteo weather service is unavailable; the deterministic delay factor defaults to 0 (no weather adjustment) rather than blocking or guessing an ETA.
- Duplicate or stale `SHIPMENT_DELAYED` emissions from the ~30s poll are suppressed by deduplication against the last-notified status; only a genuine status change emits an event.
- A shipment that returns to on-time emits `SHIPMENT_RECOVERED` to clear the stale alert rather than leaving a delayed status latched.
- A submittal claims an equivalent or superior spec but neither `lookup_standard_clause` nor `check_precedent` retrieves a supporting clause or approved-equal precedent; the claim is downgraded to "no precedent found, needs engineering judgment" and is never auto-accepted, auto-rejected, or shown as a flag.
- A client spec and a referenced standard conflict on the same requirement; both sources are surfaced with document hierarchy/date rather than one being silently chosen or resolved.
- The groundedness check fails on an equivalence claim that initially appeared supported; the claim is downgraded, not shown to a reviewer as a flag.
- An external signal feed (procurement status, equipment lead time, workforce availability, or weather forecast) is unavailable during a poll cycle; the Predictive Schedule Risk Engine skips that signal with an explicit data-unavailable state and never fabricates a risk or silently drops monitoring.
- A risk crosses the materiality threshold repeatedly across poll cycles without material change; the task + risk-type dedup state suppresses re-emission, and no duplicate `predicted_risk_delay` event is produced.
- A predicted risk resolves itself (e.g., the lead time recovers) before any human or solver action; the flagged-risk state updates on the material change rather than latching a stale risk in the "Delays/Risks" view.
- A knowledge query matches no documents after the mandatory deterministic metadata filter; the agent returns an explicit no-results answer containing zero uncited claims, never a hallucinated answer from outside the filtered scope.
- Retrieval returns chunks whose claims cannot be tied back to a `source_region_id`; those claims are dropped from the synthesized answer rather than shown uncited.
- A similar-RFI candidate falls below the cosine-similarity threshold; it is not surfaced, and no forced "previously resolved similar RFI" suggestion is shown.

## Constraints

- The MVP supports one bounded pilot project, one high-value electrical or cooling system, and one commissioning gate.
- Only customer-authorized or appropriately licensed project and standards content may be processed.
- AI output is advisory only and must never directly set readiness, approve compliance, close findings, sign tests, approve waivers, or create gate decisions.
- Only the deterministic rules engine computes gate readiness; only an authorized human with the configured approval role signs a gate decision.
- Only the deterministic CP-SAT solver computes schedule dates, critical path, and feasibility; the LLM must never propose or override a schedule date itself — it is used only for document extraction (with mandatory validation and human review of ambiguous fields) and for explaining solver output in natural language.
- Customer data is tenant-isolated and must never be used for shared model training.
- Initial exchange with existing external systems uses controlled file imports and exports only — no native write-back.
- Human reviewers must remain available to accept requirements, resolve ambiguity, approve waivers, close findings, and sign gates; this must never be bypassed by automation.
- This build is a from-scratch prototype/MVP with no confirmed design partner or licensed project corpus yet; development and validation use synthetic/dummy commissioning data until a pilot partner is secured.
- The SaaS-versus-private/self-hosted deployment profile is not decided for this prototype stage and must not be hardcoded as an assumption; it is deferred until a pilot customer is contractually engaged.
- Resource-capacity data (crew/equipment counts) is LLM-extracted, not manually entered and not deferred; it must carry the same schema-validation and human-review-of-ambiguous-fields treatment as other extracted task fields.
- Multi-mode task scheduling (duration varying by resource level) must not be implemented in the MVP; every task has a single fixed duration.
- Weather-delay events must be modeled only as a discrete task-level event type through the event → delta-detector → re-solve pipeline, never as a labor-capacity or calendar adjustment.
- Schedule entities must be integrated into the existing typed-edges/provenance graph (linking via `edges` and citing `source_regions`), not built as a parallel disconnected data structure.
- Schedule/critical-path status must remain a separate, cross-linked view and must never be folded into or alter the deterministic gate readiness rules engine.
- Gemini API access for schedule extraction and explanation must go only through the internal `ModelProvider` interface; no direct Gemini SDK calls are permitted outside that adapter.
- The Commissioning QA Copilot and the Supply Chain Visibility & Risk Agent are advisory only: neither may certify, sign, close a gate, close an NCR, or grant a waiver. A completed all-pass test sets its gate to `PENDING_REVIEW`, never `READY`; only an authorized approver transitions a gate.
- All five domain agents (Specification & Quality Compliance, Predictive Schedule Risk Engine, Supply Chain Visibility & Risk, Commissioning QA Copilot, Project Knowledge & RFI Intelligence) are advisory only: none may approve compliance, set gate readiness, close a finding/NCR, grant a waiver, sign a test, select a vendor, modify a PO, or reschedule. Every agent output is a proposal pending human acceptance or deterministic execution.
- Specification & Quality Compliance Agent: the LLM must never directly judge conformance; only deterministic (numeric/categorical/boolean) or retrieval-grounded checks may produce a flag, narrative/qualitative comparisons are always routed to human review, and every equivalence/substitution claim must be grounded in a cited standard clause or approved-equal precedent before it is shown as a flag. Shop-drawing evaluation is limited to extracted text callouts, not geometry.
- Predictive Schedule Risk Engine: only risk *detection* is predictive/advisory; the engine must never reschedule, select, or apply a mitigation option. All schedule re-solving remains the deterministic CP-SAT solver's, triggered through the existing delta-detector → re-solve pipeline. Flagged risks must be deduplicated by task + risk-type and re-emitted only on material change.
- Project Knowledge & RFI Intelligence Agent: every answer claim must cite `source_region_id`, `document_version`, and content hash; a mandatory deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) must be applied before any vector search, which is scoped to the filtered+routed subset and never global. Similar-RFI retrieval is project-scoped, and tenant isolation is enforced at every query.
- Acceptance-check pass/fail verdicts and all shipment delay/ETA/status math must be deterministic, never LLM output. The LLM never judges numeric/boolean acceptance and never produces an ETA or R/A/G status; narrative/qualitative acceptance is always routed to human review.
- Only synthetic, clearly-labelled standards excerpts may be used; no licensed TIA-942/BICSI/Uptime Institute standards text may be ingested, consistent with the platform's content-licensing constraint. The synthetic corpus is swappable for a licensed one later without architectural change.
- The Supply Chain agent's AIS (aisstream.io) and weather (Open-Meteo) sources are free-tier / non-commercial only; production requires licensed weather and persistent single-socket AIS. Port congestion is a manual boolean flag, not a live feed.
- **Stack override (TRD-stage reconciliation):** the Commissioning QA Copilot and Supply Chain Visibility & Risk Agent adopt a Python/FastAPI + Chroma + Neo4j/NetworkX + direct Gemini SDK + in-process `asyncio` stack, **overriding** the platform's committed Cloudflare-native/`ModelProvider`/Workers-AI stack for these two agents per user direction. The resulting polyglot architecture (a second RAG store alongside Vectorize, Neo4j alongside D1, direct Gemini calls outside the `ModelProvider` boundary, an in-process event bus vs. Workflows/Queues) is **not reconciled in this document** and is explicitly deferred to the **TRD stage** (see the Divergence Note in StructuredPlan.md).

## Known Gaps Carried From Fit Analysis

- Trained statistical/ML duration prediction (regression/boosting on labelled as-planned/as-built histories) and portfolio-level forecasting, multi-tier/multi-leg supply-chain visibility and alternative-sourcing modelling, arbitrary drawing/CAD geometry comparison, cross-project similar-RFI retrieval and full GraphRAG, native scheduling/CDE integrations, and live BMS/EPMS telemetry are intentionally deferred until representative data and pilot evidence exist. (Forward risk *detection*, single-leg shipment tracking, and project-scoped citation-grounded RFI/knowledge Q&A are now committed via the five-agent suite; the deferred items above are the specific sub-capabilities that remain out of scope.)
- **Orchestrator agent (emerging, not fully defined):** the orchestrator that routes the agents' events (`TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, `predicted_risk_delay`) and a unified "Command Center" alert surface is only partially pinned down — its event contract is recorded in StructuredPlan.md, but durable transport, routing rules, and replay are a TRD-stage item, not resolved here.
