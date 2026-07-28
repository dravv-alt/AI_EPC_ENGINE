# Project Status

This is the status ledger for Pramana Cx: what's verified, what's built-but-unverified, what's still a gap, and what the last local verification run actually covered. See [README.md](README.md) for what the product is and how to run it.

## Current status

The merged application is a locally verified release candidate, not yet a production deployment. The Phase 0 platform, evidence-to-turnover, deterministic scheduling, governed Cx, compliance, predictive risk, shipment polling, and cited knowledge workflows pass the full isolated matrix. Production sign-off still depends on the live integrations and operational controls listed under **What remains**.

The three retrieval-backed agents (Specification & Quality Compliance, Predictive Schedule Risk, Project Knowledge & RFI) have completed the remediation sequenced in [agentFixingPlan.md](PLANNER/agentFixingPlan.md): semantic candidate discovery and a governed model verdict for compliance, provenance-labelled risk mitigations with deterministic failure fallback, and a plan/decompose-then-synthesize knowledge pipeline with code-enforced citation grounding. They share one provider boundary: local Ollama Gemma 4 e2b by default, Gemini or NVIDIA NIM for structured generation, and Ollama/Gemini/the stateless retrieval service for embeddings. Mock mode is confined to deterministic verification and is rejected by production configuration validation.

## What changed in the reported-QA pass (28 July 2026)

- Added Clerk-native sign-in/sign-up/account controls and persisted verified-email linking to local project membership, with an explicit pending-access state instead of an ambiguous authorization failure.
- Connected header search, notifications, help, View brief, source regions, Knowledge citations, and other previously display-only controls to real routes.
- Added deterministic Knowledge fallback over controlled extracted text and explicit citation/no-result/error states.
- Reworked cramped Actions/Cx/Turnover layouts and added bounded scrolling to the authority graph and audit timeline.
- Seeded a real previous controlled source version so Changes can demonstrate blast-radius comparison rather than failing its only available test path.
- Added database-derived dashboard charts, audit activity, operational summaries, direct controls, and replayed presentation-only motion.
- Corrected in-transit marine routing so offshore vessel fixes cannot be snapped into a cross-country road route.
- Separated the Weather monitor visually with current Open-Meteo waypoint conditions, larger condition zones, peak wind/rain, observation time, and a clear operational-delay threshold.
- Added a cross-feature [backend authority audit](docs/BACKEND_AUTHORITY_AUDIT.md), a [reported error ledger](docs/ERRORS_AND_FIXES.md), and a reproducible [Windows/Linux setup](docs/LOCAL_SETUP_WINDOWS_LINUX.md).

## What changed in the merge-readiness pass (21 July 2026)

- Fixed duplicate React identities in Readiness and duplicate system/gate business keys at the database boundary. Migrations repair historical exact duplicates, preserve conflicting historical rows with explicit legacy labels, and add unique indexes.
- Added a relational integrity gate covering graph-edge duplication; system/gate/asset/evidence/Cx scope; shipment tenant/project/equipment ownership; and required indexes.
- Completed query-parameter consumption for Readiness, Schedule, Actions, and Shipments. Browser traversal confirmed Command Center links open the referenced task, finding, gate, risk, schedule version, or shipment rather than a generic page.
- Replaced scattered model calls with the shared bounded provider boundary. Ollama `gemma4:e2b` plus `nomic-embed-text:latest` passed a live structured-generation/768-dimensional embedding smoke test; Gemini/NIM input, output, deadline, and fail-closed contracts passed without requiring a key. A live Gemini call is still a deployment prerequisite when Gemini is selected.
- Fixed the uploaded-source/RAG handoff. Every completed extraction now materializes semantic chunks independently of proposal generation; migration `0019` repairs previously processed sources that had citation regions but no RAG index.
- Added mandatory-first document scope to Knowledge. Reviewers can select a controlled document, uniquely named documents are deterministically resolved from the query, and document ID is enforced in SQL before ranking. LLM metadata guesses may decompose a query but cannot silently narrow authority-bearing scope. Citation chips now display the document title.
- Reprocessed the supplied `TIA-942.pdf`: 26 citation regions and 26 Ollama embeddings were present. A real browser query produced only TIA-grounded claims and exact region links; the earlier ASHRAE/NFPA misattribution no longer occurs.
- Added progress, disabled/busy states, bounded client/server timeouts, concise raw-value presentation, responsive navigation, and clearer provenance/empty/error states across long-running workflows.
- Rendered shipment routes and position markers from saved coordinates for sea, air, and land modes, with antimeridian-safe routing, explicit synthetic/live provenance, a visible no-coordinate state, and bounded public-geocoder/weather/route calls.
- Reconciled Drizzle migration history instead of mechanically combining incompatible snapshots. Added schema/business-key repairs and the historical source-index backfill.
- Upgraded dependency metadata and pinned patched runtime PostCSS. `npm audit --omit=dev` reports zero production vulnerabilities; four moderate advisories remain in the development-only Drizzle CLI's legacy esbuild toolchain and are not bundled into the application artifact.
- The final uninterrupted `npm run verify:all` passed, including both composite chains: AIS → weather → alert → deep link → risk, and semantic retrieval → grounded synthesis/RFI similarity.

