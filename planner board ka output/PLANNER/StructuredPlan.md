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

The challenge seeks an AI-supported intelligence layer across EPC information that enables proactive management, automated quality and compliance assistance, and commissioning support. For a safe and credible first product, the immediate outcome is narrower: an authorized engineer must be able to inspect any supported system or commissioning gate and quickly determine what is required, what accepted evidence proves it, and what still blocks acceptance, with every claim traceable to its exact source and decision history.

## Solution Overview

### Product

Build **Pramana Cx**, an evidence control plane for mission-critical data-centre commissioning. It converts project requirements, asset registers, approved submittals, checklists, test results, issues, and approvals into a versioned evidence graph. Its first paid outcome is a continuously updated L3/L4/L5 or custom-gate readiness board and a verifiable turnover pack, not a generic document chatbot or a broad autonomous EPC agent.

For each system or gate, Pramana Cx produces a defensible readiness result and lists all missing, stale, failed, and unapproved evidence, linked to the source record, responsible owner, and approval history.

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

### Product Boundary

Pramana Cx assists engineering judgment; it does not certify a facility or replace the commissioning authority, engineer of record, TIA-accredited auditor, or Uptime Institute. It processes only standards and project criteria the customer is authorized to use. Proprietary TIA, BICSI, Uptime Institute, client, or vendor content must not be bundled into demos, prompts, embeddings, training data, or reusable templates without an appropriate licence.

## Fit Analysis

The proposed MVP directly addresses the challenge's information-fragmentation, quality-control, and commissioning-assurance needs. It connects controlled requirements to physical assets, test evidence, issues, ownership, and acceptance decisions, making readiness review proactive and auditable. It also provides a foundation on which schedule, procurement, RFI, telemetry, and drawing capabilities could later be added. It deliberately does not claim to cover the entire challenge in version one.

### Gaps

- **Predictive schedule risk:** The MVP does not train or provide a predictive delay model, portfolio forecast, or critical-path simulation. It can expose deterministic readiness blockers, overdue prerequisites, and imported milestone context, but credible prediction requires labelled as-planned/as-built histories and backtesting that are not yet available.
- **Live supply-chain intelligence:** The MVP does not track shipments, multi-tier suppliers, ports, weather, or geospatial routes in real time, and it does not model procurement alternatives. Procurement records may serve as supporting evidence, but live supply-chain visibility is outside v1.
- **Arbitrary drawing computer vision:** The MVP does not promise general CAD/BIM interpretation, geometry comparison, or automated shop-drawing approval. It may ingest supported PDF/image records and preserve visual citations; advanced drawing analysis requires a separate evaluated scope.
- **Broad RFI intelligence:** The MVP is not a general conversational layer over every project record and does not initially perform organization-wide similar-RFI retrieval or contractual answer generation. Source search supports evidence review, but a broad RFI copilot is not the product wedge.
- **Independent compliance or Tier certification:** The platform cannot determine or issue TIA-942, BICSI, Uptime Tier III/IV, statutory, or contractual certification. It can organize licensed customer criteria and evidence for review by the authorized body only.
- **Full native integrations:** Initial pilots use controlled file imports and exports. Native Primavera P6 XER write-back, Procore, Autodesk Construction Cloud, Aconex, CxAlloy, BMS, and EPMS integrations are later work.
- **Automated telemetry validation:** Live time-series ingestion and automated integrated-system-test validation are excluded from the MVP.

### Assumptions

- At least one commissioning consultancy, owner's representative, or EPC/GC quality team will provide a licensed or appropriately redacted project corpus and participate as a design partner.
- The customer can identify the contractual document hierarchy, evidence owners, authorized reviewers, and rules that define readiness for the selected system and gate.
- A bounded first pilot can focus on one electrical or cooling system and one commissioning gate before expanding across L3-L5.
- Most initial evidence can be supplied through supported PDFs, spreadsheets, images, email exports, and controlled CSV templates without replacing the project's existing common data environment.
- Customers will permit either approved SaaS processing or a private/self-hosted deployment profile; this must be confirmed contractually for each pilot.
- Human reviewers will remain available to accept extracted requirements, resolve ambiguity, approve waivers, close findings, and sign gate decisions.
- Source documents are legible enough for evaluated extraction. Photographs, scans, complex tables, handwriting, and multilingual material may require manual review and cannot silently become authoritative evidence.
- Pricing, willingness to pay, time-saving targets, and conversion assumptions remain hypotheses until validated through interviews and paid-pilot criteria.

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
- Measured pilot validation for citation integrity, extraction quality, high-severity precision, report/pack preparation time, workflow adoption, and paid-conversion criteria.

### Explicitly Outside the Initial Pilot

- Predictive schedule forecasting, critical-path optimization, or claims of weeks-ahead delay prediction.
- Live supplier, shipment, weather, port, or geospatial supply-chain tracking and alternative sourcing models.
- General CAD/BIM understanding, arbitrary shop-drawing compliance, or advanced geometry comparison.
- A broad project chatbot, contractual RFI-answering system, or cross-project similar-RFI knowledge product.
- Independent Tier III/IV, TIA-942, BICSI, statutory, or contractual certification and any AI-issued compliance approval.
- Autonomous closure of findings, NCRs, waivers, tests, or readiness gates.
- Native write-back to scheduling/CDE platforms, live BMS/EPMS telemetry, portfolio analytics, and model fine-tuning.

Expansion beyond this scope requires evidence from the pilot: representative licensed data, named acceptance authority, measured user value, acceptable error rates, security and legal clearance, and a buyer willing to fund the next capability.
