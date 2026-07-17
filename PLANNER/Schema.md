# Pramana Cx Data Schema

## Entities / Tables

### Entity Overview

| Entity | Purpose | Created by | Read by |
|---|---|---|---|
| `tenants` | Isolates a customer organization and its projects | Platform administrator | All project-scoped services |
| `users` | Stores authenticated people and approval identity | User/admin workflow | Auth and audit services |
| `projects` | Defines a commissioning workspace and policy boundary | Project administrator | All project workflows |
| `project_members` | Assigns a user a project-scoped role | Project administrator | Authorization middleware |
| `documents` | Represents a logical source document | Project member | Ingestion and review workflows |
| `document_versions` | Stores a revision and its processing state | Ingestion service | Provenance and change impact |
| `source_regions` | Locates extracted text or visual evidence in a version | Extraction service | Review, search, and citations |
| `systems` | Represents an electrical, cooling, or other project system | Project member | Readiness and asset views |
| `assets` | Represents equipment or tagged field items | Project member/import | Evidence and test workflows |
| `gates` | Defines a commissioning stage and prerequisites | Project administrator | Readiness and decisions |
| `requirements` | Stores accepted project obligations and proposals | Extraction/reviewer | Rules and review queue |
| `evidence` | Stores records that prove a requirement or test outcome | Project member | Readiness and exports |
| `test_procedures` | Defines an authorized procedure and acceptance criteria | Commissioning engineer | Test execution |
| `test_steps` | Defines ordered steps within a procedure | Commissioning engineer | Test execution |
| `test_runs` | Records execution and result of a procedure | Field engineer | Readiness and exports |
| `findings` | Stores NCRs, blockers, and review findings | QA/QC lead or rule | Readiness and action queues |
| `edges` | Stores typed relationships between project entities | Project member/service | Graph traversal and impact analysis |
| `decisions` | Stores authorized gate decisions and waivers | Authorized approver | Readiness and turnover packs |
| `audit_events` | Provides append-only history and hash chain | Application service | Audit and export verification |
| `schedule_tasks` | Stores AI-proposed/human-reviewed schedule task records (duration, dependencies, vendor, lead time, resource requirement, deadline type) | Gemini extraction agent/reviewer | Solver assembly, review queue, schedule board |
| `resources` | Stores AI-proposed/human-reviewed resource-capacity records (crew/equipment counts) per vendor | Gemini extraction agent/reviewer | Solver assembly, review queue |
| `schedule_versions` | Stores an immutable, versioned snapshot produced by a baseline solve or re-solve | CP-SAT solver microservice call (via local job) | Schedule/critical-path view, explainer, exports |
| `scheduled_tasks` | Stores a task's computed start/end dates and critical-path flag for one schedule version | CP-SAT solver microservice call (via local job) | Schedule/critical-path view, diff/explanation |
| `schedule_events` | Stores a reported real-world event (shipment, approval, weather delay, predicted risk) and whether it triggered a re-solve | Field/vendor/approval report, Supply Chain / Predictive Risk agents | Delta detector, re-solve audit trail |
| `cx_checklists` | Stores an AI-generated **draft** IST checklist tied to a system, gate, equipment, and standard set | Commissioning QA Copilot agent-service (via Node core) | Engineer review, step execution, turnover linkage |
| `cx_checklist_steps` | Stores an ordered checklist step with a modality-typed acceptance criterion | Commissioning QA Copilot agent-service (via Node core) | Step execution and deterministic acceptance checks |
| `cx_clause_citations` | Stores an LLM-cited standard clause and its post-generation verification result | Commissioning QA Copilot agent-service (via Node core) | Citation-verification display, engineer review |
| `cx_test_records` | Stores one execution of a checklist: executing engineer, overall status, and draft/approved report lifecycle | Commissioning engineer via the copilot | Evidence/turnover linkage, gate impact, exports |
| `cx_step_results` | Stores a per-step field reading and its deterministic or human-review verdict | Commissioning engineer via the copilot | Acceptance checks, `TEST_FAILED` handling, report drafting |
| `shipments` | Stores a single-leg critical-equipment shipment tracking record (coords, MMSI, ETAs, R/A/G status, dedup state) | Supply Chain Visibility & Risk agent-service (via Node core) | Map/navigator view, status classification, `schedule_events` emission |
| `compliance_checks` | Stores one Specification & Quality Compliance comparison of an accepted `requirement` against a submittal/PO/shop-drawing line, its modality-routed verdict, groundedness state, and proposed finding | Specification & Quality Compliance agent-service (`services/compliance-check`, via Node core) | Compliance review queue, finding proposal, audit |
| `schedule_risks` | Stores a Predictive Schedule Risk Engine flagged forward-risk (task + risk-type) with estimated delay/probability, mitigation-option proposals, and emitted-event link | Predictive Schedule Risk Engine periodic-poll worker | "Delays/Risks" surface, dedup state, schedule pipeline |
| `risk_signal_readings` | Stores a per-poll external forward-risk signal observation (or explicit data-unavailable state) backing the "Live Events" surface | Predictive Schedule Risk Engine periodic-poll worker | "Live Events" surface, risk evaluation |
| `knowledge_chunks` | Stores a retrieval chunk + pgvector embedding with mandatory metadata-filter columns for scoped, metadata-filtered semantic search (RFI user-facing) and internal extraction/classification matching | Ingestion/embedding service | RFI scoped semantic search, internal task/requirement/clause matching |
| `alerts` | Stores a Command Center alert cross-linking a triggering event to its downstream gate/finding/schedule-version impact, deduplicated on status change and cleared on recovery | Node core (from agent-emitted events) | Command Center surface (read/cross-link only) |

Every table includes `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` unless noted otherwise. UUIDs are generated by the application or database and are never natural keys.

### Table Definitions

#### tenants

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Customer organization identifier |
| name | VARCHAR(200) | NOT NULL | Organization display name |
| retention_days | INTEGER | NOT NULL, CHECK > 0 | Default project-data retention period |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last policy change |

#### users

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | User identifier |
| email | VARCHAR(320) | UNIQUE, NOT NULL | Login and notification address |
| display_name | VARCHAR(200) | NOT NULL | Human-readable name |
| totp_enabled | BOOLEAN | NOT NULL, DEFAULT false | Whether strong authentication is enabled |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last profile change |

#### projects

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Project identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Owning organization |
| name | VARCHAR(200) | NOT NULL | Project name |
| code | VARCHAR(80) | NOT NULL | Customer-facing project code |
| timezone | VARCHAR(64) | NOT NULL | Project reporting timezone |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('active','archived') | Workspace lifecycle |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last project change |

#### project_members

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Membership identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| user_id | UUID | FK -> users.id, NOT NULL | Member identity |
| role | VARCHAR(30) | NOT NULL, CHECK IN ('admin','commissioning_manager','reviewer','field_engineer','viewer','approver','scheduler') | Project permission role (includes the project scheduler/planner role for schedule endpoints) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Membership creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last role change |

Unique constraint: `(project_id, user_id)`.

#### documents

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Logical document identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| document_type | VARCHAR(40) | NOT NULL | Specification, procedure, register, issue log, vendor contract, timeline, PO, approval, commissioning-standard excerpt (synthetic, agent-ingested), submittal, shop-drawing text callout, approved-equal precedent, RFI, change order, or other source category |
| title | VARCHAR(300) | NOT NULL | Human-readable document title |
| created_by | UUID | FK -> users.id, NOT NULL | Uploading member |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | First upload time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last version time |

#### document_versions

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Revision identifier |
| document_id | UUID | FK -> documents.id, NOT NULL | Logical document |
| revision | VARCHAR(80) | NOT NULL | Customer revision label |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('draft','approved','superseded','rejected') | Revision authority state |
| sha256 | CHAR(64) | UNIQUE, NOT NULL | Immutable content hash |
| object_key | VARCHAR(500) | UNIQUE, NOT NULL | Local object store (MinIO/filesystem) object location |
| media_type | VARCHAR(120) | NOT NULL | Stored MIME type |
| effective_at | TIMESTAMPTZ | NULL | Date the revision becomes contractually effective |
| uploaded_by | UUID | FK -> users.id, NOT NULL | Uploading user |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Upload time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Processing/status time |

#### source_regions

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Citation identifier |
| document_version_id | UUID | FK -> document_versions.id, NOT NULL | Source revision |
| page_number | INTEGER | NOT NULL, CHECK > 0 | PDF/image page number |
| bbox_json | TEXT | NULL | JSON-encoded page-region coordinates |
| extracted_text | TEXT | NOT NULL | Text shown to reviewer/search |
| content_hash | CHAR(64) | NOT NULL | Hash of extracted region content |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Extraction time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Re-extraction time |

#### systems

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | System identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| name | VARCHAR(200) | NOT NULL | System name |
| system_type | VARCHAR(40) | NOT NULL | Electrical, cooling, controls, or other type |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('planned','under_construction','testing','ready','archived') | Current delivery state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

#### assets

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Asset identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| system_id | UUID | FK -> systems.id, NOT NULL | Parent system |
| tag | VARCHAR(120) | NOT NULL | Field or asset-register tag |
| asset_type | VARCHAR(100) | NOT NULL | Equipment category |
| vendor | VARCHAR(200) | NULL | Manufacturer or supplier |
| serial_number | VARCHAR(200) | NULL | Installed serial number |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('planned','installed','tested','accepted','rejected') | Asset lifecycle state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

Unique constraint: `(project_id, tag)`.

#### gates

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Gate identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| system_id | UUID | FK -> systems.id, NOT NULL | System being gated |
| name | VARCHAR(120) | NOT NULL | L1-L5 or customer-defined gate name |
| sequence_number | INTEGER | NOT NULL, CHECK > 0 | Gate ordering |
| approval_role | VARCHAR(30) | NOT NULL | Role permitted to sign |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('not_started','in_review','ready','blocked','approved') | Current computed/decision state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

No new gate status value is introduced for the Commissioning QA Copilot: the copilot's `PENDING_REVIEW` outcome (a completed all-pass test) maps to the existing `status = 'in_review'` value, and a `TEST_FAILED` maps to the existing `status = 'blocked'` value — both transitions are recorded as `audit_events`, and only an authorized approver can move the gate further.

