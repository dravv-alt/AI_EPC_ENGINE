# Architecture Decision Records

## ADR-001: Use a serverless modular monolith for the MVP
**Status:** Accepted
**Date:** 2026-07-14
**Context:** The pilot has a bounded workload, a small engineering team, and a freemium cost constraint. The product still needs one consistent authorization boundary across project data, source objects, readiness, and approvals.
**Decision:** Use a Next.js application on Cloudflare Workers with domain modules rather than separate microservices.
**Alternatives considered:**
- Microservices: rejected because independent deployment and cross-service authorization would add operational complexity before pilot scale requires it.
- Long-running container API: rejected because idle infrastructure cost conflicts with the free starting model.
**Consequences:** Deployment and local reasoning are simpler, but module boundaries must be enforced in code and high-volume workers may later need extraction into separate services.

## ADR-002: Use D1 and Drizzle for authoritative relational data
**Status:** Accepted
**Date:** 2026-07-14
**Context:** Readiness requires joins across projects, requirements, assets, gates, evidence, findings, and decisions. The pilot graph is bounded and must support migrations and database-level foreign keys.
**Decision:** Store normalized authoritative records in Cloudflare D1 accessed through Drizzle ORM.
**Alternatives considered:**
- Neo4j: rejected because the MVP needs bounded typed traversals, not an independently operated graph database.
- PostgreSQL: deferred because managed PostgreSQL adds a paid always-on dependency to the initial freemium deployment profile.
**Consequences:** The `edges` table uses application validation for polymorphic endpoints, and complex graph workloads may require a later database migration.

## ADR-003: Store source files and exports in R2
**Status:** Accepted
**Date:** 2026-07-14
**Context:** Source documents, page renders, and turnover packs are binary objects that should not be stored in relational rows or on ephemeral Worker filesystems.
**Decision:** Store immutable originals and generated exports in Cloudflare R2, with object keys and hashes in D1.
**Alternatives considered:**
- D1 BLOB columns: rejected because large binary data would couple transactional storage to document volume.
- Local filesystem: rejected because Workers do not provide durable shared disk.
**Consequences:** Signed URL generation and lifecycle cleanup are required; every export must retain its manifest and source hashes.

## ADR-004: Use hybrid lexical and semantic retrieval
**Status:** Accepted
**Date:** 2026-07-14
**Context:** EPC searches often depend on exact tags, model numbers, clause identifiers, units, and tolerances, while reviewers also need semantic matches across varied wording.
**Decision:** Use D1 FTS5 for exact retrieval and Vectorize for project-scoped semantic retrieval, requiring a source-region citation for every usable result.
**Alternatives considered:**
- Vector-only retrieval: rejected because exact identifiers and numeric clauses can be missed or distorted by embeddings.
- FTS-only retrieval: rejected because equivalent requirement wording would not be found reliably.
**Consequences:** Two indexes must be updated idempotently and retrieval results need project namespace filtering and citation validation.

## ADR-005: Make ingestion durable and asynchronous
**Status:** Accepted
**Date:** 2026-07-14
**Context:** OCR, extraction, indexing, and evidence-pack generation can exceed request limits and may depend on unreliable model providers.
**Decision:** Use Workflows for resumable job state and Queues for fan-out, with idempotency keys on every processing stage.
**Alternatives considered:**
- Synchronous request processing: rejected because large files would timeout and a provider failure would make the upload outcome ambiguous.
- LangGraph/CrewAI orchestration: rejected because the workflow is typed, deterministic, and approval-gated rather than an open-ended autonomous agent loop.
**Consequences:** Job status, retry limits, dead-letter handling, and user-visible pending states are required.

## ADR-006: Keep readiness deterministic and approvals human-controlled
**Status:** Accepted
**Date:** 2026-07-14
**Context:** A false green state could create safety, contractual, and certification risk. AI extraction can be useful, but it is not an authorized engineering decision.
**Decision:** AI may propose structured records and explanations; a deterministic rules engine alone computes readiness, and an authorized human alone signs decisions.
**Alternatives considered:**
- LLM-generated readiness: rejected because output is non-deterministic and difficult to audit as an approval basis.
- Fully autonomous issue closure: rejected because it would bypass engineering authority and evidence review.
**Consequences:** The product must expose `UNKNOWN` and `BLOCKED`, maintain rule versions, and provide review queues instead of optimizing only for automation.

## ADR-007: Use project-scoped RBAC with strong approval authentication
**Status:** Accepted
**Date:** 2026-07-14
**Context:** Customer documents and gate decisions require tenant isolation and different permissions for viewers, reviewers, field engineers, and approvers.
**Decision:** Use Better Auth sessions, project membership roles, object-level authorization, and TOTP for approver roles.
**Alternatives considered:**
- Tenant-wide roles only: rejected because contractors and consultants need access to selected projects, not the entire organization.
- External enterprise SSO first: deferred until a pilot buyer requires it; the authorization model will remain compatible with later SSO.
**Consequences:** Every API query must include tenant/project predicates, and role changes must be audit events.

## ADR-008: Make the field experience an offline-capable PWA
**Status:** Accepted
**Date:** 2026-07-14
**Context:** Field engineers may capture photos, observations, and test evidence in areas with unreliable connectivity. The MVP also needs a responsive browser workflow without a separate mobile app.
**Decision:** Implement the field capture path as a PWA with a local pending queue and explicit sync states.
**Alternatives considered:**
- Native iOS/Android apps: rejected because two additional codebases would slow the pilot and reduce deployment reach.
- Online-only capture: rejected because a failed connection could lose or misrepresent field evidence.
**Consequences:** Local storage must be bounded and encrypted where supported; queued evidence cannot become accepted until server processing completes.

## Decisions Log

| Date | ADR | Decision | Rationale | Author |
|---|---|---|---|---|
| 2026-07-14 | ADR-001 | Serverless modular monolith | Small team, bounded pilot, freemium runtime | PlanBoard |
| 2026-07-14 | ADR-002 | D1 + Drizzle | Normalized joins with low operational overhead | PlanBoard |
| 2026-07-14 | ADR-003 | R2 for binary objects | Durable source and export storage | PlanBoard |
| 2026-07-14 | ADR-004 | Hybrid FTS + semantic search | Exact EPC identifiers plus semantic matching | PlanBoard |
| 2026-07-14 | ADR-005 | Workflows + Queues | Retryable, resumable processing | PlanBoard |
| 2026-07-14 | ADR-006 | Deterministic readiness | Prevent false assurance and preserve authority | PlanBoard |
| 2026-07-14 | ADR-007 | Project RBAC + TOTP | Tenant isolation and controlled approval | PlanBoard |
| 2026-07-14 | ADR-008 | Offline-capable PWA | Reliable field capture with one web codebase | PlanBoard |
