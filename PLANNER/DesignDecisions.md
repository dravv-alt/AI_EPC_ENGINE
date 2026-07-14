# Architecture Decision Records

## Key Architectural Choices

### ADR-001: Use a serverless modular monolith for the MVP
**Decision:** Use a Next.js application on Cloudflare Workers with domain modules rather than separate microservices.
**Rationale:** The pilot has a bounded workload, a small engineering team, and a freemium cost constraint (PRD Constraints: "The MVP supports one bounded pilot project..."; PRD Risks: "Free-tier constraints"). The product still needs one consistent authorization boundary across project data, source objects, readiness, and approvals.
**Trade-offs accepted:** Deployment and local reasoning are simpler, but module boundaries must be enforced in code and high-volume workers may later need extraction into separate services.

### ADR-002: Use D1 and Drizzle for authoritative relational data
**Decision:** Store normalized authoritative records in Cloudflare D1 accessed through Drizzle ORM.
**Rationale:** Readiness requires joins across projects, requirements, assets, gates, evidence, findings, and decisions (PRD "Deterministic readiness rules and a red/amber/green board with blocker ownership"). The pilot graph is bounded and must support migrations and database-level foreign keys.
**Trade-offs accepted:** The `edges` table uses application validation for polymorphic endpoints, and complex graph workloads may later require a database migration.

### ADR-003: Store source files and exports in R2
**Decision:** Store immutable originals and generated exports in Cloudflare R2, with object keys and hashes in D1.
**Rationale:** PRD US-02 requires that "Each accepted upload stores a SHA-256 hash, revision state, uploader, timestamp, and source location," and US-08 requires a hash-manifested evidence-pack export; binary objects should not sit in relational rows or on ephemeral Worker filesystems.
**Trade-offs accepted:** Signed URL generation and lifecycle cleanup are required; every export must retain its manifest and source hashes.

### ADR-004: Use hybrid lexical and semantic retrieval
**Decision:** Use D1 FTS5 for exact retrieval and Vectorize for project-scoped semantic retrieval, requiring a source-region citation for every usable result.
**Rationale:** PRD/StructuredPlan Q10 scopes source search narrowly to exact citation/evidence lookup (FTS5 primary, user-facing) while Vectorize is used only internally for extraction/classification matching — keeping the boundary with the excluded "broad RFI intelligence" clean, per the Fit Analysis Gaps section.
**Trade-offs accepted:** Two indexes must be updated idempotently and retrieval results need project namespace filtering and citation validation.

### ADR-005: Make ingestion durable and asynchronous
**Decision:** Use Workflows for resumable job state and Queues for fan-out, with idempotency keys on every processing stage.
**Rationale:** PRD Constraints require durable jobs to be "retryable and idempotent; duplicate delivery cannot duplicate authoritative evidence"; OCR, extraction, indexing, and evidence-pack generation can exceed request limits and depend on unreliable model providers.
**Trade-offs accepted:** Job status, retry limits, dead-letter handling, and user-visible pending states are required.

### ADR-006: Keep readiness deterministic and approvals human-controlled
**Decision:** AI may propose structured records and explanations; a deterministic rules engine alone computes readiness, and an authorized human alone signs decisions.
**Rationale:** PRD Constraints state "Only the deterministic rules engine computes gate readiness; only an authorized human with the configured approval role signs a gate decision," directly to prevent the "False assurance" risk identified in the PRD Risks section.
**Trade-offs accepted:** The product must expose `UNKNOWN` and `BLOCKED`, maintain rule versions, and provide review queues instead of optimizing only for automation.

### ADR-007: Use project-scoped RBAC with strong approval authentication
**Decision:** Use Better Auth sessions, project membership roles, object-level authorization, and TOTP for approver roles.
**Rationale:** PRD US-01 requires that "A user without project membership receives `403`" and "A reviewer cannot perform an approver action"; customer documents and gate decisions require tenant isolation and distinct permissions for viewers, reviewers, field engineers, and approvers.
**Trade-offs accepted:** Every API query must include tenant/project predicates, and role changes must be audit events.