#### requirements

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Requirement identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| source_region_id | UUID | FK -> source_regions.id, NOT NULL | Exact requirement source |
| statement | TEXT | NOT NULL | Normalized requirement text |
| modality | VARCHAR(20) | NOT NULL, CHECK IN ('shall','should','may','informational') | Obligation strength |
| numeric_value | DECIMAL(20,8) | NULL | Normalized numeric criterion |
| unit | VARCHAR(40) | NULL | Unit for numeric criterion |
| tolerance | DECIMAL(20,8) | NULL | Permitted numeric deviation |
| review_state | VARCHAR(20) | NOT NULL, CHECK IN ('proposed','accepted','edited','rejected') | Human authority state |
| confidence | DECIMAL(5,4) | NULL, CHECK BETWEEN 0 AND 1 | Model proposal confidence |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last review/change time |

The Specification & Quality Compliance Agent evaluates an accepted `requirement` against a submittal/PO/shop-drawing line by routing on `requirements.modality` (numeric/threshold, categorical/enum, boolean/presence deterministic; narrative/qualitative to mandatory human review); the comparison itself is recorded in `compliance_checks`, and no compliance-specific column is added here.

#### evidence

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Evidence identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| source_region_id | UUID | FK -> source_regions.id, NULL | Source citation when document-backed |
| asset_id | UUID | FK -> assets.id, NULL | Proven asset |
| system_id | UUID | FK -> systems.id, NOT NULL | Proven system |
| evidence_type | VARCHAR(40) | NOT NULL | Test, inspection, photo, submittal, or approval evidence |
| validity_state | VARCHAR(20) | NOT NULL, CHECK IN ('pending','accepted','stale','failed','rejected') | Evidence authority/currentness |
| captured_by | UUID | FK -> users.id, NOT NULL | Capturing user |
| captured_at | TIMESTAMPTZ | NOT NULL | Field or source capture time |
| content_hash | CHAR(64) | NULL | Hash of evidence content |
| valid_until | TIMESTAMPTZ | NULL | Optional expiry time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last state change |

