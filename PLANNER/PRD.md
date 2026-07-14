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

### Should Have

- CSV templates for asset registers, milestones, and issue logs.
- Responsive PWA evidence capture with an offline queue.
- Hybrid exact-term and semantic source search.
- Project-configurable gate names, evidence types, and readiness rules.
- Schedule version comparison view (diff between any two schedule versions, not only consecutive ones).

### Won't Have in the MVP

- Autonomous compliance approval, certification, or AI-set gate readiness.
- Statistical/ML-based delay prediction or portfolio forecasting.
- Multi-mode task scheduling (duration varying by assigned resource level).
- Native integrations with Primavera P6, Procore, Autodesk Construction Cloud, Aconex, CxAlloy, BMS, and EPMS.
- Advanced drawing geometry comparison and BIM-aware relationships.
- Live supply-chain, port, or geospatial tracking beyond reported shipment/approval/weather events.
- Unlicensed TIA-942, BICSI, Uptime Institute, client, or vendor content.
- General-purpose project chatbot or broad autonomous multi-agent EPC system.

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

## Known Gaps Carried From Fit Analysis

- Statistical/ML-based delay-risk prediction and portfolio forecasting, live supply-chain intelligence beyond reported events, arbitrary drawing computer vision, broad RFI intelligence, native scheduling/CDE integrations, and live BMS/EPMS telemetry are intentionally deferred until representative data and pilot evidence exist.
