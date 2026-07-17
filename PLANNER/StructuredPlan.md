## Problem Statement (Structured)

### Domain and Context

India's data-centre construction market is expanding rapidly, increasing the volume and complexity of mission-critical EPC delivery. A hyperscale project can involve thousands of equipment items, many concurrent contractors, tightly coupled power and cooling systems, and large commissioning programmes. The resulting quality burden is high because incomplete or incorrect installation, testing, or handover evidence can delay commissioning and undermine confidence in operational readiness.

The market need is supported by current primary-source evidence, but the challenge brief's headline statistics must not be repeated as verified facts. The cited growth from approximately 900 MW in 2024 to more than 2,700 MW by 2027 does not match the JLL sources reviewed, which report that India passed 1 GW in 2024, reached 1,123 MW in H1 2025, and may reach approximately 1.8-2.073 GW by end-2027. The claim that 67% of Asia-Pacific data-centre EPC projects exceeded schedule by more than 10% could not be substantiated in a primary Turner & Townsend source. A verified Turner & Townsend finding is that 94% of surveyed respondents reported shortages of experienced data-centre construction teams. The opportunity therefore rests on verified market growth, scarce specialist capacity, and observable workflow fragmentation rather than on the disputed figures.

### Core Problem

Project requirements, approved specifications, asset registers, vendor submittals, inspection records, test results, NCRs, issue logs, approvals, and change records are held across disconnected documents and systems. Their relationships are not maintained as controlled project data. Teams consequently struggle to determine:

- what requirement applies to each system or asset;
- which approved evidence proves that requirement;
- whether evidence is missing, failed, stale, superseded, or unapproved;
- which unresolved issue blocks the next commissioning gate;
- who owns the corrective action or has authority to accept the result; and
- what downstream tests and approvals are affected by a change.

### Users and Consequences

The primary users are commissioning managers and authorities, owner's representatives, EPC/GC MEP package managers, QA/QC leads, and operations-readiness teams. Today they spend substantial time reconciling records manually, chasing evidence, rebuilding weekly readiness reports, and assembling turnover packs. Fragmentation can allow contradictions and specification deviations to survive until site testing, obscure prerequisites, cause repeated work, and produce handover packages whose claims are difficult to audit.

### Required Outcome