This table is reused, unchanged, as the durable home of an **approved Commissioning QA Copilot test record**: on engineer approval, a `cx_test_records` row is materialized as an `evidence` row (`evidence_type = 'test'`, `system_id`/`asset_id` from the checklist, `captured_by` = the executing engineer, `content_hash` = the object-store report artifact's hash) and linked to its gate through the existing typed-edges pattern, entering the turnover pack like any other accepted evidence. No parallel "agent evidence" table exists.

#### test_procedures

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Procedure identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| system_id | UUID | FK -> systems.id, NOT NULL | Tested system |
| source_region_id | UUID | FK -> source_regions.id, NULL | Procedure source |
| name | VARCHAR(250) | NOT NULL | Procedure name |
| version | VARCHAR(80) | NOT NULL | Controlled procedure revision |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('draft','approved','superseded') | Procedure authority state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

#### test_steps

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Step identifier |
| test_procedure_id | UUID | FK -> test_procedures.id, NOT NULL | Parent procedure |
| sequence_number | INTEGER | NOT NULL, CHECK > 0 | Execution order |
| instruction | TEXT | NOT NULL | Action to perform |
| acceptance_rule | TEXT | NOT NULL | Pass/fail rule |
| required | BOOLEAN | NOT NULL, DEFAULT true | Whether step is mandatory |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

Unique constraint: `(test_procedure_id, sequence_number)`.

#### test_runs

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Test execution identifier |
| test_procedure_id | UUID | FK -> test_procedures.id, NOT NULL | Executed procedure |
| gate_id | UUID | FK -> gates.id, NOT NULL | Gate supported by the run |
| executed_by | UUID | FK -> users.id, NOT NULL | Field engineer |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('draft','passed','failed','voided') | Execution result |
| executed_at | TIMESTAMPTZ | NULL | Completion time |
| instrument_reference | VARCHAR(200) | NULL | Calibration or instrument record reference |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Start time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last result change |

`test_procedures`/`test_steps`/`test_runs` remain the human-authored, controlled-procedure path. The Commissioning QA Copilot's AI-drafted checklists are a distinct origination path with a different lifecycle (RAG-generated draft, modality-typed criteria, citation verification, deterministic verdicts) and are therefore modeled in the new `cx_*` tables below rather than overloaded onto these tables; both paths converge on the same `evidence`/`findings`/`gates` records.

#### findings

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Finding or NCR identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| system_id | UUID | FK -> systems.id, NULL | Affected system |
| gate_id | UUID | FK -> gates.id, NULL | Affected gate |
| title | VARCHAR(250) | NOT NULL | Short finding title |
| severity | VARCHAR(20) | NOT NULL, CHECK IN ('low','medium','high','critical') | Impact classification |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('open','in_progress','resolved','accepted') | Disposition state |
| owner_id | UUID | FK -> users.id, NULL | Accountable owner |
| due_at | TIMESTAMPTZ | NULL | Required resolution time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last disposition change |

This table is reused, unchanged, as the durable home of both a **`TEST_FAILED` NCR** and a **Specification & Quality Compliance deviation**: a Commissioning QA Copilot `proposed_fail` verdict creates a `findings` row (`gate_id`/`system_id` from the failing test's checklist, severity proposed by the copilot, disposed through the existing findings lifecycle) referenced back from `cx_step_results.finding_id`; and an accepted compliance deviation flag creates a `findings` row (owner/severity/due date proposed by the compliance agent, pending human acceptance) referenced back from `compliance_checks.proposed_finding_id`. No parallel "agent NCR" table exists.

#### edges

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Relationship identifier |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| from_type | VARCHAR(40) | NOT NULL | Source entity type (includes `schedule_task`, `resource`, `scheduled_task`, and — new — `cx_checklist`, `cx_test_record`, `shipment`) |
| from_id | UUID | NOT NULL | Source entity identifier |
| to_type | VARCHAR(40) | NOT NULL | Target entity type (includes `schedule_task`, `resource`, `scheduled_task`, and — new — `cx_checklist`, `cx_test_record`, `shipment`) |
| to_id | UUID | NOT NULL | Target entity identifier |
| relationship_type | VARCHAR(30) | NOT NULL, CHECK IN ('REQUIRES','PROVES','BLOCKS','SUPERSEDES','AFFECTS','PRECEDES','ASSIGNED_TO','TRACKS') | Meaning of the relationship; schedule tasks use `PRECEDES` for dependency-DAG edges and `AFFECTS`/`REQUIRES` to cross-link a `gate`/`system`/`asset` for contextual surfacing only. New agent usage: a `shipment` `TRACKS` the `asset`/equipment it delivers (`TRACKS` is the only new value) and `AFFECTS` the `schedule_task`(s) its delay threatens; a `cx_checklist` `REQUIRES` the standard/procedure `document`(s) it was generated from; a `cx_test_record` reuses `PROVES` toward a `requirement` and `AFFECTS` toward the `gate` it feeds; a Predictive Schedule Risk `schedule_risk` cross-links its affected `schedule_task`(s) via `AFFECTS`; the Specification agent's `check_precedent` reads existing `AFFECTS`/`PROVES` approved-equal history via `edges`/`decisions` |
| created_by | UUID | FK -> users.id, NOT NULL | Creating actor |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Relationship creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Relationship update time |

Unique constraint: `(project_id, from_type, from_id, to_type, to_id, relationship_type)`.

#### decisions

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Decision identifier |
| gate_id | UUID | FK -> gates.id, NOT NULL | Decided gate |
| approver_id | UUID | FK -> users.id, NOT NULL | Authorized decision maker |
| action | VARCHAR(20) | NOT NULL, CHECK IN ('approve','reject','waive') | Decision action |
| reason | TEXT | NOT NULL | Human rationale |
| evidence_baseline | CHAR(64) | NOT NULL | Hash of evaluated evidence state |
| rule_version | VARCHAR(80) | NOT NULL | Readiness rule version |
| decided_at | TIMESTAMPTZ | NOT NULL | Decision time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record correction metadata |

#### audit_events

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Audit event identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NULL | Project scope when applicable |
| actor_id | UUID | FK -> users.id, NULL | User or service actor |
| action | VARCHAR(80) | NOT NULL | Operation performed (includes schedule task/resource review, schedule version creation, event ingestion, Commissioning test acceptance/failure, checklist/report approval, gate `BLOCKED` transition, shipment status-change event ingestion, and — new — compliance-flag proposal/acceptance and predicted-risk emission) |
| object_type | VARCHAR(40) | NOT NULL | Affected entity type |
| object_id | UUID | NOT NULL | Affected entity identifier |
| before_hash | CHAR(64) | NULL | Previous representation hash |
| after_hash | CHAR(64) | NULL | New representation hash |
| previous_event_hash | CHAR(64) | NULL | Hash-chain predecessor |
| event_hash | CHAR(64) | UNIQUE, NOT NULL | Hash of this event |
| occurred_at | TIMESTAMPTZ | NOT NULL | Event time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Persistence time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Persistence metadata |

#### schedule_tasks

Proposed by the Gemini `ModelProvider` extraction agent from vendor contracts, timelines, POs, and approval documents; mirrors the `requirements` proposal/review pattern. Only `accepted` tasks are eligible for DAG assembly and solving.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Task identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| source_region_id | UUID | FK -> source_regions.id, NOT NULL | Exact extraction citation (mandatory, mirrors `requirements.source_region_id`) |
| name | VARCHAR(250) | NOT NULL | Task name |
| duration_days | DECIMAL(10,2) | NULL, CHECK > 0 | Estimated single-mode task duration; NULL only while `review_state = 'proposed'` and flagged ambiguous |
| vendor | VARCHAR(200) | NULL | Responsible vendor/contractor |
| lead_time_days | DECIMAL(10,2) | NULL, CHECK >= 0 | Procurement/mobilization lead time before task can start |
| resource_requirement_json | TEXT | NULL | JSON-encoded resource type/quantity demand consumed against `resources` capacity |
| deadline_type | VARCHAR(10) | NULL, CHECK IN ('hard','soft') | Whether the task carries a hard or soft deadline constraint |
| deadline_at | TIMESTAMPTZ | NULL | Deadline date when `deadline_type` is set |
| review_state | VARCHAR(20) | NOT NULL, DEFAULT 'proposed', CHECK IN ('proposed','accepted','edited','rejected') | Human authority state; only `accepted`/`edited`-then-accepted tasks are solvable |
| confidence | DECIMAL(5,4) | NULL, CHECK BETWEEN 0 AND 1 | Model proposal confidence |
| needs_review | BOOLEAN | NOT NULL, DEFAULT false | Set when any required field is missing/ambiguous; blocks auto-acceptance |
| reviewed_by | UUID | FK -> users.id, NULL | Reviewer who accepted/edited/rejected the proposal |
| reviewed_at | TIMESTAMPTZ | NULL | Review action time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Extraction time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last review/change time |

Dependency/precedence between tasks is stored as `edges` rows (`relationship_type = 'PRECEDES'`) between two `schedule_task` entities, not as an in-row column, keeping one dependency-graph representation shared with the rest of the provenance graph.

#### resources

Proposed by the same Gemini extraction agent alongside task extraction; stores crew/equipment capacity figures per vendor, used only to cap concurrent usage in the CP-SAT solve (single-mode scheduling; no duration-mode selection).

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Resource-capacity record identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| source_region_id | UUID | FK -> source_regions.id, NOT NULL | Exact extraction citation |
| vendor | VARCHAR(200) | NOT NULL | Vendor/contractor the capacity belongs to |
| resource_type | VARCHAR(100) | NOT NULL | Crew trade or equipment category |
| crew_count | INTEGER | NULL, CHECK >= 0 | Concurrent crew capacity |
| equipment_count | INTEGER | NULL, CHECK >= 0 | Concurrent equipment capacity |
| review_state | VARCHAR(20) | NOT NULL, DEFAULT 'proposed', CHECK IN ('proposed','accepted','edited','rejected') | Human authority state; only `accepted` records are used by the solver |
| confidence | DECIMAL(5,4) | NULL, CHECK BETWEEN 0 AND 1 | Model proposal confidence |
| needs_review | BOOLEAN | NOT NULL, DEFAULT false | Set when crew/equipment counts are missing/ambiguous |
| reviewed_by | UUID | FK -> users.id, NULL | Reviewer who accepted/edited/rejected the proposal |
| reviewed_at | TIMESTAMPTZ | NULL | Review action time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Extraction time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last review/change time |

#### schedule_versions

Immutable, versioned snapshot produced by a CP-SAT baseline solve (`v1`) or a subsequent warm-started re-solve. Never updated in place; a re-solve always creates a new row pointing at its predecessor.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Schedule version identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| version_number | INTEGER | NOT NULL, CHECK > 0 | Sequential version label (`v1`, `v2`, ...) within the project |
| previous_version_id | UUID | FK -> schedule_versions.id, NULL | Predecessor version (`NULL` only for `v1`) |
| triggering_event_id | UUID | FK -> schedule_events.id, NULL | Event that caused this re-solve (`NULL` for the baseline `v1`) |
| status | VARCHAR(20) | NOT NULL, CHECK IN ('feasible','infeasible') | Whether the solver returned a feasible schedule |
| overrun_days | DECIMAL(10,2) | NULL, CHECK >= 0 | Minimum deadline overrun when `status = 'infeasible'` |
| bottleneck_constraint | TEXT | NULL | Human-readable bottleneck description when `status = 'infeasible'` |
| solver_version | VARCHAR(80) | NOT NULL | CP-SAT/OR-Tools version used to produce this snapshot |
| solved_at | TIMESTAMPTZ | NOT NULL | Solver completion time |
| explanation_summary | TEXT | NULL | Human-readable Gemini-generated diff summary (triggering event, shifted tasks, net deadline impact); `NULL` for `v1` and while generation is pending |
| explanation_model_version | VARCHAR(80) | NULL | Gemini model version that generated `explanation_summary` |
| explanation_generated_at | TIMESTAMPTZ | NULL | Explanation generation completion time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Persistence time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Reserved; version rows are otherwise immutable and only gain the `explanation_*` fields after creation |

Unique constraint: `(project_id, version_number)`.

#### scheduled_tasks

Per-version computed state for one `schedule_task`; one row per (`schedule_version`, `schedule_task`) pair. Stores what the CP-SAT solver actually produced for that task in that version, distinct from the task's own extracted attributes in `schedule_tasks`.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Scheduled-task-state identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| schedule_version_id | UUID | FK -> schedule_versions.id, NOT NULL | Parent immutable version |
| schedule_task_id | UUID | FK -> schedule_tasks.id, NOT NULL | Solved task |
| computed_start_at | TIMESTAMPTZ | NOT NULL | Solver-computed start date for this version |
| computed_end_at | TIMESTAMPTZ | NOT NULL | Solver-computed end date for this version |
| is_critical_path | BOOLEAN | NOT NULL, DEFAULT false | Whether the task lies on the critical path in this version |
| actual_status | VARCHAR(20) | NOT NULL, DEFAULT 'planned', CHECK IN ('planned','in_progress','complete','delayed') | Real-world execution status carried forward across re-solves |
| actual_date | TIMESTAMPTZ | NULL | Reported real-world date backing `actual_status` (e.g., shipment-received date) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Solve/persistence time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last `actual_status`/`actual_date` update (unaffected-event path only; the computed dates themselves never change in place) |

Unique constraint: `(schedule_version_id, schedule_task_id)`.

#### schedule_events

Reported real-world event evaluated by the delta detector against the current `schedule_version`'s critical path and dependency structure.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Event identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| schedule_task_id | UUID | FK -> schedule_tasks.id, NOT NULL | Affected task; must exist in the current schedule version or the event is rejected |
| event_type | VARCHAR(30) | NOT NULL, CHECK IN ('shipment_received','shipment_delayed','shipment_recovered','approval_granted','approval_rejected','weather_delay','predicted_risk_delay') | Reported real-world event category (`shipment_recovered` and `predicted_risk_delay` are the newly added values — see the mapping notes below) |
| shipment_id | UUID | FK -> shipments.id, NULL | Originating `shipments` row when the event was emitted by the Supply Chain agent; `NULL` for manually/API-reported and predicted-risk events |
| schedule_risk_id | UUID | FK -> schedule_risks.id, NULL | **New column.** Originating `schedule_risks` row when the event was emitted by the Predictive Schedule Risk Engine (`event_type = 'predicted_risk_delay'`); `NULL` otherwise |
| occurred_at | TIMESTAMPTZ | NOT NULL | Event occurrence time |
| details | TEXT | NULL | Free-text/JSON event detail (e.g., delay reason, approval reference; for agent-emitted shipment events: old/new ETA, delay days, reason — weather factor / AIS lag / port-congestion flag — and affected equipment; for predicted-risk events: estimated delay/probability, source signal, mitigation-option proposals) |
| triggered_resolve | BOOLEAN | NOT NULL, DEFAULT false | Whether the delta detector determined a re-solve was required |
| resulting_schedule_version_id | UUID | FK -> schedule_versions.id, NULL | New version produced, when `triggered_resolve = true` |
| solve_status | VARCHAR(20) | NOT NULL, DEFAULT 'not_applicable', CHECK IN ('not_applicable','pending','solved','solve_failed') | Idempotency/outcome tracking for the solver call keyed by `(schedule_version_id, event_id)` |
| reported_by | UUID | FK -> users.id, NULL | Reporting user, when manually entered (`NULL` for API-fed and agent-emitted events) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Ingestion time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Delta-check/solve outcome update time |

**`SHIPMENT_DELAYED` / `SHIPMENT_RECOVERED` persistence (reuse, not a new table).** The Supply Chain agent's delay and recovery events persist as ordinary `schedule_events` rows posted through the existing `POST /v1/projects/{id}/schedule/events` path: a status transition into at-risk/delayed inserts `event_type = 'shipment_delayed'`; a transition back to on-time inserts `event_type = 'shipment_recovered'` (the recovery must be distinguishable from a delay for the alert-clearing semantics, while the delta detector treats both identically as ETA-change events against the affected task, so no new downstream solver logic is introduced). Each row links back to its `shipments` record via the nullable `shipment_id` FK, carries the event payload (old/new ETA, delay days, reason, affected equipment) in `details`, and flows through the unchanged delta-detector → warm-started CP-SAT re-solve pipeline (`triggered_resolve`, `resulting_schedule_version_id`, and `solve_status` behave exactly as for every other event kind). Deduplication is enforced upstream by `shipments.last_notified_status`: at most one row per genuine status transition, never one per ~30s poll cycle.

**`predicted_risk_delay` persistence (reuse, not a new table).** The Predictive Schedule Risk Engine's material forward-risk emits persist as ordinary `schedule_events` rows posted through the same `POST /v1/projects/{id}/schedule/events` path with `event_type = 'predicted_risk_delay'`, each linked back to its `schedule_risks` row via the nullable `schedule_risk_id` FK and carrying estimated delay/probability, source signal, and mitigation-option proposals in `details`. A risk affecting N tasks fans out to N `schedule_events` rows (one per affected task, resolved via the risk's `AFFECTS` edges), per the fan-out rule. It flows through the unchanged delta-detector → warm-started CP-SAT re-solve pipeline; mitigation options are proposals only — the engine never reschedules or applies one. Deduplication is enforced upstream by the `schedule_risks` `(project_id, schedule_task_id, risk_type)` uniqueness/state: at most one event per genuine material change, never one per poll cycle.

#### cx_checklists

New table for the Commissioning QA Copilot. An AI-generated (Gemini, via the agent-service) **draft** IST checklist for a chosen system, gate, equipment, and standard set. Mirrors the platform's proposal pattern: a draft is never an accepted or authoritative test procedure until an engineer reviews it. Only the durable outputs modeled here land in Postgres — the agent's Chroma RAG store and Neo4j/NetworkX working graph are agent-local only (see Data Storage Notes).

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Checklist identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| system_id | UUID | FK -> systems.id, NOT NULL | System under test (pilot: chilled water plant) |
| gate_id | UUID | FK -> gates.id, NOT NULL | Gate the checklist supports (pilot: L4 IST) |
| asset_id | UUID | FK -> assets.id, NOT NULL | Equipment the checklist was generated for |
| title | VARCHAR(250) | NOT NULL | Checklist title |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','accepted','rejected','superseded') | Engineer authority state; only an engineer-accepted checklist is executable as authoritative |
| generation_model_version | VARCHAR(80) | NOT NULL | Gemini model version that generated the draft (carried into export manifests) |
| created_by | UUID | FK -> users.id, NOT NULL | Requesting engineer |
| reviewed_by | UUID | FK -> users.id, NULL | Engineer who accepted/rejected the draft |
| reviewed_at | TIMESTAMPTZ | NULL | Review action time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Generation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last review/change time |

The chosen standard set is not stored as an in-row array (per Schema Rules): the checklist links to its ingested standard/procedure documents via `edges` rows (`cx_checklist` `REQUIRES` `document`), and every cited clause resolves through `cx_clause_citations` to a `source_regions` row — the same citation discipline used by `requirements` and `schedule_tasks`.

#### cx_checklist_steps

Ordered steps within a draft checklist, each carrying a modality-typed acceptance criterion. Modality drives the deterministic-vs-human evaluation split: `numeric` and `boolean` steps are deterministically checkable; `narrative` steps are never auto-determined.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Step identifier |
| cx_checklist_id | UUID | FK -> cx_checklists.id, NOT NULL | Parent checklist |
| sequence_number | INTEGER | NOT NULL, CHECK > 0 | Execution order |
| instruction | TEXT | NOT NULL | Action to perform |
| modality | VARCHAR(20) | NOT NULL, CHECK IN ('numeric','boolean','narrative') | Acceptance-criterion type; selects deterministic vs. human-review evaluation |
| parameter | VARCHAR(200) | NULL | Measured parameter name; required when `modality = 'numeric'` (application-enforced) |
| nominal_value | DECIMAL(20,8) | NULL | Nominal/target value for numeric criteria |
| unit | VARCHAR(40) | NULL | Unit for the numeric criterion |
| tolerance | DECIMAL(20,8) | NULL | Permitted deviation for numeric criteria |
| expected_boolean | BOOLEAN | NULL | Expected presence/state for boolean criteria |
| narrative_criterion | TEXT | NULL | Qualitative acceptance text for narrative criteria (always routed to human review) |
| required | BOOLEAN | NOT NULL, DEFAULT true | Whether the step is mandatory |
| asset_id | UUID | FK -> assets.id, NULL | Step-specific equipment when it differs from the checklist's equipment |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Generation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last change |

Unique constraint: `(cx_checklist_id, sequence_number)`.

#### cx_clause_citations

Every clause the LLM cites on a draft checklist, with its post-generation verification result. Verification is a deterministic lookup against ingested-corpus metadata (clause/section metadata carried on `source_regions`), never an LLM self-assessment; a citation with no matching ingested clause is flagged as a possible hallucination and never shown as verified.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Citation identifier |
| cx_checklist_id | UUID | FK -> cx_checklists.id, NOT NULL | Checklist the citation appears on |
| cx_checklist_step_id | UUID | FK -> cx_checklist_steps.id, NULL | Citing step (`NULL` for checklist-level citations) |
| clause_reference | VARCHAR(200) | NOT NULL | Clause/section identifier as cited by the LLM |
| source_region_id | UUID | FK -> source_regions.id, NULL | Resolved ingested clause region; set when `verification_status = 'verified'`, NULL when unverifiable |
| verification_status | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','verified','flagged') | Post-generation verification outcome; `flagged` = no matching ingested clause (possible hallucination) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Citation capture time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Verification outcome time |

#### cx_test_records

One execution of a checklist by an engineer: executing engineer, deterministic overall status, and the draft/approved report lifecycle with gate/evidence linkage. The test record is the working record; the **authoritative** artifacts are the `evidence` row created on approval (reuse — see the `evidence` table note) and, for a failure, the `findings` NCR row (reuse — see the `findings` table note).

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Test record identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| cx_checklist_id | UUID | FK -> cx_checklists.id, NOT NULL | Executed checklist |
| gate_id | UUID | FK -> gates.id, NOT NULL | Gate the test supports |
| executed_by | UUID | FK -> users.id, NOT NULL | Executing engineer |
| overall_status | VARCHAR(30) | NOT NULL, DEFAULT 'in_progress', CHECK IN ('in_progress','proposed_pass','proposed_fail','needs_human_review') | Aggregate of step verdicts; recomputed deterministically from `cx_step_results`, never manually edited |
| report_status | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','approved') | Report lifecycle: labelled "DRAFT — PENDING ENGINEER REVIEW" until approved; export gated on approval |
| report_object_key | VARCHAR(500) | UNIQUE, NULL | Local object store location of the drafted/approved report artifact (ReportLab/python-docx output) |
| report_content_hash | CHAR(64) | NULL | Hash of the report artifact, referenced from the evidence record and export manifest |
| evidence_id | UUID | FK -> evidence.id, NULL | The `evidence` row materialized on approval; set only when `report_status = 'approved'` (application-enforced) |
| approved_by | UUID | FK -> users.id, NULL | Approving engineer |
| approved_at | TIMESTAMPTZ | NULL | Approval time |
| executed_at | TIMESTAMPTZ | NULL | Execution completion time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Execution start time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last status/report change |

Cross-links use the existing typed edges: a `cx_test_record` `PROVES` the `requirement`(s) its steps evidence and `AFFECTS` the `gate` it feeds; the approved `evidence` row then enters gate readiness exactly like any other accepted evidence. A completed all-pass test sets the gate to `PENDING_REVIEW` (existing `gates.status = 'in_review'`), never `ready` — only an authorized approver transitions the gate further.

#### cx_step_results

Per-step field readings and verdicts for one test record. Verdicts for `numeric`/`boolean` steps are produced by deterministic value/unit/tolerance or presence comparison with zero LLM involvement; `narrative` steps are always `needs_human_review` and resolved only by a human verdict. Step state and readings persist here so execution is resumable without loss.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Step result identifier |
| cx_test_record_id | UUID | FK -> cx_test_records.id, NOT NULL | Parent test execution |
| cx_checklist_step_id | UUID | FK -> cx_checklist_steps.id, NOT NULL | Executed step |
| reading_value | DECIMAL(20,8) | NULL | Numeric field reading |
| reading_boolean | BOOLEAN | NULL | Boolean/presence field reading |
| reading_text | TEXT | NULL | Narrative field observation |
| entered_by | UUID | FK -> users.id, NOT NULL | Engineer who entered the reading |
| entered_at | TIMESTAMPTZ | NOT NULL | Reading entry time |
| verdict | VARCHAR(30) | NOT NULL, CHECK IN ('proposed_pass','proposed_fail','needs_human_review') | Deterministic verdict for numeric/boolean steps; always `needs_human_review` for narrative steps |
| human_verdict | VARCHAR(10) | NULL, CHECK IN ('pass','fail') | Human resolution of a `needs_human_review` step |
| human_reviewed_by | UUID | FK -> users.id, NULL | Reviewer who resolved the step |
| human_reviewed_at | TIMESTAMPTZ | NULL | Human review time |
| finding_id | UUID | FK -> findings.id, NULL | The NCR `findings` row created by this step's `TEST_FAILED` event (`NULL` unless the step failed) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Result creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last reading/verdict change |

Unique constraint: `(cx_test_record_id, cx_checklist_step_id)`.

**`TEST_FAILED` mapping (reuse, not a new table).** A `proposed_fail` verdict on a step emits a `TEST_FAILED` event (per the TRD orchestrator event contract), which the Node core persists entirely with existing tables plus the pointer above:

1. A `findings` (NCR) row is created — `project_id`/`system_id`/`gate_id` from the checklist, title/severity proposed by the copilot, disposed through the existing findings lifecycle — and referenced back from `cx_step_results.finding_id`.
2. The affected gate's `gates.status` is set to the existing `'blocked'` value; the finding's `gate_id` links it to the gate (the same blocking pattern findings already use).
3. Append-only `audit_events` rows record the finding creation and the gate `BLOCKED` transition (hash-chained; `actor_id` = the agent-service actor; `object_type`/`object_id` = the finding and the gate respectively).

`TEST_FAILED` never enters the schedule pipeline; it enters the evidence-graph pipeline only.

#### shipments

New table for the Supply Chain Visibility & Risk Agent. One row per single-leg (origin→destination) critical-equipment shipment. This is the **durable** shipment model: tracking configuration, current deterministic classification, last-known-position summary, and dedup state. The high-frequency time series behind it (per-poll position snapshots, weather snapshots, great-circle route cache) is agent-local only — see the note below the table and Data Storage Notes.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Shipment identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| origin_lat | DECIMAL(9,6) | NOT NULL | Origin latitude |
| origin_lng | DECIMAL(9,6) | NOT NULL | Origin longitude |
| origin_city | VARCHAR(120) | NULL | Origin display label |
| dest_lat | DECIMAL(9,6) | NOT NULL | Destination latitude |
| dest_lng | DECIMAL(9,6) | NOT NULL | Destination longitude |
| dest_city | VARCHAR(120) | NULL | Destination display label (demo: Mumbai) |
| mmsi | VARCHAR(20) | NULL | AIS vessel identifier; NULL means no live AIS match and the track is simulated-only |
| eta_planned | TIMESTAMPTZ | NOT NULL | Planned ETA from the shipment record |
| eta_weather_adjusted | TIMESTAMPTZ | NULL | Deterministically computed weather-adjusted ETA (additive delay-factor multiplier on remaining transit duration); labelled an estimate, never a guaranteed delivery date; NULL until first computation |
| required_on_site_date | TIMESTAMPTZ | NOT NULL | Date the equipment must be on site; status is classified against this minus a configurable buffer |
| planned_duration_days | DECIMAL(10,2) | NULL, CHECK > 0 | Planned transit duration; NULL means the configurable placeholder default applies (documented business state, not a missing validation) |
| status | VARCHAR(10) | NOT NULL, DEFAULT 'green', CHECK IN ('green','amber','red') | Deterministic R/A/G classification: 🟢 on-time, 🟡 at-risk, 🔴 delayed |
| port_congestion | BOOLEAN | NOT NULL, DEFAULT false | Manual port-congestion flag (no live feed in MVP) |
| position_is_simulated | BOOLEAN | NOT NULL, DEFAULT true | Whether the last-known position is great-circle interpolated (simulated) rather than a live AIS fix |
| last_lat | DECIMAL(9,6) | NULL | Last-known position latitude (durable summary of the agent-local track) |
| last_lng | DECIMAL(9,6) | NULL | Last-known position longitude |
| last_position_at | TIMESTAMPTZ | NULL | Timestamp of the last-known position |
| last_notified_status | VARCHAR(10) | NULL, CHECK IN ('green','amber','red') | Dedup state: the status most recently emitted as a `schedule_events` row; NULL = never notified. An event is emitted only when the newly computed `status` differs from this value |
| created_by | UUID | FK -> users.id, NOT NULL | Registering member (CSV / manual UI / ERP import) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Registration time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last position/status/ETA refresh |

The equipment link is stored via `edges` (`shipment` `TRACKS` `asset`), not an in-row FK, and the schedule task(s) a delay threatens are linked via `edges` (`shipment` `AFFECTS` `schedule_task`) — the delta detector resolves affected tasks through these edges when a `shipment_delayed`/`shipment_recovered` event arrives, the same typed-graph pattern used by `schedule_tasks` cross-links.

**Durable vs. agent-local (Supply Chain).** Durable in Postgres: the `shipments` row (configuration, current status/ETA, last-known-position summary, dedup state) and every emitted status transition as a `schedule_events` row. Agent-local only (never authoritative, deliberately not modeled as Postgres tables): the ~30s **position/tracking snapshots** (lat/lng, speed, heading, timestamp, live-vs-simulated flag), the **weather snapshots** at origin/current position/destination (wind/precipitation/storm, computed delay factor, timestamp), and the **great-circle route cache** (interpolated route coordinates) — re-derivable poll-time working data held in the agent-service (per the TRD's accepted stack override) and served live through the proxied shipment read APIs. Losing them loses no authoritative state: the durable row plus the event trail fully reconstructs every decision the platform acted on.

#### compliance_checks

New table for the Specification & Quality Compliance Agent (`services/compliance-check`, native to the committed local stack). One row per comparison of an accepted `requirement` against a submittal/PO/shop-drawing line, with the modality-routed verdict, groundedness state (for equivalence/substitution claims), and the proposed finding. Advisory only: a check never closes or accepts itself — human acceptance through the review API creates/accepts the `findings` row.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Compliance-check identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| requirement_id | UUID | FK -> requirements.id, NOT NULL | The accepted requirement being checked against |
| target_type | VARCHAR(20) | NOT NULL, CHECK IN ('submittal','po','shop_drawing') | Compared target document category (shop-drawing = extracted text callouts only, no geometry) |
| target_document_version_id | UUID | FK -> document_versions.id, NOT NULL | Compared target revision |
| requirement_source_region_id | UUID | FK -> source_regions.id, NOT NULL | Exact cited requirement clause |
| target_source_region_id | UUID | FK -> source_regions.id, NOT NULL | Exact cited submittal/PO/drawing line |
| modality | VARCHAR(20) | NOT NULL, CHECK IN ('numeric','categorical','boolean','narrative') | Evaluation tier routed from `requirements.modality`; numeric/categorical/boolean are deterministic, narrative is human-review-only |
| verdict | VARCHAR(30) | NOT NULL, CHECK IN ('deterministic_deviation','possible_mismatch','grounded_equivalent','needs_engineering_judgment','conform') | Comparison outcome; `possible_mismatch` (narrative) and `needs_engineering_judgment` (ungrounded equivalence) always route to mandatory human review, never auto-flagged |
| groundedness_state | VARCHAR(30) | NULL, CHECK IN ('grounded','no_precedent_found') | For equivalence/substitution claims: whether `lookup_standard_clause`/`check_precedent`/`compare_spec_values` grounded the claim before a flag was proposed (`no_precedent_found` downgrades to needs-engineering-judgment, never shown as a flag) |
| confidence | DECIMAL(5,4) | NULL, CHECK BETWEEN 0 AND 1 | Model proposal confidence for the flag |
| proposed_finding_id | UUID | FK -> findings.id, NULL | The `findings` (NCR) row proposed for a detected deviation; set only when a flag is proposed, disposed through the existing findings lifecycle |
| review_state | VARCHAR(20) | NOT NULL, DEFAULT 'proposed', CHECK IN ('proposed','accepted','rejected') | Human authority state; acceptance/rejection is a human action through the review API |
| reviewed_by | UUID | FK -> users.id, NULL | Reviewer who accepted/rejected the proposed flag |
| reviewed_at | TIMESTAMPTZ | NULL | Review action time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Check creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last verdict/review change |

Every deterministic (numeric/categorical/boolean) verdict is produced by value/unit/tolerance or presence comparison with zero LLM involvement; narrative comparisons produce only an LLM "possible mismatch" suggestion routed to human review. When a client spec and a referenced standard conflict, both are surfaced (via their `source_regions`) with document hierarchy/date rather than one being silently chosen — no compliance value is stored as an auto-resolved authoritative column.

#### schedule_risks

New table for the Predictive Schedule Risk Engine (a single periodic-poll worker native to the committed local stack). One row per flagged forward-risk, keyed by (task + risk-type) for dedup; tracks the estimated delay/probability, source signal, mitigation-option proposals, and the emitted `predicted_risk_delay` event. Advisory only: the engine never reschedules or applies a mitigation option; the re-solve is executed only by the deterministic CP-SAT solver (given a selected option as a constraint change) or a human.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Risk identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| schedule_task_id | UUID | FK -> schedule_tasks.id, NOT NULL | Affected task the risk threatens (fan-out: one risk row per affected task) |
| risk_type | VARCHAR(30) | NOT NULL, CHECK IN ('procurement','lead_time','workforce','weather_forecast') | Forward-risk signal category driving the dedup key |
| estimated_delay_days | DECIMAL(10,2) | NULL, CHECK >= 0 | Estimated delay magnitude when material |
| probability | DECIMAL(5,4) | NULL, CHECK BETWEEN 0 AND 1 | Estimated probability of the risk materializing |
| source_signal | TEXT | NOT NULL | Human-readable description of the polled signal that crossed the materiality threshold |
| mitigation_options_json | TEXT | NOT NULL | JSON-encoded ≥1 mitigation-option proposals (proposals only; never applied by the engine) |
| schedule_event_id | UUID | FK -> schedule_events.id, NULL | The emitted `predicted_risk_delay` `schedule_events` row (`NULL` until emission) |
| state | VARCHAR(20) | NOT NULL, DEFAULT 'flagged', CHECK IN ('flagged','resolved') | Flagged-risk state; a self-resolved risk moves to `resolved` rather than latching a stale risk in the "Delays/Risks" view |
| flagged_at | TIMESTAMPTZ | NOT NULL | Time the risk was first flagged as material |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last material-change/resolution update |

Unique constraint: `(project_id, schedule_task_id, risk_type)` — the task + risk-type dedup key: a risk crossing the threshold repeatedly across poll cycles without material change updates this row in place rather than re-emitting; a material change updates it and emits a new `predicted_risk_delay` event. The affected task(s) are also cross-linked via `edges` (`schedule_risk` `AFFECTS` `schedule_task`) for the delta detector's fan-out resolution.

#### risk_signal_readings

New table for the Predictive Schedule Risk Engine's "Live Events" surface. One row per per-poll external forward-risk signal observation, including explicit data-unavailable states. Working/observational data — a signal reading never itself mutates schedule state; only a material risk (recorded in `schedule_risks` and emitted as a `schedule_events` row) enters the pipeline.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Signal-reading identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| signal_type | VARCHAR(30) | NOT NULL, CHECK IN ('procurement','lead_time','workforce','weather_forecast') | Polled signal category |
| schedule_task_id | UUID | FK -> schedule_tasks.id, NULL | Task the signal is evaluated against (`NULL` for project-wide signals) |
| observed_at | TIMESTAMPTZ | NOT NULL | Poll observation time |
| value | TEXT | NULL | JSON/text observed value (`NULL` when `data_available = false`) |
| data_available | BOOLEAN | NOT NULL, DEFAULT true | Explicit data-unavailable state for a feed unavailable during the cycle; the engine never fabricates a risk from a missing signal |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Persistence time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Persistence metadata |

#### knowledge_chunks

New table backing the Project Knowledge & RFI Intelligence Agent's **user-facing** scoped semantic search (and the platform's internal extraction/classification matching). One row per retrieval chunk: the retrieval representation (summary/chunk text) plus its pgvector embedding, carrying the mandatory metadata-filter columns applied deterministically **before** any vector search so retrieval is always scoped to the filtered+routed subset, never global. The pointer to the full original doc and exact page/bbox for citation is the `source_region_id`.

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Chunk identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope (mandatory metadata-filter predicate) |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope (mandatory metadata-filter predicate) |
| source_region_id | UUID | FK -> source_regions.id, NOT NULL | Citation pointer to the exact page/bbox of the original doc |
| document_version_id | UUID | FK -> document_versions.id, NOT NULL | Cited revision (carried into every answer claim) |
| doc_type | VARCHAR(40) | NOT NULL, CHECK IN ('spec','submittal','test_record','rfi','change_order','standard','procedure','other') | Logical routing index (no single mega-index); the RFI-similarity path is scoped to `doc_type = 'rfi'` |
| system_id | UUID | FK -> systems.id, NULL | Optional system metadata-filter predicate |
| asset_id | UUID | FK -> assets.id, NULL | Optional asset metadata-filter predicate |
| gate_id | UUID | FK -> gates.id, NULL | Optional gate metadata-filter predicate |
| revision | VARCHAR(80) | NULL | Optional revision metadata-filter predicate |
| effective_date | TIMESTAMPTZ | NULL | Optional date metadata-filter predicate |
| content_hash | CHAR(64) | NOT NULL | Hash of the chunk content (carried into every answer claim) |
| chunk_text | TEXT | NOT NULL | Retrieval representation (summary/chunk), separate from the full-original pointer |
| embedding | VECTOR(768) | NOT NULL | pgvector embedding used for scoped, metadata-filtered similarity (dimension configurable to the embedding model) |
| usage | VARCHAR(20) | NOT NULL, DEFAULT 'both', CHECK IN ('internal','user_facing','both') | Whether the chunk serves internal extraction/classification matching, user-facing RFI search, or both |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Embedding time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Re-embedding time |

The user-facing RFI path applies the mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) as SQL predicates on these columns before the pgvector similarity operator runs, so semantic retrieval can never cross a tenant/project boundary or go global. Graph traversal of a retrieved chunk's linked entities reuses the existing `edges` table — no fresh embedding step and no parallel datastore.