### ADR-008: Make the field experience an offline-capable PWA
**Decision:** Implement the field capture path as a PWA with a local pending queue and explicit sync states.
**Rationale:** PRD Edge Cases require "Offline field captures remain queued locally with a visible sync state and are never shown as accepted until uploaded and processed"; field engineers capture evidence in areas with unreliable connectivity, and the MVP needs a responsive browser workflow without a separate mobile app.
**Trade-offs accepted:** Local storage must be bounded and encrypted where supported; queued evidence cannot become accepted until server processing completes.

### ADR-009: Run CP-SAT as a dedicated solver microservice, not WASM-in-Worker or a hosted optimization API
**Decision:** Run CP-SAT (Google OR-Tools) inside a small containerized HTTP microservice (Python, official `ortools` package), called from a Cloudflare Workflow step as a discrete, idempotent, retryable step, with the DAG/capacities/deadlines passed in on each call and no state held by the service.
**Rationale:** PRD US-09/US-10 require a feasible baseline and warm-started re-solve within stated latency budgets (TRD NFR: baseline p95 <= 60s for 500 tasks/50 resource types; re-solve p95 <= 30s), and PRD/TRD require an explicit infeasibility/bottleneck report rather than a silent failure. The schedule module needs a correct, mature constraint solver (Library-First Rule) invoked from a Cloudflare Workers/OpenNext stack that is otherwise JS/WASM-only.
**Trade-offs accepted:** An additional deployable service and a network hop per solve are required; mitigated by treating each solver call as an idempotent, retryable Workflow step and keeping the service itself stateless and tenant-data-minimal (TRD Security section). Solver-service failures must leave the prior schedule version untouched and mark the event `SOLVE_FAILED` for manual retry (TRD NFR: Solver timeout/fallback).

### ADR-010: Route schedule task/resource extraction through ModelProvider with a mandatory human-review gate for ambiguous fields
**Decision:** Implement schedule extraction/explanation as a second concrete `ModelProvider` adapter (`GeminiModelProvider`), never called directly from schedule services; any missing or ambiguous field is flagged `NEEDS_REVIEW` and routed to a mandatory human review queue (`POST /v1/schedule/tasks/{id}/review`, `POST /v1/schedule/resources/{id}/review`); only `ACCEPTED` records are eligible for solving.
**Rationale:** PRD US-09 and the Constraints section require task and resource-capacity records (duration, dependencies, vendor, lead time, crew/equipment counts) to be extracted without ever silently guessing or auto-accepting an ambiguous or missing field — mirroring the existing requirement-extraction pattern ([[ADR-006]]). TRD specifies Gemini as the schedule-extraction model, distinct from the Workers AI provider used for evidence, and CLAUDE.md's Coding Rules require all AI provider access to go only through `ModelProvider`.
**Trade-offs accepted:** Every schedule extraction job depends on a review-queue UI and reviewer availability before a baseline solve can be triggered; extraction throughput is bounded by human review capacity, which is an accepted trade-off against extraction correctness and auditability.

### ADR-011: Deterministic objective ordering (deadline overrun first, idle time second) as a hard architectural rule, never delegated to the LLM
**Decision:** Encode the two-tier objective (minimize deadline overrun first, then total idle time) as a fixed, code-level parameter of the CP-SAT model itself, never as a value inferred or adjustable by the LLM extraction or explainer agents.
**Rationale:** PRD's Proactive Schedule Management Module section and US-10 specify a deadline-overrun-first, idle-time-second optimization objective (`w1 >> w2`), with an explicit minimum-overrun and bottleneck report when a deadline is infeasible. The PRD's Non-negotiable boundary and the TRD's "Model output cannot mutate ... schedule dates" constraint forbid the LLM from proposing or overriding any schedule date.
**Trade-offs accepted:** Objective tuning requires a code change and redeploy rather than a runtime/config toggle exposed to the LLM or end users; this trades flexibility for auditability and determinism, consistent with the product's AI-advisory-only boundary.

