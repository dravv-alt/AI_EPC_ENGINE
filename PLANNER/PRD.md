# Pramana Cx Product Requirements Document

## Problem Statement

Data-centre commissioning teams must prove that systems are ready for the next gate using specifications, asset registers, test procedures, inspection records, NCRs, approvals, and turnover evidence. These records are fragmented across PDFs, spreadsheets, email exports, and project systems. The team cannot reliably answer which requirement applies, what evidence proves it, whether that evidence is current and approved, or who owns the remaining blocker.

The result is manual reconciliation, repeated evidence chasing, late discovery of missing prerequisites, and handover packs that are difficult to audit. Existing document search and commissioning tools do not provide a controlled chain from requirement to asset, test, evidence, issue, and authorized gate decision.

## Product Outcome

Pramana Cx is an evidence control plane for mission-critical commissioning. For a selected system and commissioning gate, it shows what is required, what accepted evidence proves it, what is missing or stale, who owns the blocker, and which authorized person made the final decision.

Pramana Cx assists engineering judgment. It does not certify a facility, issue a Tier rating, close an NCR, approve a waiver, sign a test, or replace the commissioning authority or engineer of record.

## Target Users

| Persona | Job to be done | Primary outcome |
|---|---|---|
| Commissioning manager / CxA | Review system and gate readiness | Fewer failed tests and faster turnover preparation |
| Owner's representative | Verify claimed progress against evidence | Earlier visibility into go-live risk |
| EPC / GC MEP package manager | Resolve missing prerequisites across contractors | Less rework and fewer blocked work fronts |
| QA/QC lead | Manage inspections, NCRs, evidence, and sign-off authority | A consistent, auditable quality trail |
| Operations-readiness lead | Receive complete asset and evidence handover | Faster transition into operations |

## Core Features

### Must Have

| Feature | User stories |
|---|---|
| Project-scoped roles and approval authority | US-01, US-07 |
| Versioned document and tabular ingestion with source provenance | US-02 |
| Human-reviewed requirement extraction | US-03 |
| Requirement, system, asset, gate, evidence, test, finding, and decision relationships | US-03, US-04 |
| Deterministic readiness board with blocker ownership | US-04, US-05 |
| Revision comparison and stale-evidence propagation | US-06 |
| Issues, assignments, due dates, comments, and evidence capture | US-05 |
| Authorized gate decisions and immutable audit history | US-07 |
| Hash-manifested evidence-pack export | US-08 |

### Should Have

- CSV templates for asset registers, milestones, and issue logs.
- Responsive PWA evidence capture with an offline queue.
- Hybrid exact-term and semantic source search.
- Project-configurable gate names, evidence types, and readiness rules.

### Could Have

- Native integrations with Primavera P6, Procore, Autodesk Construction Cloud, Aconex, CxAlloy, BMS, and EPMS.
- Advanced drawing geometry comparison and BIM-aware relationships.
- Live supply-chain, weather, and telemetry risk inputs.
- Portfolio schedule forecasting and similar-RFI retrieval.

### Won't Have in the MVP

- Autonomous compliance approval or certification.
- Predictive delay claims without a labelled historical schedule corpus.
- Unlicensed TIA-942, BICSI, Uptime Institute, client, or vendor content.
- General-purpose project chatbot or broad autonomous multi-agent EPC system.

## Out of Scope

- Independent Tier III/IV, TIA-942, BICSI, statutory, or contractual certification.
- Automatic closure of findings, NCRs, waivers, tests, or readiness gates.
- Native write-back to external CDE or scheduling platforms.
- Live BMS/EPMS time-series validation.
- General CAD/BIM interpretation or arbitrary shop-drawing approval.
- Customer data used for shared model training or cross-tenant retrieval.

## User Stories

### US-01: Project Access

As a commissioning manager, I want to create a project and assign project-scoped roles so that only authorized people can view, edit, review, or approve project records.

### US-02: Source Ingestion

As a QA/QC lead, I want to upload authorized PDFs, CSVs, XLSX files, images, and email exports so that originals, revisions, hashes, and source locations are preserved.

### US-03: Requirement Review

As a commissioning engineer, I want extracted requirements to show exact source citations, confidence, units, and review status so that I can accept, edit, or reject them before they affect readiness.

### US-04: Evidence Readiness

As a commissioning manager, I want to select a system or gate and see its accepted evidence, failed tests, stale records, and missing prerequisites so that I can decide what blocks acceptance.

### US-05: Action Ownership

As an MEP package manager, I want to assign blockers with owners and due dates so that unresolved evidence gaps have accountable next actions.

### US-06: Change Impact

As a QA/QC lead, I want a revised requirement or asset record to identify affected evidence and approvals so that superseded evidence cannot silently remain valid.

### US-07: Gate Decision

As an authorized approver, I want to approve, reject, or waive a gate with a reason and audit record so that the project has a defensible decision history.

### US-08: Turnover Export

As an operations-readiness lead, I want to export a source-linked evidence pack with hashes and decisions so that handover records can be independently checked.

## Acceptance Criteria

| Story | Pass/fail criteria |
|---|---|
| US-01 | A user without project membership receives `403`; a reviewer cannot perform an approver action; every role change creates an audit event. |
| US-02 | Each accepted upload stores a SHA-256 hash, revision state, uploader, timestamp, and source location; duplicate content is detected by hash. |
| US-03 | No proposed requirement changes readiness until a reviewer accepts it; every proposal contains a page or region citation and validation status. |
| US-04 | For a selected gate, the board separately lists missing, stale, failed, blocked, unapproved, and accepted evidence; `READY` is impossible when any mandatory blocker remains. |
| US-05 | Creating or updating an issue requires an owner and status; overdue open issues appear in the selected system or gate's blocker view. |
| US-06 | A superseding document version marks affected evidence as stale and records the affected requirement, evidence, and prior decision relationships. |
| US-07 | Only a user with the configured approval role can create a gate decision; the decision stores action, reason, actor, timestamp, and evidence baseline. |
| US-08 | An export contains source identifiers, file hashes, decision history, rule/model versions, and a manifest whose hash changes when included content changes. |

## Success Metrics

- 100% of surfaced findings open the exact source page or region.
- At least 98% exact match for values and units in the pilot golden set.
- At least 90% recall on manually labelled requirement clauses.
- At least 90% precision for high-severity findings in a blinded engineer review.
- At least 60% reduction in weekly readiness-report or evidence-pack preparation time.
- At least 70% of assigned pilot evidence tasks completed in-product.
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

## Constraints

- The MVP supports one bounded pilot project, one high-value electrical or cooling system, and one commissioning gate.
- Only customer-authorized or appropriately licensed project and standards content may be processed.
- AI output is advisory and cannot directly set readiness, approve compliance, close findings, or sign tests.
- Customer data is tenant-isolated and is not used for shared model training.
- Initial exchange with existing systems uses controlled file imports and exports.
- Human reviewers must be available to accept requirements, resolve ambiguity, approve waivers, close findings, and sign gates.

## Known Gaps Carried From Fit Analysis

- Predictive schedule risk, live supply-chain intelligence, arbitrary drawing computer vision, broad RFI intelligence, native integrations, and live telemetry are intentionally deferred until representative data and pilot evidence exist.