#### alerts

New minimal table for the Command Center (per PRD US-31). One row per active alert, cross-linking a triggering event to its downstream impact. Read/cross-link surface only: an alert never itself changes gate readiness, closes a finding, or alters a schedule date. Alerts are **deduplicated on status change** (one alert per genuine status transition; an unchanged status across poll cycles produces zero new alerts), and a `SHIPMENT_RECOVERED` event **clears** the corresponding stale `SHIPMENT_DELAYED` alert (moving it to `cleared`, remaining available in history).

| Column | Type | Constraints | Business Meaning |
|---|---|---|---|
| id | UUID | PK, NOT NULL | Alert identifier |
| tenant_id | UUID | FK -> tenants.id, NOT NULL | Tenant scope |
| project_id | UUID | FK -> projects.id, NOT NULL | Project scope |
| alert_type | VARCHAR(30) | NOT NULL, CHECK IN ('TEST_FAILED','SHIPMENT_DELAYED','SHIPMENT_RECOVERED','predicted_risk_delay') | Triggering event type (the four-value orchestrator event contract) |
| source_schedule_event_id | UUID | FK -> schedule_events.id, NULL | Triggering `schedule_events` row for shipment/predicted-risk alerts |
| source_finding_id | UUID | FK -> findings.id, NULL | For `TEST_FAILED`: the created `findings` (NCR) row |
| impacted_gate_id | UUID | FK -> gates.id, NULL | Downstream gate impact (e.g., the gate set `BLOCKED` by a `TEST_FAILED`) |
| impacted_schedule_task_id | UUID | FK -> schedule_tasks.id, NULL | Downstream affected schedule task for shipment/predicted-risk alerts |
| impacted_schedule_version_id | UUID | FK -> schedule_versions.id, NULL | Resulting `schedule_version` when a re-solve occurred |
| dedup_key | VARCHAR(200) | NOT NULL | Deterministic dedup key (e.g., `shipment_id`/`schedule_task_id + risk_type`/`finding+gate`); enforces one active alert per genuine transition |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK IN ('active','cleared') | Active in the Command Center view, or cleared (recovery/resolution) and retained in history |
| cleared_by_event_id | UUID | FK -> schedule_events.id, NULL | The `shipment_recovered` (or resolving) event that cleared this alert |
| cleared_at | TIMESTAMPTZ | NULL | Clear time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Alert creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last status/cross-link change |

