# Project Status

This is the status ledger for Pramana Cx: what's verified, what's built-but-unverified, what's still a gap, and what the last local verification run actually covered. See [README.md](README.md) for what the product is and how to run it.

## Current status

The Phase 0 platform, Phase 1 evidence-to-turnover tracer, and Phase 2 deterministic schedule tracer are implemented and locally verified. Governed Cx, compliance, and the predictive-risk pipeline are also verified end to end. The remaining Phase 3–4 depth is listed below without treating planned work as shipped.

The three retrieval-backed agents (Specification & Quality Compliance, Predictive Schedule Risk, Project Knowledge & RFI) have completed the remediation sequenced in [agentFixingPlan.md](agentFixingPlan.md): semantic candidate discovery and an LLM-owned verdict for compliance, a lively synthetic signal formula with model-written mitigations for predictive risk, and a two-call plan-then-synthesize pipeline with code-enforced groundedness for knowledge. All three now run in TypeScript inside the core app, generation is swappable between a deterministic mock, Gemini, and NVIDIA NIM, and embeddings/reranking run through a third stateless Python service alongside ingestion and the solver.

| Area | State | What exists now |
| --- | --- | --- |
| Platform, tenancy, auth, RBAC | Verified | Project membership enforcement, credentials sessions, optional Clerk adapter, TOTP, session revocation, rate limits, audit chain |
| Controlled sources and provenance | Verified | Hash-controlled PDF storage, PyMuPDF extraction, page/bounding-box regions, exact citations, revision blast radius |
| Evidence, readiness, gate approval | Verified | Pending-to-accepted evidence review, deterministic readiness v2.1, fresh-TOTP gate approval, immutable decision baseline |
| Turnover | Verified | Approved-gate-only manifests, canonical hashes, signed artifact URLs, independent verification |
| Deterministic scheduling | Verified | Reviewed tasks/resources, dependency checks, CP-SAT solve, immutable versions, event-driven re-solve, warm starts |
| Systems, assets, findings, graph | Verified | Project-scoped CRUD, typed provenance edges, action lifecycle, graph explorer |
| Offline field capture | Built | IndexedDB queue, device encryption where available, idempotent sync, immutable object storage, PWA shell |
| Governed Cx workflow | Verified | Standard ingestion, cited checklist generation/review, deterministic readings, human-routed narrative steps, editable draft, approved immutable report |
| Shipments | Built | Asset-linked legs, estimate provenance, delayed/recovered events, graph-derived schedule mappings, map UI |
| Compliance | Verified | Metadata-filtered semantic candidate discovery across submittals/POs/shop-drawings/drawings, LLM-owned verdict with the deterministic comparator retained as mock-supplier and recorded cross-check, code-enforced grounding validation, unchanged exact-citation precedent semantics, AI-suggestion labeling, source-hierarchy conflict panel, scan-triggered review queue |
| Knowledge and RFI similarity | Verified | Metadata-filtered pgvector retrieval, cross-encoder reranking, deterministic graph-context expansion, a two-call plan-then-synthesize pipeline with a code-enforced groundedness filter (fabricated citations are dropped, never trusted from the model), citation-chip UI, explicit "no results in scope" state |
| Predictive risk | Verified | Swappable procurement/lead-time/workforce/weather clients, a lively hash-seeded synthetic formula that organically crosses materiality thresholds, LLM-generated mitigation proposals with a static fallback on any failure, durable polls, deterministic materiality, task/type deduplication, self-resolution, alerts, recurring BullMQ orchestration, project-scoped event validation, APIs, and schedule UI |
| Command Center | Partial | Stable event alerts and recovery clearing; richer grouping, ownership, and cross-links remain |
| Production hardening | Partial | Builds and focused integration tests pass; CI, accessibility, observability, load, and full Compose/MinIO tests remain |

## Latest local verification result

The complete local matrix passed against a newly built production artifact. It applies all migrations, starts isolated test runtimes, and removes its synthetic records after each tracer where safe to do so.