The 10-slice remediation sequenced in [PLANNER/final_fix_plans.md](PLANNER/final_fix_plans.md) is also complete: named/overridable target constants, solver timeout+bounded-retry+`SOLVE_FAILED` degradation, rate-limit coverage across auth/upload/schedule/export/knowledge endpoints, owner/due-date on compliance-generated findings, overdue-finding visibility in blocker views (kept separate from the readiness verdict), CP-SAT solver/model provenance in the turnover manifest, an advisory evidence-entropy score, teach-back generalized from compliance-only to all seven review routes, RFI resolution state, and mandatory-first metadata filters (system/asset/gate/revision/date) on knowledge retrieval.

| Area | State | What exists now |
| --- | --- | --- |
| Platform, tenancy, auth, RBAC | Verified | Project membership enforcement, credentials sessions, optional Clerk adapter, TOTP, session revocation, category-scoped rate limits across auth/upload/schedule/export/AI/knowledge endpoints (auth 429s never leak account existence), audit chain |
| Controlled sources and provenance | Verified | Hash-controlled PDF storage, PyMuPDF extraction, page/bounding-box regions, exact citations, revision blast radius |
| Evidence, readiness, gate approval | Verified | Pending-to-accepted evidence review, deterministic readiness v2.1, fresh-TOTP gate approval, immutable decision baseline, overdue findings surfaced in blocker views at any severity (visibility only — the readiness verdict itself is unaffected) |
| Evidence entropy (advisory) | Verified | Deterministic, LLM-free weak-evidence score (over-reuse, stale/unsigned, missing calibration, circular edges, low-confidence extraction, overloaded approver) with per-signal drill-down and honest `unavailable` reporting; structurally isolated from `computeReadiness` |
| Turnover | Verified | Approved-gate-only manifests, canonical hashes, signed artifact URLs, independent verification, CP-SAT solver version + Gemini explanation-model version in a deterministic `scheduleSnapshot` section |
| Deterministic scheduling | Verified | Reviewed tasks/resources, dependency checks, CP-SAT solve, immutable versions, event-driven re-solve, warm starts, bounded solver timeout + backed-off retry degrading to an explicit `SOLVE_FAILED` state with the prior version left untouched and an audit trail |
| Systems, assets, findings, graph | Verified | Project-scoped CRUD, typed provenance edges, action lifecycle, graph explorer, compliance-generated findings carry a deterministic project-scoped owner and severity-derived due date on both the proposal and human-acceptance paths |
| Offline field capture | Verified | IndexedDB queue, device encryption where available, idempotent sync/re-post, immutable object storage, PWA shell |
| Governed Cx workflow | Verified | Standard ingestion, cited checklist generation/review, deterministic readings, human-routed narrative steps, editable draft, approved immutable report |
| Shipments | Verified locally | Asset-linked legs, estimate provenance, delayed/recovered events, graph-derived schedule mappings, coordinate route overlays, AIS/weather polling, explicit live/synthetic provenance |
| Compliance | Verified | Metadata-filtered semantic candidate discovery across submittals/POs/shop-drawings/drawings, LLM-owned verdict with the deterministic comparator retained as mock-supplier and recorded cross-check, code-enforced grounding validation, unchanged exact-citation precedent semantics, AI-suggestion labeling, source-hierarchy conflict panel, scan-triggered review queue |
| Compliance modality tiering | Verified | A requirement carries a stored `comparisonModality` (numeric/boolean/categorical/narrative) set at extraction; a tagged requirement routes to that one comparator branch only. When the branch's own precondition isn't met it returns `needs_engineering_judgment` of that same comparison type rather than silently falling through to a different branch's heuristic — a mis-tagged clause degrades to human judgment instead of a wrong-comparator verdict |
| Teach-back (generalized) | Verified | Reusable, cited, attributed correction capture on edit/reject (never on plain accept) across all seven generic review routes, surfaced as read-only advisory context on similar future reviews, never auto-applied; the specialized `compliancePrecedents` exact-hash path is untouched |
| Knowledge and RFI similarity | Verified | Mandatory-first, in-SQL metadata filters (project/document ID/doc-type/system/asset/gate/revision/date) before ranking, deterministic exact-title routing, provider-tagged embeddings, reranking, graph-context expansion, plan/decompose-then-synthesize with code-enforced groundedness, document-labelled citation chips, explicit no-results state, and resolved-only RFI suggestions |
| Predictive risk | Verified | Swappable procurement/lead-time/workforce/weather clients, a lively hash-seeded synthetic formula that organically crosses materiality thresholds, LLM-generated mitigation proposals with a static fallback on any failure, durable polls, deterministic materiality, task/type deduplication, self-resolution, alerts, recurring BullMQ orchestration, project-scoped event validation, APIs, and schedule UI |
| Command Center | Verified core flow | Stable alert/recovery state plus exact finding/gate/task/risk/version/shipment cross-links; advanced grouping and ownership filters remain product depth |
| Production hardening | Release candidate | Production build, real MinIO round-trip, authentication rate-limit equivalence, migration, audit, timeout, and failure-recovery tests pass; CI, accessibility, observability, load, backups, and live-provider acceptance remain deployment gates |