Partial unique constraint: `(project_id, dedup_key)` WHERE `status = 'active'` — guarantees at most one active alert per genuine transition. The alert derives entirely from records the agents already write (`schedule_events`, `findings`, `edges`, `audit_events`); it is a denormalized cross-link/dedup surface, never an independent system of record.

## Relationships

- `tenants` 1:N `projects`.
- `tenants` 1:N `audit_events`.
- `tenants` 1:N `schedule_tasks`, `resources`, `schedule_versions`, `scheduled_tasks`, and `schedule_events` (tenant predicate mirrors every other project-scoped table).
- `tenants` 1:N `cx_checklists`, `cx_test_records`, `shipments`, `compliance_checks`, `schedule_risks`, `risk_signal_readings`, `knowledge_chunks`, and `alerts` — the new agent parent tables carry the same tenant predicate; their child tables (`cx_checklist_steps`, `cx_clause_citations`, `cx_step_results`) are scoped through the parent FK, mirroring `test_steps` under `test_procedures`.
- `projects` M:N `users` through `project_members`.
- `projects` 1:N `documents`, `systems`, `assets`, `gates`, `requirements`, `evidence`, `test_procedures`, `findings`, and `edges`.
- `projects` 1:N `schedule_tasks`, `resources`, `schedule_versions`, and `schedule_events` — every schedule row carries the same `(tenant_id, project_id)` predicate pair as evidence-side tables.
- `projects` 1:N `cx_checklists`, `cx_test_records`, `shipments`, `compliance_checks`, `schedule_risks`, `risk_signal_readings`, `knowledge_chunks`, and `alerts` — same `(tenant_id, project_id)` predicate pair.
- `documents` 1:N `document_versions`; `document_versions` 1:N `source_regions`.
- `source_regions` 1:N `requirements` (existing) and 1:N `schedule_tasks`/`resources` (new) — the same citation table backs both proposal pipelines; a `source_region` row is never duplicated per module. The Commissioning agent's ingested standards/procedures follow the same discipline: `source_regions` 1:N `cx_clause_citations` (a verified citation resolves to exactly one ingested clause region). The Specification agent cites both the requirement clause and the target line as `source_regions` rows on each `compliance_checks` row, and the RFI agent's `knowledge_chunks` each point at exactly one `source_regions` citation.
- `requirements` 1:N `compliance_checks` (one accepted requirement can be checked against many targets); `document_versions` 1:N `compliance_checks` (through `target_document_version_id`); a proposed compliance deviation optionally references its `findings` row via `compliance_checks.proposed_finding_id` (reuse of the existing `findings` table — no parallel compliance-NCR structure).
- `systems` 1:N `assets`, `gates`, `test_procedures`, and `evidence`; `systems` 1:N `findings` optionally; `systems` 1:N `cx_checklists`.
- `gates` 1:N `test_runs` and `decisions`; `gates` 1:N `findings` optionally; `gates` 1:N `cx_checklists` and `cx_test_records`; `gates` 1:N `alerts` optionally (downstream gate impact).
- `assets` 1:N `cx_checklists` (checklist equipment) and optionally 1:N `cx_checklist_steps` (step-specific equipment); a `shipment`'s equipment link is an `edges` row (`TRACKS`), not an in-row FK.
- `test_procedures` 1:N `test_steps` and `test_runs`.
- `cx_checklists` 1:N `cx_checklist_steps`, `cx_clause_citations`, and `cx_test_records`; `cx_test_records` 1:N `cx_step_results`; each `cx_step_results` row references exactly one `cx_checklist_steps` row and is unique per test record, so execution is resumable without duplicate step results.
- `cx_test_records` optionally references the `evidence` row it becomes on approval (`evidence_id`, set only when the report is approved); `cx_step_results` optionally references the `findings` row its `TEST_FAILED` created (`finding_id`). Both are reuse of existing tables — no parallel agent evidence/NCR structure exists. Cascade: none — an approved `evidence` row or created `findings` row is never deleted by removing its originating `cx_*` record; the `cx_*` rows are working records retained under the same project retention policy.
- `shipments` 1:N `schedule_events` through the nullable `schedule_events.shipment_id` FK (each genuine status transition durably persists as one event row); `shipments` link to their `asset` via `edges` `TRACKS` and to threatened `schedule_task`s via `edges` `AFFECTS`.
- `schedule_risks` 1:N `schedule_events` through the nullable `schedule_events.schedule_risk_id` FK (each genuine material change durably persists as one fan-out set of event rows); `schedule_risks` reference their affected `schedule_task` by FK and cross-link the same task via `edges` `AFFECTS`; `(project_id, schedule_task_id, risk_type)` is unique for dedup. `schedule_tasks` 1:N `risk_signal_readings` optionally (a polled signal evaluated against a task).
- `alerts` reference their triggering `schedule_events`/`findings` and downstream `gates`/`schedule_tasks`/`schedule_versions` by nullable FK; a `shipment_recovered` event clears the stale delay alert via `cleared_by_event_id`. Cascade: none — alerts are a derived cross-link/dedup surface retained in history, never a system of record.
- `users` 1:N `documents`, `document_versions`, `evidence`, `test_runs`, `findings`, `decisions`, and `edges` through actor/owner foreign keys; `users` 1:N `schedule_tasks`/`resources` through `reviewed_by` and 1:N `schedule_events` through `reported_by`; `users` 1:N `cx_checklists` (creator/reviewer), `cx_test_records` (executor/approver), `cx_step_results` (reading entry / human review), `shipments` (registering member), and `compliance_checks` (reviewer).
- `edges` provides controlled typed relationships among requirements, systems, assets, gates, evidence, tests, findings, documents, decisions, and — new — `schedule_task`/`resource`/`scheduled_task` entities; polymorphic IDs are constrained by application validation and project scope. Dependency edges between two `schedule_task` rows use `relationship_type = 'PRECEDES'` and form the DAG the solver consumes; cross-links from a `schedule_task` to a `gate`/`system`/`asset` use `AFFECTS`/`REQUIRES` and are surfaced only as read-only context, never as readiness input (join strategy: application resolves `edges.to_id`/`to_type` against the relevant table per request, same as existing evidence-side edges — no polymorphic database-level FK). The agents extend the same vocabulary rather than adding a parallel structure: `shipment` `TRACKS` `asset` and `shipment` `AFFECTS` `schedule_task`; `cx_checklist` `REQUIRES` `document` (standard set); `cx_test_record` `PROVES` `requirement` and `AFFECTS` `gate`; `schedule_risk` `AFFECTS` `schedule_task`; and the Specification agent's `check_precedent` reads approved-equal history through existing `edges`/`decisions`. `TRACKS` is the only new `relationship_type` value.
- `schedule_tasks` 1:N `scheduled_tasks` (one computed-state row per version the task appears in); `schedule_tasks` 1:N `schedule_events` (a task can accumulate multiple reported events over time). Cascade: deleting/retention-purging a `schedule_task` project cascades to its `scheduled_tasks` and `schedule_events` rows (mirrors project-deletion cascade for evidence-side child tables); a `schedule_task` itself is never hard-deleted once referenced by a `scheduled_tasks` row in a persisted `schedule_version` — only soft-rejected via `review_state`.
- `schedule_versions` 1:N `scheduled_tasks` (the version's full task-date/critical-path snapshot). Cascade: none — `scheduled_tasks` rows are immutable children of their `schedule_version` and are only ever inserted, never deleted independently of a full project purge.
- `schedule_versions` self-references via `previous_version_id`, forming a hash-linked, strictly append-only chain (no cascade; a version is never deleted while a later version references it as predecessor).
- `schedule_versions` optionally references the `schedule_events` row that triggered it via `triggering_event_id`; conversely a `schedule_events` row optionally references the `schedule_versions` row it produced via `resulting_schedule_version_id` — the pair of FKs lets either side be queried directly without a join across the whole event/version history.
- `resources` are associated with tasks only indirectly (via `vendor` and `resource_type` matching consumed inside `schedule_tasks.resource_requirement_json`, resolved by the solver at solve time, not by a database FK), since one resource-capacity record can constrain many tasks concurrently and the relationship is a capacity constraint, not a per-row reference.

## Entity Relationship Overview

The tenant owns projects and audit history. A project contains source documents and revisions, whose source regions anchor requirements and procedures — and, for the schedule module, anchor proposed task and resource-capacity records extracted from vendor contracts, timelines, POs, and approval documents. Systems contain assets and gates. Accepted requirements are connected to systems, assets, gates, evidence, and test procedures through typed edges. Test runs and evidence support gate readiness; findings can block a system or gate. Authorized users create decisions against a hashed evidence baseline. Every material mutation is represented in the tenant's append-only audit chain.

For the schedule module, a human reviewer accepts, edits, or rejects proposed `schedule_task` and `resource` records; only accepted tasks and their `PRECEDES` edges are assembled into a dependency DAG and passed to the CP-SAT solver. Each solve — the initial baseline and every subsequent re-solve — produces one immutable `schedule_version`, which owns a full snapshot of every task's computed start/end dates and critical-path flag in its child `scheduled_tasks` rows. Reported real-world events (shipment, approval, weather-delay, or predicted risk) are logged as `schedule_events` against a specific task; the delta detector reads the current version's critical path to decide whether the event merely updates that task's actual status or requires a new, warm-started re-solve, in which case the new `schedule_version` links back to both its predecessor version and its triggering event. After any re-solve, the Gemini explainer agent narrates the before/after diff into `schedule_versions.explanation_summary`, never altering a date itself. Schedule tasks cross-link to gates/systems/assets through the same typed-edges table used elsewhere, so schedule and critical-path status can be surfaced as read-only context on a gate without ever feeding the deterministic readiness computation.

For the Commissioning QA Copilot, ingested standards excerpts and procedures enter through the same `documents`/`document_versions`/`source_regions` pipeline, so every cited clause resolves to a region and hash. The copilot generates a draft `cx_checklists` row — anchored to a system, gate, and equipment asset by direct FK, and to its standard documents via `REQUIRES` edges — with modality-typed `cx_checklist_steps` and post-verified `cx_clause_citations`. An engineer executes the checklist as a `cx_test_records` row, entering readings into `cx_step_results`, where numeric/boolean verdicts are deterministic and narrative steps always await a human verdict. A `proposed_fail` maps onto existing tables — a `findings` NCR, the gate's existing `blocked` status, and hash-chained `audit_events` — while an approved all-pass test record materializes as an `evidence` row (report artifact in the local object store, hash-referenced), sets its gate to the existing `in_review` value (the copilot's `PENDING_REVIEW`), and joins the turnover pack; only an authorized approver moves the gate further.