### ADR-012: Immutable, append-only schedule_version history instead of mutable in-place schedule updates
**Decision:** Store every baseline solve and re-solve as a new, immutable `schedule_version` row (task dates, critical path, solver status) linked to its predecessor and triggering `schedule_event`; never update a shared "current schedule" row in place.
**Rationale:** PRD US-10 and US-11 require every re-solve to produce "a new immutable schedule version with full history retained," and TRD's Data Storage section states each `schedule_version` is a complete immutable snapshot with a pointer to its predecessor and triggering event, mirroring the existing "no authoritative readiness value stored as an unversioned mutable flag" rule ([[ADR-006]] lineage).
**Trade-offs accepted:** Storage grows with every re-solve event; this is accepted because auditability (PRD US-11 and the turnover-export requirements) and the explainer agent's before/after diff generation both depend on retaining every historical version untouched.

### ADR-013: Delta-detector gating re-solves, rather than re-solving on every schedule event
**Decision:** Route every `schedule_event` through a delta detector that checks the event against the current `schedule_version`'s critical path and dependency structure; if unaffected, only the task's actual status/date is updated (no new version, no solver call); if affected, a Workflow step calls the solver microservice warm-started from the current version.
**Rationale:** PRD US-10 states an event should trigger a re-solve "only when it actually matters so that the schedule stays accurate without noisy churn," and TRD's NFRs bound baseline/re-solve latency (p95 <= 60s / 30s) — re-solving on every event would multiply solver load and cost without proportional value when an event does not affect the critical path or downstream dependencies.
**Trade-offs accepted:** The delta detector itself becomes a piece of logic that must be correct (a missed impacted-event would leave a stale schedule); concurrent events against the same task are serialized so the second event's delta check runs against already-updated state (TRD Delta Detection and Solve section), and an event referencing a task absent from the current version is explicitly rejected rather than silently ignored.

## Rejected Alternatives