The challenge seeks an AI-supported intelligence layer across EPC information that enables proactive management, automated quality and compliance assistance, and commissioning support. For a safe and credible first product, the immediate outcome is narrower: any authorized viewer-level role (which may be the uploader, the human reviewer who accepts requirements, or the authorized approver who signs gates — each with distinct permissions under the platform's RBAC model) must be able to inspect any supported system or commissioning gate and quickly determine what is required, what accepted evidence proves it, and what still blocks acceptance, with every claim traceable to its exact source and decision history.

## Solution Overview

### Product

Build **Pramana Cx**, an EPC project intelligence platform for mission-critical data-centre delivery, with two core modules in the MVP: (1) an evidence control plane that converts project requirements, asset registers, approved submittals, checklists, test results, issues, and approvals into a versioned evidence graph, and (2) a Proactive Schedule Management module that generates a baseline project schedule from ingested documents and deterministically re-optimizes it as real-world events occur. Its first paid outcomes are a continuously updated L3/L4/L5 or custom-gate readiness board with a verifiable turnover pack, and a live, auditable schedule with critical-path visibility — not a generic document chatbot or a broad autonomous EPC agent.

For each system or gate, Pramana Cx produces a defensible readiness result and lists all missing, stale, failed, and unapproved evidence, linked to the source record, responsible owner, and approval history. For the tracked project schedule, Pramana Cx produces a defensible baseline and re-optimized schedule, with every date change traceable to the triggering event and the deterministic solve that produced it.

### Proactive Schedule Management Module

- **Baseline generation:** an LLM extraction agent (RAG over specs, vendor contracts/timelines, PO documents, government approval/assessment docs, and optional historical duration data) proposes structured task records (name, duration estimate, dependencies, vendor, lead time, resource requirement, hard/soft deadline type) and resource-capacity records (crew/equipment counts) extracted from vendor contracts and mobilization plans. Extraction output is schema-validated; missing or ambiguous fields are flagged for mandatory human review and never silently guessed. Accepted tasks form a dependency graph (DAG), which a CP-SAT solver turns into a baseline optimal schedule (precedence, resource capacity, and deadline constraints respected) with critical path highlighted. This is stored as schedule version `v1`.
- **Event-triggered rescheduling:** real-world events (shipment received/delayed, approval granted/rejected, weather delay) update a task's actual status/date. A delta detector checks whether the event affects the current critical path or downstream dependencies; if not, only the status is logged. If it does, the CP-SAT solver re-solves, warm-started from current state, holding completed tasks fixed and treating the hard deadline as a high-weight soft-priority term. Each re-solve is stored as a new, immutable schedule version with full history retained.
- **Delay-minimizing optimization:** the deterministic objective minimizes deadline overrun first and total idle time second (`w1 >> w2`), respecting precedence, resource capacity, and vendor lead-time constraints, and automatically pulling forward independent tasks to fill freed slack. If the deadline is infeasible even after optimization, the solver reports the minimum overrun and the bottleneck constraint rather than failing silently.
- **Explainability:** after every re-solve, an LLM explainer agent turns the solver's before/after diff into a human-readable summary (e.g., which shipment delay caused which task shifts, and the net deadline impact), surfaced on the dashboard.
- **Non-negotiable boundary:** scheduling math (dates, critical path, feasibility) is always computed by the deterministic CP-SAT solver. The LLM is used only for document extraction (with mandatory validation and human review of ambiguous fields) and for explaining solver output in natural language — it never proposes or overrides a schedule date itself, mirroring the same AI-advisory-only boundary already enforced for readiness in the evidence control plane.

### Core Workflow

1. A project team uploads customer-authorized specifications, requirements, asset registers, responsibility matrices, test procedures, issue logs, and supporting records in supported PDF, CSV, XLSX, image, or email-export formats.
2. The ingestion pipeline hashes and versions originals, preserves page and bounding-box provenance, extracts clauses and tables, and proposes typed requirements and relationships.
3. A qualified human reviewer accepts, edits, or rejects each proposed requirement. Only accepted records can influence readiness.
4. The evidence graph links requirements to systems, assets, gates, tests, evidence, issues, responsible parties, and authorized approvers.
5. Deterministic rules calculate red/amber/green readiness from accepted evidence, prerequisite gates, blocking findings, test outcomes, and signatures. AI may extract, classify, map, summarize, and recommend; it cannot approve compliance, close an NCR, grant a waiver, sign a test, or set a gate to ready.
6. When a controlled document or asset record changes, the platform identifies affected requirements, tests, evidence, and prior approvals, then marks potentially invalid evidence as stale for review.
7. An authorized reviewer records the gate decision, and the platform exports a turnover pack containing source links, hashes, audit history, rule/model versions, and a signed manifest.

### MVP Capabilities

- Project-scoped roles, tenant isolation, approval authority, and immutable audit events.
- Versioned document and structured-data ingestion with exact source citations and content hashes.
- Schema-validated requirement extraction with confidence, unit validation, and mandatory human acceptance.
- A typed graph connecting requirements, systems, assets, gates, evidence, tests, findings, decisions, and owners.
- Deterministic readiness rules and a red/amber/green board with blocker ownership.
- Revision comparison, stale-evidence propagation, and a change blast-radius view.
- Issues, assignments, due dates, comments, evidence capture, approvals, and offline-capable PWA support.
- Verifiable evidence-pack export with decision history and a tamper-evident manifest.
- CSV templates for milestone, asset-register, and issue-log imports so a pilot can coexist with current project systems.
- Document-derived baseline project schedule with dependency graph and CP-SAT-computed critical path, including LLM-extracted resource-capacity (crew/equipment) records.
- Event-triggered deterministic rescheduling (shipment/approval/weather-delay events) with full schedule version history and change explanations.

### Product Boundary

Pramana Cx assists engineering judgment; it does not certify a facility or replace the commissioning authority, engineer of record, TIA-accredited auditor, or Uptime Institute. It processes only standards and project criteria the customer is authorized to use. Proprietary TIA, BICSI, Uptime Institute, client, or vendor content must not be bundled into demos, prompts, embeddings, training data, or reusable templates without an appropriate licence.

## Fit Analysis

The proposed MVP directly addresses the challenge's information-fragmentation, quality-control, and commissioning-assurance needs. It connects controlled requirements to physical assets, test evidence, issues, ownership, and acceptance decisions, making readiness review proactive and auditable. It also provides a foundation on which schedule, procurement, RFI, telemetry, and drawing capabilities could later be added. It deliberately does not claim to cover the entire challenge in version one.

### Gaps

- **Machine-learning delay prediction:** ~~The MVP's Schedule Management module performs deterministic optimization (CP-SAT) and event-driven re-solving, not statistical/ML-based delay forecasting or portfolio-level prediction.~~ **Superseded — see Predictive Schedule Risk Engine below.** Proactive, weeks-ahead risk prediction is now committed MVP scope and a core product differentiator (USP), delivered by a dedicated periodic-polling agent that feeds the deterministic Schedule Manager as a new trigger event type. Optional duration prediction from historical data (trained regression/boosting model) remains a later capability requiring labelled as-planned/as-built histories not yet available — that specific sub-capability stays deferred.
- **Live supply-chain intelligence:** ~~The MVP does not track shipments, multi-tier suppliers, ports, or geospatial routes in real time beyond the manually/API-reported shipment, approval, and weather-delay events that drive rescheduling, and it does not model procurement alternatives.~~ **Partially superseded — see Supply Chain Visibility & Risk Agent below.** Single-leg (origin→destination) geospatial shipment tracking with live AIS position, weather-adjusted ETA, and at-risk alerting is now committed MVP scope. Still excluded: multi-tier/multi-leg supplier visibility, live port-congestion feeds, route optimization, and procurement-alternative modelling. Procurement records may serve as supporting evidence.
- **Arbitrary drawing computer vision:** The MVP does not promise general CAD/BIM interpretation, geometry comparison, or automated shop-drawing approval. It may ingest supported PDF/image records and preserve visual citations; advanced drawing analysis requires a separate evaluated scope.
- **Broad RFI intelligence:** The MVP is not a general conversational layer over every project record and does not initially perform organization-wide similar-RFI retrieval or contractual answer generation. Source search is scoped narrowly to citation/evidence lookup (finding the exact source region backing a requirement or evidence record), powered by FTS5 as the primary user-facing mechanism; Vectorize is used only internally for extraction/classification matching (e.g., mapping proposed requirements to existing systems/assets), not as a user-facing semantic-search feature, keeping the boundary with a broad RFI copilot clean.
- **Independent compliance or Tier certification:** The platform cannot determine or issue TIA-942, BICSI, Uptime Tier III/IV, statutory, or contractual certification. It can organize licensed customer criteria and evidence for review by the authorized body only.
- **Full native integrations:** Initial pilots use controlled file imports and exports. Native Primavera P6 XER write-back, Procore, Autodesk Construction Cloud, Aconex, CxAlloy, BMS, and EPMS integrations are later work.
- **Automated telemetry validation:** Live time-series ingestion and automated integrated-system-test validation are excluded from the MVP.

### Assumptions

- No design partner or licensed project corpus is confirmed yet. Until one is secured, the build and validation approach uses synthetic/dummy commissioning data that mirrors the target document and evidence types, and this MVP is developed as a from-scratch prototype with no existing codebase or infrastructure to build around.
- Once a design partner is identified, that consultancy, owner's representative, or EPC/GC quality team is expected to provide a licensed or appropriately redacted project corpus and participate in validating the prototype against real data.
- The customer can identify the contractual document hierarchy, evidence owners, authorized reviewers, and rules that define readiness for the selected system and gate.
- A bounded first pilot can focus on one electrical or cooling system and one commissioning gate before expanding across L3-L5. In the absence of a confirmed design partner, the concrete placeholder used to keep the PRD and later documents from staying abstract is: **chilled water plant system, L4 Integrated Systems Test (IST) gate**. This is a hackathon/prototype placeholder, not a partner-confirmed pilot scope, and should be swapped for a real system/gate once a design partner is secured.
- Most initial evidence can be supplied through supported PDFs, spreadsheets, images, email exports, and controlled CSV templates without replacing the project's existing common data environment.
- The SaaS-versus-private/self-hosted deployment profile is not yet decided at the pilot/production stage. For this prototype, "self-hosted" is defined as strict tenant/data isolation within Cloudflare (dedicated account or project, region control, no cross-tenant infrastructure sharing) rather than true customer-premises/on-prem deployment, since Cloudflare's D1/Workers/R2/Vectorize primitives have no on-prem equivalent; this must still be confirmed contractually once a pilot customer is engaged.
- For the hackathon build itself, development targets **localhost only** (e.g., Dockerized local database), not a deployed Cloudflare environment, given time constraints. The committed Cloudflare-native tech stack (Workers, D1, R2, Vectorize, Workflows) is the target for a post-hackathon pilot/production stage, not a requirement for the hackathon demo; the local-dev architecture (e.g., which local DB substitutes for D1) is a TRD-stage decision, not resolved in this document.
- Human reviewers will remain available to accept extracted requirements, resolve ambiguity, approve waivers, close findings, and sign gate decisions.
- Source documents are legible enough for evaluated extraction. Photographs, scans, complex tables, handwriting, and multilingual material may require manual review and cannot silently become authoritative evidence.
- Pricing, willingness to pay, time-saving targets, and conversion assumptions remain hypotheses until validated through interviews and paid-pilot criteria.
- LLM extraction and explanation for the Schedule Management module use the Gemini API (not Claude), accessed only through the platform's internal `ModelProvider` interface, consistent with the existing no-direct-vendor-SDK rule.
- Resource-capacity data (crew counts, equipment availability) is LLM-extracted from vendor contracts/mobilization plans, with the same schema-validation and human-review-of-ambiguous-fields treatment as other extracted task fields; it is committed MVP scope, not deferred. Multi-mode task scheduling remains out of MVP scope. Weather-delay events are in scope as a task-level event type flowing through the same event → delta-detector → re-solve pipeline as shipment/approval events.

### Risks

- **Incorrect extraction or mapping:** OCR and model errors could associate the wrong requirement, asset, value, unit, or evidence. Mitigation requires exact citations, schema and unit validation, confidence handling, golden-set evaluations, and mandatory human acceptance.
- **False assurance:** A polished readiness score could be mistaken for engineering approval or certification. Readiness must remain rules-based, uncertainty must be visible, AI outputs must be labelled as proposals, and only an authorized human may sign a gate.
- **Standards and content licensing:** Proprietary standards or customer documents could be processed or reused without authorization. Each project must confirm machine-processing rights, isolate customer content, and prohibit unlicensed material in shared prompts, embeddings, models, templates, and demos.
- **Incomplete or conflicting project data:** Missing revisions, unclear precedence, delayed field records, or contradictory sources may make a definitive result impossible. The platform must show unknown and blocked states rather than infer completion.
- **Security and privacy:** EPC documents may contain commercially sensitive designs, operational details, personal data, and critical-infrastructure information. Tenant isolation, object-level authorization, encryption, retention/deletion controls, auditability, private-deployment options, and DPDP/legal review are release requirements.
- **Adoption friction:** Contractors may continue using email, spreadsheets, and existing CDEs, leaving the graph incomplete. The pilot must minimize replacement demands through CSV/PDF interoperability, responsive field capture, QR links, and measurable workflow value.
- **Integration and source-of-truth ambiguity:** Multiple project systems may disagree, and the MVP initially lacks native synchronization. Every import needs provenance, revision state, effective date, and an explicit contractual precedence rule.
- **Commercial competition:** Commissioning-management, submittal-review, project-graph, and drawing-intelligence vendors already cover adjacent capabilities. Pramana Cx must remain differentiated by controlled commissioning evidence, signed gate authority, change impact, and verifiable turnover rather than by generic RAG or graph claims.
- **Free-tier constraints:** A zero-cost technical launch is possible only within usage limits and is not an enterprise operating model. Contractual pilots require paid infrastructure, observability, support, backups, and appropriate service commitments.
- **Scheduling extraction/solver error:** Incorrect extraction of durations, dependencies, lead times, or resource-capacity figures could produce an infeasible or misleading schedule; incorrect DAG construction could hide a real cycle or dependency. Mitigation requires schema validation, mandatory human review of ambiguous/missing fields, DAG cycle checks before solving, and clear solver-side infeasibility reporting rather than silent approximation.

## Validated Scope

The validated scope is the intersection of the broad EPC challenge and the proposed commissioning-focused MVP: **source-grounded commissioning evidence and readiness assurance for a bounded data-centre system and gate**.

### In Scope for the Initial Pilot

- One Indian data-centre project, beginning with one high-value electrical or cooling system and one L3, L4, L5, or customer-defined gate.
- Project setup, tenant isolation, roles, evidence owners, approval authority, and immutable audit history.
- Ingestion of authorized specifications, requirements, asset registers, test procedures, issue/NCR logs, and evidence in supported document and tabular formats.
- Versioned originals, content hashes, exact page/region citations, structured extraction, unit checks, and a human review queue.
- Human-approved requirements linked to systems, assets, tests, evidence, issues, predecessors, responsible parties, and gate decisions.
- Deterministic readiness computation showing missing, stale, failed, blocked, and unapproved evidence with source and owner.
- Revision detection and downstream change impact that marks affected evidence and approvals for reassessment.
- Assignments, comments, due dates, field evidence capture, test-result recording, and authorized approvals.
- A readiness board, source-linked diagnostic, and verifiable turnover/evidence pack with hashes and decision history.
- A document-derived baseline schedule with CP-SAT-computed critical path, LLM-extracted resource-capacity constraints, plus deterministic event-triggered rescheduling (shipment, approval, and weather-delay events) with versioned history and generated change explanations.
- Measured pilot validation for citation integrity, extraction quality, high-severity precision, report/pack preparation time, workflow adoption, and paid-conversion criteria. Since this prototype has no confirmed design partner and will not obtain partner baseline data before the hackathon, provisional target numbers are used as **configurable defaults** (e.g., a config/constants module with named thresholds such as `HIGH_SEVERITY_PRECISION_TARGET`, `PACK_PREP_TIME_REDUCTION_TARGET`), not hardcoded inline — so real partner-derived thresholds can replace the defaults later without a code rewrite. Exact provisional values are set at the PRD stage.

### Explicitly Outside the Initial Pilot

- ~~Statistical or ML-based delay-risk prediction, portfolio forecasting, or claims of weeks-ahead predictive accuracy — the Schedule Management module is deterministic (CP-SAT), not predictive.~~ **Superseded — overridden.** Weeks-ahead predictive risk detection is committed MVP scope via the Predictive Schedule Risk Engine (see Committed Agent Suite). The re-solve/execution path stays deterministic (CP-SAT); only risk *detection* is predictive/advisory.
- ~~Live supplier, shipment, port, or geospatial supply-chain tracking and alternative sourcing models beyond the manually or API-reported events (shipment received/delayed, approval granted/rejected, weather delay) that drive rescheduling.~~ **Partially superseded — overridden.** Single-leg geospatial shipment tracking (live AIS position, weather-adjusted ETA, at-risk alerting) is committed MVP scope via the Supply Chain Visibility & Risk Agent. Multi-tier/multi-leg supplier tracking, live port-congestion feeds, geospatial route optimization, and alternative-sourcing/procurement-alternative models remain excluded.
- Multi-mode task scheduling (tasks with multiple possible durations depending on assigned resource level) — each task has a single fixed duration regardless of resource level; resource-capacity constraints only cap concurrent crew/equipment usage, they do not select among duration modes. This remains an open item, not committed MVP scope.
- General CAD/BIM understanding, arbitrary shop-drawing compliance, or advanced geometry comparison.
- A broad project chatbot, contractual RFI-answering system, or cross-project similar-RFI knowledge product.
- Independent Tier III/IV, TIA-942, BICSI, statutory, or contractual certification and any AI-issued compliance approval.
- Autonomous closure of findings, NCRs, waivers, tests, or readiness gates.
- Native write-back to scheduling/CDE platforms, live BMS/EPMS telemetry, portfolio analytics, and model fine-tuning.

Expansion beyond this scope requires evidence from the pilot: representative licensed data, named acceptance authority, measured user value, acceptable error rates, security and legal clearance, and a buyer willing to fund the next capability.

## Committed Agent Suite

Five domain agents, plus a proactive scheduling agent (see Proactive Schedule Management Module above) and an orchestrator agent (still emerging — to be defined later), form this platform. The high-level capability summary is below; each agent's committed design (scope, inputs/outputs, boundaries, tech stack) follows in its own subsection. All five are committed scope, not deferred — the per-agent "Committed Design" sections below are authoritative where they refine or override these summaries. Only the specific sub-capabilities called out under §Gaps and §Explicitly Outside the Initial Pilot remain out of scope.

- **Specification & Quality Compliance Agent** — ingests equipment specifications, design standards, and client requirements; checks procurement orders, vendor submittals, and shop drawings for deviations; flags non-conformances before site delivery; logs against the quality management audit trail.
- **Predictive Schedule Risk Engine** — single periodic-poll agent analysing schedules against real-time procurement status, equipment lead times, workforce availability, and weather; identifies critical-path risks weeks in advance; generates mitigation options, not just alerts. _(Committed scope: single periodic-poll agent, not a multi-agent system — per approved PRD.)_
- **Supply Chain Visibility & Risk Agent** — geospatial AI tracking critical equipment shipments (UPS systems, generators, cooling towers, switchgear) on a single leg (origin→destination); alerts on at-risk deliveries. _(Committed scope: single-leg only; no multi-tier supplier tracking and no procurement-alternative modelling — per approved PRD. See the agent's Committed Design section below, which is authoritative.)_
- **Commissioning Quality Assurance Copilot** — grounded in synthetic excerpts of data-centre commissioning standards (TIA-942, BICSI, Uptime Institute Tier specifications — no licensed/trained content); guides engineers through integrated system testing sequences; auto-generates test records; flags non-conformances against acceptance criteria; builds the as-commissioned quality documentation package.
- **Project Knowledge & RFI Intelligence Agent** — RAG-powered conversational layer over all project documents (specifications, submittals, RFIs, meeting minutes, change orders); answers technical/contractual queries in seconds with citations; identifies previously resolved similar RFIs to reduce rework cycles.

### Project Knowledge & RFI Intelligence Agent — Committed Design (Overrides Prior Exclusion)

**Scope override:** This supersedes the "Broad RFI intelligence" item under Gaps and the corresponding "broad project chatbot, contractual RFI-answering system, or cross-project similar-RFI knowledge product" exclusion under Explicitly Outside the Initial Pilot. This agent, scoped as below, is now committed. Vectorize is no longer internal-only — it is user-facing for this agent's semantic search, superseding Q10's answer.

**Inputs:** specifications, vendor submittals, test records, RFI logs, change orders, plus existing evidence-graph data (requirements, evidence, decisions, audit events).

**Two output surfaces:**
1. **Query chatbot** — NL question in, cited NL answer out, plus the exact source PDF/doc region.
2. **Interactive project graph/timeline page** — dynamic node graph of all project events (completed/ongoing/upcoming); each node click expands to show linked docs, vendor supply records, audits, and other data for that event.

**RAG architecture (hybrid metadata + existing typed graph + vector — not full GraphRAG):** the platform's existing typed graph (`edges`, `source_regions`, `systems/assets/gates`) is reused for structural relationship traversal instead of having an LLM re-derive an entity graph from text. Vector search is scoped to unstructured content retrieval only, within an already-filtered candidate set.

Pipeline:
1. Query intake — classify intent.
2. Logical routing — route to doc-type index (spec / submittal / test-record / RFI / change-order); no single mega-index.
3. Deterministic metadata filter (mandatory, first) — tenant_id, project_id, system/asset/gate, doc_type, date range, revision status.
4. Query decomposition — split compound queries into sub-queries before retrieval.
5. Multi-representation index — retrieval embedding (summary/chunk) separate from the pointer to the full original doc + exact page/bbox (`source_regions`) used for citation.
6. Graph traversal — expand retrieved chunk's linked entities via the existing `edges` table (REQUIRES/PROVES/AFFECTS/SUPERSEDES) for context; no fresh embedding step for this.
7. Similarity search — vector search runs only within the filtered + routed subset, never globally.
8. Re-rank + synthesis — LLM composes the answer; every claim must cite `source_region_id`, `document_version`, and content hash.
9. RFI similarity match — separate index scoped to `doc_type = RFI`; cosine-similarity threshold surfaces prior resolved RFIs as "previously resolved similar RFI" suggestions.

**Interactive graph/timeline page:** backed by the existing `edges` + `audit_events` tables (already append-only, hash-chained) as source of truth — no parallel datastore. Node = entity (event/doc/test/decision); click expands via existing FK relations (asset ↔ evidence ↔ decisions ↔ documents). Continuous updates come from agents writing typed edges + audit events on ingest; the page reads live state via API, it does not maintain its own store.

**Still bound by existing hard constraints:** AI output remains advisory only (citations + confidence, no approval authority); no unlicensed TIA-942/BICSI/Uptime/client/vendor content in embeddings; tenant isolation enforced at every query.

### Specification & Quality Compliance Agent — Committed Design

**Inputs:** equipment specifications, design standards, client requirements (source docs); procurement orders, vendor submittals, shop drawings (docs to check); existing accepted `requirements`.

**Outputs:** deviation/non-conformance flags citing exact clause vs. exact submittal/PO/drawing line; confidence score; auto-proposed `findings` (NCR) record (owner, severity, due date) pending human acceptance; `audit_events` entry.

**Relation to existing plan:** this agent extends, not duplicates, the existing requirement-extraction and evidence-graph pipeline. Requirement extraction from specs already exists (`requirements` table, source-region citation, mandatory human review). Non-conformance logging already exists (`findings` table). What's new is the comparison step (submittal/PO/drawing vs. accepted requirement) and shop drawings as an ingested `doc_type`. Build as a new service (`services/compliance-check`) consuming the existing `ModelProvider`, `requirements`, and `edges` infrastructure rather than a parallel stack.

**Tiered evaluation by requirement modality** (routed via `requirements.modality`) — the LLM never directly judges conformance; only deterministic/retrieval-grounded checks may produce a flag:
1. **Numeric/threshold** — deterministic value/unit/tolerance comparison. Auto-flaggable.
2. **Categorical/enum** — deterministic match against extracted claim, auto-flaggable only when no equivalence is asserted. When a submittal proposes an alternative/higher-grade item, this is NOT hardcoded — see equivalence-grounding below.
3. **Boolean/presence** — deterministic presence/absence check. Auto-flaggable.
4. **Narrative/qualitative** ("corrosion resistant", "suitable for outdoor use") — not deterministic. LLM semantic-similarity comparison surfaces a "possible mismatch" as a suggestion only, always routed to mandatory human review, never auto-flagged.
5. **Shop drawings (visual/geometric)** — out of scope per existing "Arbitrary drawing computer vision" gap; only text callouts/dimension labels are extracted (same OCR path as other docs), not geometry comparison.

**Equivalence/substitution grounding (replaces hardcoded category tables):** when a submittal claims an alternative or superior spec (e.g., a different but arguably-equivalent material/rating), the agent must retrieve supporting evidence before proposing a flag — it cannot freehand-judge equivalence:
- Retrieve from an ingested reference corpus: material/design standards, and the project's own approved-equal precedent log (`edges`/`decisions` history — has this substitution been approved before, on this or a past project).
- If a documented equivalence/supersession is found with citation → propose "equivalent, higher-grade" with source citation. If nothing is found → surface as "deviation requiring engineering judgment," not auto-accept or auto-reject.
- Tool-use pattern: agent orchestrates callable tools rather than freehand judging — `lookup_standard_clause(standard, clause_id)` (RAG over ingested standards), `check_precedent(project_id, material)` (query existing `edges`/`decisions`), `compare_spec_values(a, b, tolerance)` (deterministic numeric compare).
- Precedence: if client spec and referenced standard conflict, the agent must surface both with document hierarchy/date rather than silently picking one — same as the platform's existing "contradictory sources → show unknown, not inferred" rule.
- Groundedness gate: before any equivalence claim reaches a human reviewer as a flag, run a lightweight claim-vs-source groundedness check; unsupported claims are downgraded to "no precedent found, needs engineering judgment" rather than shown as a flag.

**Hackathon-scope note (added to existing synthetic-data assumption):** real licensed standards text (TIA-942/BICSI/ASTM/IS, etc.) cannot be ingested per the platform's licensing constraint. For the prototype, use small, clearly-labeled synthetic "standard excerpts" and a synthetic "approved-equivalents log" mirroring real document structure, ingested through the same pipeline — swappable for a real licensed corpus later without changing the architecture.

### Predictive Schedule Risk Engine — Committed Design (Overrides Prior Exclusion, Core USP)

**Scope override:** this supersedes the "Machine-learning delay prediction" item under Gaps and the "Statistical or ML-based delay-risk prediction... weeks-ahead predictive accuracy" exclusion under Explicitly Outside the Initial Pilot (both struck through above). Proactive, weeks-ahead risk detection is now a committed, core-differentiating (USP) capability, not deferred. The deterministic solver boundary is preserved: only risk *detection* is predictive/advisory; the actual re-solve/execution remains CP-SAT.

**Single job:** periodically evaluate forward schedule risk and, when a risk crosses a materiality threshold, emit a trigger event with mitigation options — it does not reschedule and does not decide anything by itself.

**Why a separate agent, not a stage on the Schedule Manager:** the Schedule Manager is event-triggered/reactive (fires on a discrete real-world event). This engine has no discrete trigger of its own — it must run on a periodic poll/continuous watch (procurement feeds, lead-time updates, workforce rosters, weather forecasts) and *decide when* a risk becomes material, at which point it *becomes* the trigger. Different runtime shape (poller/monitor vs. event-handler) justifies a distinct agent.

**Inputs:** current schedule/critical path (latest `schedule_versions` from Schedule Manager), procurement status, equipment lead times, workforce availability, weather forecast — external feeds/APIs, polled on an interval (Cloudflare Workflows/cron).

**Output → feeds Schedule Manager as a new event type:** `schedule_events.event_type = predicted_risk_delay`, carrying affected task(s), estimated delay/probability, source signal, and 1+ mitigation options (e.g. reallocate crew, expedite alternate vendor). Flows through the existing delta-detector → CP-SAT re-solve pipeline — no new solver logic required downstream.

**State/dedup:** must track what has already been flagged (by task + risk-type) so it only re-emits on material change, not every poll cycle — avoids trigger spam into the Schedule Manager.

**Mitigation options:** proposes options only (structured/text); does not select or apply one. A human or the deterministic solver (given a selected option as a constraint change) executes it — same AI-advisory/deterministic-execution boundary as the rest of the schedule module.

**UI:** a dedicated tab section — "Live Events" and "Delays/Risks" — showing real-time polled signals and any flagged predicted risks, separate from (but cross-linked to) the schedule/critical-path view.

### Commissioning Quality Assurance Copilot — Committed Design

**Scope:** delivers all five capabilities named in the Committed Agent Suite entry — standards-driven guidance, IST sequencing, test-record generation, acceptance-criteria flagging, and as-commissioned documentation packaging — for the bounded pilot (chilled water plant, L4 IST gate). Automated telemetry/BMS-EPMS validation, multimodal photo analysis (Gemini Vision), and cross-project standards learning stay out of scope per §Gaps.

**Inputs:** commissioning standards (TIA-942/BICSI/Uptime — synthetic excerpts for the hackathon, see below), pre-defined and user-uploaded test procedures, plus the executing engineer's per-step field readings; existing `systems`/`assets`/`gates`/`requirements` graph data.

**Workflow:** (1) ingest standards + procedures into the RAG store with clause/section metadata and source citations; (2) engineer picks system + gate + equipment + standards, and the agent RAG-generates a **draft** structured checklist (steps, acceptance criteria, cited clauses); (3) engineer executes steps, entering readings; (4) acceptance checks classify each step as `proposed_pass`/`proposed_fail` (deterministic for numeric/threshold and boolean/presence; narrative/qualitative always routed to `needs_human_review`, never auto-determined); (5) on a `proposed_fail`, emit a `TEST_FAILED` event (see orchestrator note); (6) the agent auto-drafts a test report labelled "DRAFT — PENDING ENGINEER REVIEW" for edit/approve/export; (7) on approval, the test record is linked as evidence to its gate and added to the turnover pack.

**AI-advisory boundary (unchanged platform rule):** checklists, acceptance assessments, and reports are all proposals. A completed all-pass test sets the gate to `PENDING_REVIEW`, never `READY` — only an authorized approver transitions a gate. The agent cannot certify, close an NCR, grant a waiver, or sign a test. LLM-generated clause citations must be verified against ingested-corpus metadata post-generation (hallucinated clause IDs are flagged, not silently accepted).

**Relation to existing plan:** extends, not duplicates, the evidence-graph pipeline. Test records become `evidence`; `TEST_FAILED` creates a `findings` (NCR) record and marks its gate `BLOCKED` via the existing typed-graph + audit-event pattern (Core Workflow steps 4–6). Requirement-modality tiering (numeric/categorical/boolean/narrative) mirrors the Specification & Quality Compliance Agent's evaluation tiers — the LLM never directly judges conformance on qualitative criteria.

**Tech stack (override of committed Cloudflare-native stack — see divergence note):** the ideation commits this agent to Python/FastAPI, Chroma (RAG over standards), Neo4j/NetworkX (test↔gate↔equipment graph), Gemini 2.5 Flash + Gemini embeddings, PyMuPDF, and ReportLab/python-docx for report export; React 19 + Leaflet-free step-execution UI (Tailwind, Zustand, TanStack Query). This is adopted as the agent's committed stack per user direction, **overriding** the platform's Cloudflare-native/`ModelProvider`/Workers-AI stack for this agent. The resulting polyglot architecture and how these services relate to the Workers/D1/R2 core is flagged as a **TRD-stage reconciliation item**, not resolved here.

**Hackathon-scope note:** no licensed TIA-942/BICSI/Uptime text is ingested — the prototype uses small, clearly-labelled synthetic "standard excerpts" (JSON, mirroring real clause/modality/acceptance-criteria structure), swappable for a licensed corpus later. In-process `asyncio` event bus for the demo; a durable broker is a production requirement. Multimodal photo input is named as a future differentiator but is not built for the hackathon.

### Supply Chain Visibility & Risk Agent — Committed Design (Overrides Prior Exclusion, single-leg only)

**Scope override:** this partially supersedes the "Live supply-chain intelligence" Gap item and the corresponding "Live supplier, shipment, port, or geospatial supply-chain tracking…" exclusion under Explicitly Outside the Initial Pilot (both struck through above). **Committed:** single-leg (origin→destination) geospatial tracking of critical equipment shipments (UPS, generators, cooling towers, switchgear) with live AIS position, weather-adjusted ETA, and red/amber/green at-risk alerting. **Still excluded:** multi-tier/multi-leg supplier visibility, live port-congestion feeds, geospatial route optimization, and procurement-alternative/alternative-sourcing modelling (the third capability in the agent-suite entry).

**Inputs:** shipment records (CSV / manual UI / optional ERP), each with equipment link, origin/destination coordinates, MMSI, planned ETA, and required-on-site date; live AIS vessel positions (aisstream.io WebSocket); weather (Open-Meteo). Port-congestion is a manual boolean flag (no free live feed); planned transit duration defaults to a configurable placeholder when absent.

**Workflow:** poll AIS position (~30s) with great-circle interpolation as fallback when AIS is unavailable (position transparently labelled live vs. simulated); fetch weather at origin, current position, and destination; compute a weather-adjusted ETA via a **deterministic** additive delay-factor heuristic (multiplier on remaining transit duration, not raw day-count); classify status against required-on-site-date minus a configurable buffer (🟢 on-time / 🟡 at-risk / 🔴 delayed); render shipments, routes, and weather on a Leaflet map with a click-to-zoom navigator table.

**AI-advisory boundary (unchanged platform rule):** delay detection and status classification are **deterministic** threshold math, not LLM output; ETAs are labelled estimates, never guaranteed delivery dates. The agent surfaces risk only — it does not reschedule, change gate status, select vendors, or modify POs.

**Output → feeds Schedule Manager + orchestrator:** on a status *change* into at-risk/delayed, emit `SHIPMENT_DELAYED` (deduplicated against last-notified status to prevent 30s poll spam), carrying affected equipment, old/new ETA, delay days, reason, and affected tasks; recovery emits `SHIPMENT_RECOVERED` to clear stale alerts. These flow through the existing event → delta-detector → CP-SAT re-solve pipeline — a delay lands as `schedule_events.event_type = 'shipment_delayed'`, a recovery as the distinct `event_type = 'shipment_recovered'`; the Predictive Schedule Risk Engine consumes the same events as a polling signal source. No new downstream solver logic.

**Tech stack (override of committed Cloudflare-native stack — see divergence note):** the ideation commits this agent to Python/FastAPI, `websockets` (AIS), `httpx` (weather), `turfpy` (great-circle), Chroma, Neo4j/NetworkX, and `asyncio`; React 19 + Leaflet/React-Leaflet, Tailwind, Zustand, TanStack Query, OpenStreetMap tiles (ODbL, attributed). Adopted as the agent's committed stack per user direction, **overriding** the Cloudflare-native stack for this agent; the polyglot reconciliation is a **TRD-stage item**.

**Hackathon-scope note:** synthetic/anonymized shipment records only (no proprietary vendor/PO/freight data); AIS and Open-Meteo are free-tier/non-commercial (production needs licensed weather + persistent single-socket AIS); single Mumbai destination for the demo (multi-site supported but untested); in-process `asyncio` event bus, durable broker deferred to production.

## Divergence Note — Agent-Suite Tech Stack vs. Committed Cloudflare-Native Stack

The two agent ideations above (Commissioning QA Copilot, Supply Chain Visibility & Risk) — and, on inspection, the shared orchestrator/event-bus pattern they assume — are authored against a **Python/FastAPI + Chroma + Neo4j/NetworkX + direct Gemini SDK + in-process asyncio** stack. This diverges from the platform's currently-committed **Cloudflare-native** stack (Workers/OpenNext in TypeScript, D1 + Drizzle, R2, Vectorize, Gemini only through the `ModelProvider` adapter, CP-SAT solver microservice, Workflows/Queues). Per user direction during integration, the agent-level stacks above are **recorded as overrides** (the new stack wins for these agents) rather than being conformed to the Cloudflare stack or left undecided. The consequences — a polyglot backend, a second RAG store (Chroma) alongside Vectorize, Neo4j alongside D1, direct Gemini calls outside the `ModelProvider` boundary, and an in-process event bus vs. Workflows/Queues — are **not reconciled in this document**; they are explicitly deferred to the **TRD stage**, consistent with the existing localhost-only hackathon-build assumption (Q12) that already flags a significant divergence from the committed stack table.

**Orchestrator (still emerging):** the orchestrator agent remains "to be defined later." What these two files newly pin down, and is recorded here as the emerging design, is its **event contract** — `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, and `predicted_risk_delay` events, each agent's emit conditions, and a unified "Command Center" alert surface that cross-links a triggering event to its downstream gate/finding/schedule impact. The full orchestrator definition (durable transport, routing rules, replay) is not settled here.

**Command Center alert surface (per PRD US-31):** the unified surface cross-links each triggering event to its downstream impact — `TEST_FAILED`→gate/finding, `SHIPMENT_DELAYED`/`predicted_risk_delay`→schedule-version impact. Alerts **dedup on status change** (a repeat event on the same subject updates the existing alert rather than stacking a new one), and a `SHIPMENT_RECOVERED` event **clears the stale alert** for its subject. Full dedup/routing mechanics are deferred to the orchestrator definition.

## Grill Session Answers

Grill session focused on the newly added Proactive Schedule Management module and its interaction with the existing evidence-control-plane product.

**Q1: Where do resource-capacity figures (crew/equipment counts) come from — manual entry, LLM extraction, or deferred entirely for MVP?**
Recommended: defer entirely for MVP (unconstrained/infinite capacity), structured so a capacity dimension can be added later.
Answer: LLM extraction — the extraction agent pulls resource-capacity figures (crew/equipment counts) from vendor contracts and mobilization plans alongside task extraction, using the same schema-validation and human-review-of-ambiguous-fields treatment as other extracted fields. Not deferred, not manual entry. This is committed MVP scope.

**Q2: Are multi-mode tasks (variable duration depending on assigned resource level) in scope for MVP now that resource-capacity data is being extracted?**
Recommended: keep single-mode for MVP; capacity is used only to cap concurrent resource usage, not to select among duration modes.
Answer: Confirmed — single-mode for MVP (option a). Each task has one fixed duration regardless of resource level; capacity only caps concurrent crew/equipment usage. Multi-mode RCPSP remains explicitly out of scope.

**Q3: How should weather integration feed the model — labor-availability capacity reduction, task-level outdoor-task delay, or out of scope entirely?**
Recommended: keep weather fully out of MVP scope, consistent with the existing "Explicitly Outside the Initial Pilot" language.
Answer: In scope as a new event type (option b) — a manually-reported or API-fed "weather delay" event (task-level) flows through the same event → delta-detector → re-solve pipeline as shipment/approval events. Not modeled as a labor-capacity/calendar adjustment (option c); not deferred (option a).

**Q4: How does the new schedule/task/event data model relate to the existing project/system/asset/gate schema — a fully parallel structure, or integrated into the existing typed graph and provenance chain?**
Recommended: integrate into the existing typed-edges/provenance graph rather than build a parallel disconnected structure.
Answer: Confirmed — integrate into the existing typed-edges/provenance graph (option b). New tables (`schedule_tasks`, `schedule_versions`, `resources`, `schedule_events`) hold task-specific fields, but link to `systems`/`assets`/`gates` via the existing `edges(from_type, from_id, to_type, to_id, relationship_type)` table, and cite `source_regions` for extraction provenance — the same pattern already used for `requirements`.

**Q5: Should schedule readiness (critical-path delay, infeasibility) feed into the existing deterministic gate readiness board (READY/BLOCKED/IN_REVIEW/UNKNOWN), or remain a separate, cross-linked view?**
Answer (best-practice recommendation, user pre-authorized proceeding on remaining minor questions): keep the schedule view separate from the deterministic gate readiness computation for MVP, but cross-link them via the existing typed-edges graph (e.g., a schedule task `PRECEDES`/`AFFECTS` a gate). Schedule delay/critical-path status is surfaced as contextual information alongside a gate (e.g., "critical-path task feeding this gate is N days behind"), but it does not become an input into the deterministic readiness rules themselves. Rationale: gate readiness is defined by accepted evidence, approvals, and blocking findings — a fundamentally different, human-acceptance-gated computation — and folding schedule state directly into that rules engine would blur the AI-advisory/deterministic-approval boundary and require redefining what "readiness" means mid-project. This can be revisited once a design partner validates whether schedule-linked readiness is a real requirement.

**Q6: Does the Gemini API swap (replacing Claude API) for schedule extraction/explanation conflict with the existing `ModelProvider` abstraction rule (no direct vendor SDK calls)?**
Answer (best-practice recommendation, user pre-authorized proceeding on remaining minor questions): no conflict — confirmed. Gemini is implemented as another `ModelProvider` adapter (alongside the Workers AI adapter already used for evidence-control-plane extraction), so the rest of the schedule module (extraction service, explainer service) calls the abstract `ModelProvider` interface only, never the Gemini SDK directly. This is already captured in the plan's assumptions list and requires no architectural change — it is a second concrete provider implementation, not an exception to the rule.

## Second Grill Session Answers

Grill session focused on scope, role naming, and hackathon delivery constraints.

**Q7: No design partner is confirmed — should the plan state a fallback so PRD work isn't blocked on this open dependency?**
Answer: Confirmed gap — no partner locked in. Added synthetic/anonymized-corpus fallback language to Assumptions (see above); this MVP is developed and validated as a from-scratch prototype using synthetic/dummy data until a partner is secured.

**Q8: The plan commits to "one system, one gate" for the pilot but stays abstract everywhere else — should a concrete placeholder system/gate be named?**
Answer: Yes, since this is a hackathon prototype. Placeholder = **chilled water plant system, L4 Integrated Systems Test (IST) gate**, recorded in Assumptions. To be swapped for a real system/gate once a design partner is secured.

**Q9: The Required Outcome names a single "authorized engineer" persona, but the Core Workflow describes at least three distinct RBAC roles (uploader, reviewer/acceptor, approver/signer) — is that a naming inconsistency?**
Answer: Confirmed inconsistency. "Authorized engineer" is now defined as a general viewer-level role distinct from reviewer/approver roles, reflecting that the MVP requires at least three RBAC permission levels.

**Q10: "Source search supports evidence review" is undefined, and the stack already provisions both FTS5 and Vectorize — does evidence-review search include semantic/similarity search, which would overlap with the excluded "broad RFI intelligence"?**
Answer: **⚠️ Superseded — see the Project Knowledge & RFI Intelligence Agent Committed Design above.** (Original answer, now overridden:) Scoped narrowly. FTS5 is the primary, user-facing citation/evidence-lookup mechanism; Vectorize is used only internally for extraction/classification matching (e.g., requirement-to-system/asset mapping), not exposed as a user-facing semantic search feature. Keeps the RFI-copilot exclusion boundary clean. — This no longer holds: the now-committed RFI agent makes Vectorize user-facing for scoped semantic search, per the approved PRD.

**Q11: The deployment profile is stated as "deferred," but the tech stack is already fully committed to Cloudflare-native primitives with no on-prem equivalent — direct contradiction?**
Answer: Resolved via option (a). "Self-hosted" is redefined for this prototype as strict tenant/data isolation within Cloudflare (dedicated account/project, region control, no cross-tenant infra sharing), not true customer-premises deployment. A portable non-Cloudflare abstraction layer is explicitly not committed at this stage.

**Q12: Given this is a time-boxed hackathon build, is there a hard requirement to run the demo within Cloudflare free tiers, or can localhost/Docker-only development be used instead?**
Answer: Localhost-only for the hackathon build (e.g., Dockerized local database), not a deployed Cloudflare environment — driven by time constraints. Free-tier Cloudflare deployment is deferred to a later pilot/production stage, not required for the hackathon demo. This is flagged as a significant divergence from CLAUDE.md's currently committed Cloudflare-native tech stack table; the concrete local-dev architecture (which local service substitutes for D1/R2/etc.) is left open as a TRD-stage decision, not resolved here.

**Q13: The Validated Scope's pilot-validation measures (citation integrity, extraction quality, high-severity precision, etc.) are named with no numeric thresholds anywhere — should the PRD define these, or are provisional numbers needed now?**
Answer: Provisional numbers are set now (not deferred to PRD) since this prototype will likely never reach a design partner to derive real baselines. They must be implemented as **configurable defaults** (named constants/config values), not hardcoded inline, so they can be overridden once real data exists.