For the Supply Chain agent, a durable `shipments` row holds each single-leg tracked delivery — linked to its equipment via a `TRACKS` edge and to threatened schedule tasks via `AFFECTS` edges — with deterministic R/A/G status, weather-adjusted ETA, and a last-known-position summary refreshed from the agent-local track. Per-poll position, weather, and route data stay agent-local; the durable trail is the shipment row plus one `schedule_events` row per genuine status transition (`shipment_delayed` on entering at-risk/delayed, `shipment_recovered` on returning to on-time), deduplicated by `last_notified_status` and flowing through the unchanged delta-detector → CP-SAT re-solve pipeline.

For the Specification & Quality Compliance agent, submittals, POs, and shop-drawing text callouts enter through the same `documents`/`document_versions`/`source_regions` pipeline as a `doc_type`; a `compliance_checks` row records each comparison of an accepted `requirement` against a target line, routed by `requirements.modality` — numeric/categorical/boolean deterministically, narrative to mandatory human review — with equivalence/substitution claims groundedness-gated via `lookup_standard_clause`/`check_precedent`/`compare_spec_values` before any flag. An accepted deviation reuses the existing `findings` NCR row (referenced by `proposed_finding_id`) and writes an `audit_events` entry; no flag closes or accepts itself.

For the Predictive Schedule Risk Engine, a single periodic-poll worker reads the latest `schedule_version`/critical path and records each polled signal (or explicit data-unavailable state) as a `risk_signal_readings` row; a material forward-risk crossing the threshold is recorded as a `schedule_risks` row (deduplicated by task + risk-type, cross-linked to its affected task via `AFFECTS` edges) and emitted as a `predicted_risk_delay` `schedule_events` row that flows through the unchanged delta-detector → CP-SAT re-solve pipeline. Mitigation options are proposals only; the engine never reschedules or applies one.