- **Microservices (for the overall MVP, [[ADR-001]]):** rejected because independent deployment and cross-service authorization would add operational complexity before pilot scale requires it.
- **Long-running container API (for the overall MVP, [[ADR-001]]):** rejected because idle infrastructure cost conflicts with the free starting model.
- **Neo4j ([[ADR-002]]):** rejected because the MVP needs bounded typed traversals, not an independently operated graph database.
- **PostgreSQL ([[ADR-002]]):** deferred because managed PostgreSQL adds a paid always-on dependency to the initial freemium deployment profile.
- **D1 BLOB columns ([[ADR-003]]):** rejected because large binary data would couple transactional storage to document volume.
- **Local filesystem ([[ADR-003]]):** rejected because Workers do not provide durable shared disk.
- **Vector-only retrieval ([[ADR-004]]):** rejected because exact identifiers and numeric clauses can be missed or distorted by embeddings.
- **FTS-only retrieval ([[ADR-004]]):** rejected because equivalent requirement wording would not be found reliably.
- **Synchronous request processing ([[ADR-005]]):** rejected because large files would timeout and a provider failure would make the upload outcome ambiguous.
- **LangGraph/CrewAI orchestration ([[ADR-005]]):** rejected because the workflow is typed, deterministic, and approval-gated rather than an open-ended autonomous agent loop.
- **LLM-generated readiness ([[ADR-006]]):** rejected because output is non-deterministic and difficult to audit as an approval basis.
- **Fully autonomous issue closure ([[ADR-006]]):** rejected because it would bypass engineering authority and evidence review.
- **Tenant-wide roles only ([[ADR-007]]):** rejected because contractors and consultants need access to selected projects, not the entire organization.
- **External enterprise SSO first ([[ADR-007]]):** deferred until a pilot buyer requires it; the authorization model will remain compatible with later SSO.
- **Native iOS/Android apps ([[ADR-008]]):** rejected because two additional codebases would slow the pilot and reduce deployment reach.
- **Online-only capture ([[ADR-008]]):** rejected because a failed connection could lose or misrepresent field evidence.
- **WASM OR-Tools build ([[ADR-009]]):** rejected because no official OR-Tools WASM build exists (an unofficial build would violate the Library-First Rule's intent), a WASM build would be forced single-threaded (Workers isolates cannot spawn native threads) which degrades CP-SAT performance beyond toy DAGs, and Workers CPU-time/script-size limits are a poor fit for solver runs whose duration is workload-dependent (TRD Tech Stack, Solver integration approach section).
- **Hosted third-party optimization API ([[ADR-009]]):** rejected because it would introduce an uncontrolled external dependency for a deterministic computation the product must be able to fully explain and audit (PRD constraint: "only the deterministic CP-SAT solver computes schedule dates, critical path, and feasibility"), and would complicate the tenant-isolation/no-shared-training data-handling requirements that a self-operated microservice can satisfy directly.
- **Calling the Gemini SDK directly from schedule services ([[ADR-010]]):** rejected because it would violate the existing "AI provider access goes only through `ModelProvider`" rule (CLAUDE.md Coding Rules) and couple schedule logic to one vendor.
- **Auto-accepting high-confidence extractions without review ([[ADR-010]]):** rejected because PRD success metrics require "100% of accepted schedule tasks and resource-capacity records with ambiguous/missing fields routed to human review, with zero silent auto-acceptance," and because human reviewers must remain in the loop per the Hard Constraints.
- **Letting the LLM propose dates directly / tune objective weights per project ([[ADR-011]]):** rejected because it would let a non-deterministic component influence computed schedule dates and critical path, directly violating the PRD's "only the deterministic CP-SAT solver computes schedule dates, critical path, and feasibility" constraint.
- **A single-objective (deadline-only) formulation ([[ADR-011]]):** rejected because PRD explicitly requires idle-time minimization as a secondary objective to "automatically pull forward independent tasks to fill freed slack."
- **Mutable in-place schedule updates ([[ADR-012]]):** rejected because overwriting the current schedule on every solve would make before/after audit reconstruction impossible and conflicts with the TRD's "Schedule version audit" NFR requiring full before/after reconstruction and hash-linking to the predecessor.
- **Re-solving on every event unconditionally ([[ADR-013]]):** rejected because it would generate unnecessary solver-microservice cost/latency for events with no schedule impact and would create version-history noise contrary to PRD's "without noisy churn" requirement.

## Decisions Log

| Date | Decision | Rationale | Author |
|---|---|---|---|
| 2026-07-14 | ADR-001: Serverless modular monolith | Small team, bounded pilot, freemium runtime | PlanBoard |
| 2026-07-14 | ADR-002: D1 + Drizzle | Normalized joins with low operational overhead | PlanBoard |
| 2026-07-14 | ADR-003: R2 for binary objects | Durable source and export storage | PlanBoard |
| 2026-07-14 | ADR-004: Hybrid FTS + semantic search | Exact EPC identifiers plus semantic matching | PlanBoard |
| 2026-07-14 | ADR-005: Workflows + Queues | Retryable, resumable processing | PlanBoard |
| 2026-07-14 | ADR-006: Deterministic readiness | Prevent false assurance and preserve authority | PlanBoard |
| 2026-07-14 | ADR-007: Project RBAC + TOTP | Tenant isolation and controlled approval | PlanBoard |
| 2026-07-14 | ADR-008: Offline-capable PWA | Reliable field capture with one web codebase | PlanBoard |
| 2026-07-14 | ADR-009: CP-SAT as dedicated solver microservice | No OR-Tools WASM build; Workers CPU/size limits unfit for solver runs | PlanBoard |
| 2026-07-14 | ADR-010: Gemini ModelProvider + mandatory review for schedule extraction | Never silently guess ambiguous task/resource fields | PlanBoard |
| 2026-07-14 | ADR-011: Fixed deadline-overrun-first, idle-time-second objective | Keep schedule-date computation deterministic, not LLM-tunable | PlanBoard |
| 2026-07-14 | ADR-012: Immutable append-only schedule_version history | Full before/after audit reconstruction per re-solve | PlanBoard |
| 2026-07-14 | ADR-013: Delta detector gates re-solves | Avoid unnecessary solver cost/latency and version-history churn | PlanBoard |