## Latest local verification result

The complete local matrix passed against a newly built production artifact. It applies all migrations, starts isolated test runtimes, and removes its synthetic records after each tracer where safe to do so.

| Check | Result | Evidence covered |
| --- | --- | --- |
| Database and production artifact | Passed | All migrations, TypeScript, and optimized Next.js production build |
| Config targets | Passed | Every named accuracy/latency/timeout constant resolves to its documented default, respects an env override, and rejects an out-of-range override |
| Foundation contracts | Passed | Redis rate limit, durable-job idempotency, encrypted TOTP, event validation, model boundary, signed object reads |
| Credentials and MFA | Passed | Registration, HttpOnly session, scoped profile, TOTP enrollment, MFA challenge, MFA login |
| Evidence to turnover | Passed | Pending evidence, accepted-only proof, deterministic readiness, fresh-TOTP decision, immutable pack, independent manifest verification |
| Turnover schedule/solver provenance | Passed | `scheduleSnapshot` carries solver version + explanation-model version, sort-deterministic assignments, manifest hash stable across two generations, clean omission when no schedule version exists |
| Evidence entropy | Passed | Over-reuse and stale-record signals fire with correct contributions, an uncomputable signal reports `unavailable` (never 0), readiness verdict byte-identical with and without the score |
| Deterministic schedule | Passed | Reviewed inputs, resource/dependency constraints, CP-SAT optimum, immutable versions, shipment-triggered warm-start re-solve |
| Solver resilience | Passed | Timeout aborts rather than hangs, bounded backed-off retry, prior schedule version byte-identical after exhaustion, `SOLVE_FAILED` recorded with an audit event, resubmission requeues, a recovering stub still succeeds |
| Governed Cx | Passed | Controlled standard extraction, cited checklist, readings, editable report, immutable approved evidence artifact |
| Ingestion formats | Passed | PDF, CSV, and XLSX resolve by content-type with extension fallback, each producing hashed immutable originals and typed extraction regions |
| Governed compliance | Passed | Unit normalization, semantic candidate discovery, LLM-owned verdict with recorded deterministic cross-check, non-authoritative proposed finding, human blocker promotion, exact-citation precedent, cross-project rejection |
| Compliance modality tiering | Passed | Extraction stores a `comparisonModality`; a tagged requirement routes to that branch only, and an unmet precondition degrades to `needs_engineering_judgment` of the same comparison type instead of falling through to another comparator |
| Compliance finding owner/due-date | Passed | Both the proposal and human-acceptance paths derive a real, project-scoped owner (never fabricated/cross-project) and a severity-scaled due date |
| Teach-back (generalized) | Passed | Reject/edit capture rationale with before/after values, plain accept captures nothing, cross-project notes never leak, surfaced notes never mutate the reviewed record's state, `compliancePrecedents` untouched |
| Predictive risk | Passed | Four-source poll, lively synthetic signal formula, LLM-generated mitigations with static fallback, explicit unavailable state, materiality/deduplication, self-resolution, advisory alert, review, solver isolation |
| Knowledge and RFI | Passed | Metadata-filtered retrieval (project/document/doc-type/system/asset/gate/revision/date, mandatory-first in SQL), exact-title routing, reranking, graph context, grounded synthesis, and resolved-only RFI similarity; the supplied TIA PDF also passed a real Ollama/browser query |
| Rate-limit coverage | Passed | Auth (login/register/TOTP), upload, schedule, export, and knowledge routes all return a real HTTP 429 past budget with a retry hint; the auth 429 is byte-identical for a real vs. nonexistent account |
| Overdue findings | Passed | Low-severity overdue and high-severity in-date findings both surface in the gate blocker view with correct reasons; `computeReadiness`'s verdict and every input stay byte-identical before/after the overdue finding exists |
| Model provider foundation | Passed | Live Ollama Gemma e2b generation + nomic 768-d embeddings; mock/Ollama/Gemini/NIM boundary, JSON repair, deadlines, output caps, and fail-closed hosted-provider contracts |
| Retrieval service | Passed (skips offline) | Embed/rerank contract verified against the live container when `EMBEDDING_PROVIDER=service`; skips cleanly in the default offline matrix |
| Audit integrity | Passed | Canonical hash-chain verified with no forks and a single head |