For the Project Knowledge & RFI Intelligence agent, `knowledge_chunks` carry each retrieval chunk's pgvector embedding plus the mandatory metadata-filter columns (tenant/project/system/asset/gate/doc_type/date/revision); a user query applies the deterministic metadata filter as SQL predicates before the scoped pgvector similarity search, synthesizes an answer through the `ModelProvider` from filtered, cited chunks only (each claim resolving to a `source_region_id` + `document_version` + content hash), surfaces prior resolved RFIs from the `doc_type = 'rfi'` subset (project-scoped, never cross-project), and expands linked entities via the existing `edges` + `audit_events` tables for the interactive graph/timeline — no parallel datastore.

The Command Center reads the `schedule_events`, `findings`, `edges`, and `audit_events` the agents already write and denormalizes each triggering event's downstream impact into an `alerts` row, deduplicated on status change and cleared on `shipment_recovered` — a read/cross-link surface only, never itself changing gate readiness, closing a finding, or altering a schedule date.

## Indexing Notes

| Index | Query pattern and reason |
|---|---|
| `projects(tenant_id, status)` | List active workspaces for a tenant. |
| `project_members(project_id, user_id)` UNIQUE | Authorize a user's project membership. |
| `documents(project_id, document_type)` | Filter source documents by project and category. |
| `document_versions(document_id, created_at DESC)` | Retrieve latest revisions for a logical document. |
| `source_regions(document_version_id, page_number)` | Resolve page citations and render review context. |
| `systems(project_id, system_type, status)` | Filter system readiness queues. |
| `assets(project_id, tag)` UNIQUE | Resolve imported field tags and prevent duplicates. |
| `gates(system_id, sequence_number)` | Traverse gate order and prerequisites. |
| `requirements(project_id, review_state)` | Drive human review queues and accepted-record scans. |
| `evidence(project_id, system_id, validity_state)` | Compute system and gate evidence status. |
| `test_runs(gate_id, status, executed_at DESC)` | Find current test outcomes for readiness. |
| `findings(project_id, status, severity)` | Find open blockers and prioritize high-severity work. |
| `edges(project_id, from_type, from_id)` | Traverse outgoing evidence and dependency relationships, including `schedule_task` → `schedule_task` `PRECEDES` DAG edges (the primary path used to assemble a task's dependency graph before a solve). |
| `edges(project_id, to_type, to_id)` | Find blockers, proofs, and affected records pointing at an entity, including which gate/system a `schedule_task` cross-links to via `AFFECTS`/`REQUIRES`, which `shipment` `TRACKS` a given asset or `AFFECTS` a given schedule task, and which `schedule_risk` `AFFECTS` a given schedule task. |
| `decisions(gate_id, decided_at DESC)` | Retrieve the latest decision and compare its evidence baseline. |
| `audit_events(project_id, occurred_at DESC)` | Render project audit timelines and export history. |
| `schedule_tasks(project_id, review_state)` | Drive the task review queue and select `accepted` tasks for DAG assembly, mirroring `requirements(project_id, review_state)`. |
| `schedule_tasks(project_id, vendor)` | Filter/search tasks by vendor for the review UI and lead-time analysis. |
| `resources(project_id, vendor, resource_type)` | Resolve capacity available to a given vendor/resource type at solve time. |
| `schedule_versions(project_id, version_number DESC)` UNIQUE on `(project_id, version_number)` | Fetch the current/latest version efficiently and enumerate version history in order; supports `GET /v1/projects/{id}/schedule/versions` and `GET /v1/projects/{id}/schedule/current`. |
| `schedule_versions(previous_version_id)` | Walk the immutable version chain backward for diff/audit reconstruction. |
| `scheduled_tasks(schedule_version_id, is_critical_path)` | Render the critical-path view for a version without scanning every task. |
| `scheduled_tasks(schedule_task_id, schedule_version_id)` UNIQUE | Look up a task's computed state within one version and traverse a task's date history across versions (dependency-graph/critical-path traversal per task). |
| `schedule_events(project_id, schedule_task_id, occurred_at DESC)` | Serialize concurrent events against the same task in arrival order and find a task's event history. |
| `schedule_events(project_id, triggered_resolve, solve_status)` | Find pending/failed solves for retry and monitoring. |
| `schedule_events(shipment_id, occurred_at DESC)` | Trace one shipment's delay/recovery event trail into the schedule pipeline (delay → recovery alert clearing). |
| `schedule_events(schedule_risk_id, occurred_at DESC)` | Trace one predicted-risk's emitted-event trail into the schedule pipeline. |
| `cx_checklists(project_id, gate_id, status)` | List draft/accepted checklists for a gate's commissioning view; low cardinality per gate in the bounded pilot (one system, one gate). |
| `cx_checklist_steps(cx_checklist_id, sequence_number)` UNIQUE | Render ordered step execution and prevent duplicate step numbering. |
| `cx_clause_citations(cx_checklist_id, verification_status)` | Surface flagged (possible-hallucination) citations on a draft without scanning all citations. |
| `cx_test_records(gate_id, report_status, overall_status)` | Find a gate's draft/approved test records and current pass/fail state for the gate view and turnover pack. |
| `cx_step_results(cx_test_record_id, cx_checklist_step_id)` UNIQUE | Resume per-step execution without loss and prevent duplicate step results. |
| `cx_step_results(cx_test_record_id, verdict)` | List `proposed_fail`/`needs_human_review` steps for review queues and report drafting. |
| `shipments(project_id, status)` | Render the R/A/G navigator table and filter at-risk/delayed deliveries; expected tens of shipments per project, so the index mainly serves sorted status grouping. |
| `shipments(project_id, mmsi)` | Match incoming AIS position frames to the tracked shipment during the ~30s poll. |
| `compliance_checks(project_id, review_state, verdict)` | Drive the compliance review queue and surface proposed deviations vs. human-review-only mismatches. |
| `compliance_checks(requirement_id, target_document_version_id)` | Find prior checks of a requirement against a target and avoid duplicate comparison. |
| `schedule_risks(project_id, schedule_task_id, risk_type)` UNIQUE | Enforce the task + risk-type dedup key and back the "Delays/Risks" surface without re-emitting per poll cycle. |
| `schedule_risks(project_id, state, flagged_at DESC)` | List active (flagged) vs. resolved risks in the "Delays/Risks" view. |
| `risk_signal_readings(project_id, signal_type, observed_at DESC)` | Back the "Live Events" surface with the latest polled signal observations per type. |
| `knowledge_chunks(tenant_id, project_id, doc_type, system_id, asset_id, gate_id)` | Apply the mandatory-first deterministic metadata filter as SQL predicates before any vector search; scopes the candidate set to the filtered+routed subset. |
| `knowledge_chunks USING ivfflat (embedding vector_cosine_ops)` (or HNSW) | pgvector approximate-nearest-neighbour index for scoped semantic similarity, run only within the metadata-filtered subset, never globally. |
| `alerts(project_id, status, created_at DESC)` | Render the active Command Center view and its history. |
| `alerts(project_id, dedup_key)` UNIQUE WHERE `status = 'active'` | Enforce one active alert per genuine status transition (dedup on status change; recovery clears the stale alert). |

## Data Storage Notes

All entities, including the schedule module's tables and the five agents' durable tables, are stored relationally in **local Postgres (via Drizzle ORM)** with foreign keys, `CHECK` enums, and tenant/project predicates enforced at the database layer — no separate document/graph store is introduced. `schedule_versions` and `scheduled_tasks` are the one deliberate exception to normal mutability: once a version is solved, its `scheduled_tasks` rows and the version's own solve-outcome fields are treated as write-once (only the later `explanation_*` fields and `schedule_events.actual_status`-driven fields on `scheduled_tasks` are appended after the fact), matching the existing "no authoritative value stored as an unversioned mutable flag" rule already applied to gate readiness. Local object store (MinIO/filesystem), Postgres full-text search (tsvector), and pgvector usage extend to the new tables: Postgres full-text search additionally indexes `schedule_tasks.name`/`vendor` for citation-style lookup, and pgvector serves internal extraction-time task-to-system/asset and clause/precedent matching **and is now additionally user-facing** for the Project Knowledge & RFI Intelligence Agent's scoped semantic search over `knowledge_chunks` — always applied after the mandatory-first deterministic metadata filter and scoped to the filtered+routed subset, never a global query.

The two Python agent-services (Commissioning QA Copilot, Supply Chain Visibility & Risk) do not change this posture. Per the TRD's accepted stack override, each runs **agent-local working stores** that are never authoritative and are deliberately **not modeled as durable tables here**:

- **Chroma** — the Commissioning agent's RAG vectors over synthetic standards/procedure excerpts (clause/section metadata + embeddings). Agent-local only; separate from, and never feeding, the platform's Postgres full-text search / pgvector. The authoritative clause text and citations live in `documents`/`document_versions`/`source_regions`.
- **Neo4j/NetworkX** — each agent's internal working graph (test↔gate↔equipment derivations; shipment/route working state). Agent-local only; the Postgres `edges` table remains the single authoritative provenance graph.
- **Supply Chain time series** — per-poll position snapshots (lat/lng, speed, heading, timestamp, live-vs-simulated), weather snapshots (wind/precipitation/storm, delay factor, timestamp), and the great-circle route cache. Agent-local, re-derivable working data served live through the proxied shipment read APIs; the durable summary lands on the `shipments` row and in `schedule_events`.

The three native agents (Specification & Quality Compliance, Predictive Schedule Risk Engine, Project Knowledge & RFI Intelligence) carry **no** agent-local override: they read and write these same Postgres tables directly — compliance comparisons in `compliance_checks` (findings reusing `findings`/`edges`/`audit_events`), predicted risks in `schedule_risks`/`risk_signal_readings` (emitting `schedule_events`), and RFI retrieval over `knowledge_chunks` (pgvector) plus the existing `edges` + `audit_events` graph/timeline.

The **durable** agent data model is exactly what this schema defines: the `cx_*`, `shipments`, `compliance_checks`, `schedule_risks`, `risk_signal_readings`, `knowledge_chunks`, and `alerts` tables in Postgres; approved test records reusing `evidence` and `TEST_FAILED`/compliance NCRs reusing `findings`; shipment and predicted-risk status transitions reusing `schedule_events`; report artifacts as immutable, hash-referenced local object-store objects; cross-entity links reusing `edges`; and every state change in the append-only `audit_events` chain. All agent writes land through the local Node core — the agent-services never write Postgres/the object store directly.

## Schema Rules

- Foreign keys are enforced at database level wherever both sides are concrete tables.
- Enum-like business values use `CHECK` constraints and are versioned through migrations.
- No comma-separated identifiers or relational arrays are stored in columns.
- Nullable fields represent a documented business state, not an omitted validation rule.
- Readiness is derived from accepted records and decisions; it is not a manually editable source-of-truth column.
- Schedule dates, critical-path flags, and feasibility are derived only from a CP-SAT solver call and stored only in `schedule_versions`/`scheduled_tasks`; they are never a manually editable source-of-truth column and never feed the deterministic readiness computation.
- Every schedule table includes both `tenant_id` and `project_id` and every read/write predicate includes both, identical to existing evidence-side tables.
- The agent parent tables (`cx_checklists`, `cx_test_records`, `shipments`, `compliance_checks`, `schedule_risks`, `risk_signal_readings`, `knowledge_chunks`, `alerts`) include both `tenant_id` and `project_id` with the same predicate rule; their child tables are scoped through the parent FK, mirroring `test_steps` under `test_procedures`.
- Commissioning acceptance verdicts (`cx_step_results.verdict`) for numeric/boolean steps, Specification compliance verdicts (`compliance_checks.verdict`) for numeric/categorical/boolean tiers, and all shipment ETA/R-A-G values (`shipments.eta_weather_adjusted`, `shipments.status`) are deterministic computations; no LLM-produced value is ever stored in a verdict, ETA, or status column, and narrative steps/comparisons store only `needs_human_review`/`possible_mismatch` until a human resolves them.
- Draft checklists and draft reports never affect readiness: only the engineer-approved test record's `evidence` row and human-disposed `findings` rows enter the readiness computation, and no new gate status value exists — the copilot's `PENDING_REVIEW` and `BLOCKED` outcomes map to the existing `gates.status` values `'in_review'` and `'blocked'`.
- Every equivalence/substitution claim in `compliance_checks` is groundedness-gated (`lookup_standard_clause`/`check_precedent`/`compare_spec_values`) before a flag is proposed; an ungrounded claim is stored as `verdict = 'needs_engineering_judgment'`/`groundedness_state = 'no_precedent_found'` and never shown as a flag, and conflicting client-spec-vs-standard sources are surfaced with document hierarchy/date, never silently resolved into an authoritative column.
- The Predictive Schedule Risk Engine emits into `schedule_events.event_type = 'predicted_risk_delay'` as a producer of an existing pipeline event; mitigation options in `schedule_risks.mitigation_options_json` are proposals only — the engine never reschedules or applies one, and the re-solve is executed only by the deterministic CP-SAT solver or a human. `schedule_risks` `(project_id, schedule_task_id, risk_type)` uniqueness is the single task+risk-type dedup source of truth: a `predicted_risk_delay` event is emitted only on a genuine material change, never per poll cycle.
- The RFI agent's user-facing pgvector search over `knowledge_chunks` always applies the mandatory-first deterministic metadata filter (tenant/project/system/asset/gate/doc_type/date/revision) as SQL predicates **before** any vector operator, scoped to the filtered+routed subset and never global; every surfaced answer claim resolves to a `source_region_id` + `document_version` + content hash, and similar-RFI retrieval is scoped to `doc_type = 'rfi'` and project-scoped, never cross-project.
- `shipments.last_notified_status` is the single dedup source of truth for shipment events, and `alerts (project_id, dedup_key) WHERE status = 'active'` is the single dedup source of truth for Command Center alerts: a `schedule_events` row of type `shipment_delayed`/`shipment_recovered` or a new active `alerts` row may be inserted only on a genuine status transition, guaranteeing one per transition rather than one per ~30s poll cycle; a `shipment_recovered` event clears the stale `SHIPMENT_DELAYED` alert (`alerts.status = 'cleared'`) rather than leaving it latched.
- Alerts and `risk_signal_readings` are read/cross-link and observational surfaces only — they never set gate readiness, close a finding, or alter a schedule date; the systems of record remain the underlying `schedule_events`/`findings`/`edges`/`schedule_versions` rows.
- Agent-local stores (Chroma, Neo4j/NetworkX, position/weather/route time series) are never authoritative and hold no state that cannot be reconstructed or safely lost; the Postgres tables in this schema, hash-referenced local object-store artifacts, and the `audit_events` chain are the only systems of record for agent outputs.