| Check | Result | Evidence covered |
| --- | --- | --- |
| Database and production artifact | Passed | All 13 migrations, TypeScript, and optimized Next.js production build |
| Foundation contracts | Passed | Redis rate limit, durable-job idempotency, encrypted TOTP, event validation, model boundary, signed object reads |
| Credentials and MFA | Passed | Registration, HttpOnly session, scoped profile, TOTP enrollment, MFA challenge, MFA login |
| Evidence to turnover | Passed | Pending evidence, accepted-only proof, deterministic readiness, fresh-TOTP decision, immutable pack, independent manifest verification |
| Deterministic schedule | Passed | Reviewed inputs, resource/dependency constraints, CP-SAT optimum, immutable versions, shipment-triggered warm-start re-solve |
| Governed Cx | Passed | Controlled standard extraction, cited checklist, readings, editable report, immutable approved evidence artifact |
| Governed compliance | Passed | Unit normalization, semantic candidate discovery, LLM-owned verdict with recorded deterministic cross-check, non-authoritative proposed finding, human blocker promotion, exact-citation precedent, cross-project rejection |
| Predictive risk | Passed | Four-source poll, lively synthetic signal formula, LLM-generated mitigations with static fallback, explicit unavailable state, materiality/deduplication, self-resolution, advisory alert, review, solver isolation |
| Knowledge and RFI | Passed | Metadata-filtered retrieval, reranking, graph-context expansion, plan-then-synthesize pipeline, code-enforced groundedness filter, RFI similarity |
| Model provider foundation | Passed | Mock/Gemini/NIM generation split, mock/service embedding split, JSON-repair retry |
| Retrieval service | Passed (skips offline) | Embed/rerank contract verified against the live container when `EMBEDDING_PROVIDER=service`; skips cleanly in the default offline matrix |
| Audit integrity | Passed | Canonical hash-chain verified with no forks and a single head |
| Browser acceptance | Passed | 19 desktop routes and 11 critical 390×844 mobile routes; no missing page, console warning/error, or document-level horizontal overflow |

Run the same matrix with `npm run verify:all`.

## What remains

The verified foundation is usable locally. The following work is still required before representing the full Phase 0–4 product as complete or production-ready:

1. **Predictive-risk automation:** recurring orchestration is already shipped; what remains is long-running worker restart/recovery and configured external-provider acceptance. Predictive-risk signals are still synthetic-but-lively by default rather than sourced from real procurement/lead-time/workforce systems.
2. **Command Center:** add grouped active/resolved views, severity/owner filters, deep links to source entities, and consistent acknowledgement/recovery semantics.
3. **Ingestion coverage:** PDF, CSV, and XLSX are supported with immutable originals, extraction provenance, limits, and failure states. Image sources (scanned/handwritten/illegible documents requiring OCR) and email-export ingestion remain future scope — not started; OCR in particular needs an illegibility-detection/manual-review routing path, not just text extraction.
4. **External integrations:** configure real risk-signal and AIS/weather/congestion providers while retaining explicit provenance, timeouts, unavailable states, and deterministic synthetic local behavior.
5. **Production validation:** run the complete Compose topology including pgvector and MinIO when Docker is available; validate the S3 driver, retries, recovery, backups, and migration-from-empty behavior. The `EMBEDDING_PROVIDER=service`/`MODEL_PROVIDER=gemini|nim` paths are covered by dedicated verify scripts but require the retrieval container and real API keys respectively to exercise beyond the offline mock-mode matrix.
6. **Quality gates:** turn the current local matrix into CI; add accessibility/axe checks, browser journeys, cross-tenant expansion, load tests, and failure injection.
7. **Operations:** add structured logs, correlation/job IDs, metrics, traces, queue dashboards, alerting, retention execution, secrets policy, backups, and deployment runbooks.

The items above are intentional gaps, not hidden failures in the passing local matrix. Real external credentials and Docker/MinIO availability are the remaining manual prerequisites for the corresponding production-path tests.

## Documentation precedence

When old documents conflict, implementation follows this order:

1. [PLANNER/Human.md](PLANNER/Human.md) for explicit human safety and authority constraints
2. [PLANNER/CanonicalBuildPlan.md](PLANNER/CanonicalBuildPlan.md) for the reconciled execution baseline
3. [PLANNER/PRD.md](PLANNER/PRD.md) for product behavior
4. [PLANNER/TRD.md](PLANNER/TRD.md) and [PLANNER/DesignDecisions.md](PLANNER/DesignDecisions.md) for technical constraints
5. Current migrations, tests, and this status ledger for actual shipped state

No AI-generated proposal may bypass human acceptance merely because an older planning document implies automation.