Run the same matrix with `npm run verify:all`. The final post-fix run completed with `All local verification suites passed.`

## What remains

The verified foundation is usable locally. The following work is still required before representing the full Phase 0–4 product as complete or production-ready:

1. **Predictive-risk automation:** recurring orchestration is already shipped; what remains is long-running worker restart/recovery and configured external-provider acceptance. Predictive-risk signals are still synthetic-but-lively by default rather than sourced from real procurement/lead-time/workforce systems.
2. **Command Center depth:** exact entity links and recovery state are shipped; grouped active/resolved views and severity/owner filters remain.
3. **Ingestion coverage:** PDF, CSV, and XLSX are supported with immutable originals, extraction provenance, limits, and failure states. Image sources (scanned/handwritten/illegible documents requiring OCR) and email-export ingestion remain future scope — not started; OCR in particular needs an illegibility-detection/manual-review routing path, not just text extraction.
4. **External integrations:** configure real risk-signal and AIS/weather/congestion providers while retaining explicit provenance, timeouts, unavailable states, and deterministic synthetic local behavior.
5. **Production validation:** the real MinIO round-trip and local pgvector migration pass. A clean production-like Compose run, migration-from-empty on the target database, backup/restore drill, and configured Gemini/NIM/retrieval-service acceptance still require the target environment and credentials.
6. **Quality gates:** turn the current local matrix into CI; add accessibility/axe checks, browser journeys, cross-tenant expansion, load tests, and failure injection.
7. **Operations:** add structured logs, correlation/job IDs, metrics, traces, queue dashboards, alerting, retention execution, secrets policy, backups, and deployment runbooks.

The items above are explicit release gates, not hidden failures in the passing local matrix. Until they are completed, this code should be described as locally release-ready—not production-approved.

## Documentation precedence

When documents conflict, implementation follows this order:

1. [PLANNER/Human.md](PLANNER/Human.md) for explicit human safety and authority constraints
2. [PLANNER/CanonicalBuildPlan.md](PLANNER/CanonicalBuildPlan.md) for the reconciled execution baseline
3. [PLANNER/PRD.md](PLANNER/PRD.md) for product behavior
4. [PLANNER/TRD.md](PLANNER/TRD.md) and [PLANNER/DesignDecisions.md](PLANNER/DesignDecisions.md) for technical constraints
5. Current migrations, tests, and this status ledger for actual shipped state

No AI-generated proposal may bypass human acceptance merely because an older planning document implies automation.

### Which document to read for what

Every document falls into exactly one of three roles. A document's role determines whether it may be trusted as current.

| Role | Documents | Trust as |
| --- | --- | --- |
| **Live state** — updated as the build changes | [README.md](README.md), [CAPABILITIES.md](CAPABILITIES.md), this file, [local_dev_guide.md](local_dev_guide.md), [PLANNER/Tracker.md](PLANNER/Tracker.md), [PLANNER/RetrievalArchitecture.md](PLANNER/RetrievalArchitecture.md), plus the git-ignored local `Testing_mock.md` walkthrough | Current |
| **Approved planning baseline** — frozen intent, still authoritative for *what should be true* | [PLANNER/PRD.md](PLANNER/PRD.md), [PLANNER/StructuredPlan.md](PLANNER/StructuredPlan.md), [PLANNER/TRD.md](PLANNER/TRD.md), [PLANNER/Schema.md](PLANNER/Schema.md), [PLANNER/DesignDecisions.md](PLANNER/DesignDecisions.md), [PLANNER/AppFlow.md](PLANNER/AppFlow.md), [PLANNER/Rules.md](PLANNER/Rules.md), [PLANNER/Features.md](PLANNER/Features.md), [PLANNER/Human.md](PLANNER/Human.md), [PLANNER/CanonicalBuildPlan.md](PLANNER/CanonicalBuildPlan.md), [PLANNER/FoundationBuildPlan.md](PLANNER/FoundationBuildPlan.md), the three `ImplementationPlan*.md` files | Intent, not shipped state |
| **Historical record** — completed plans and original strategy, retained unedited | [PLANNER/completion_Plan.md](PLANNER/completion_Plan.md), [PLANNER/agentFixingPlan.md](PLANNER/agentFixingPlan.md), [PLANNER/final_fix_plans.md](PLANNER/final_fix_plans.md), [PLANNER/Phase3Phase4Verification.md](PLANNER/Phase3Phase4Verification.md), [docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md), [Commissioning_Quality_Assurance_Copilot.md](Commissioning_Quality_Assurance_Copilot.md), [Supply_Chain_Visibility_Risk_Agent.md](Supply_Chain_Visibility_Risk_Agent.md) | Closed; superseded by this file |

Two conventions matter when reading the historical plans:

- **"Slice N" is not a shared numbering scheme.** `completion_Plan.md` (Slices 1–16), `agentFixingPlan.md` (Slices 0–9), and `final_fix_plans.md` (Slices 1–10) each number independently. A slice number is only meaningful together with its plan.
- **The chronological build ledger is git history.** No Markdown file tracks commit-by-commit progress; this status table plus `PLANNER/Tracker.md` cover current state.
