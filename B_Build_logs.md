# Build Log — Refinement branch

Branch point: `379a208` on `main`.
38 commits, 100 files changed since divergence (+25,216 / -301 lines).

## What this branch adds

Two distinct phases of work. Phase 1 is a batch of standalone feature slices — live polling (heartbeat, AIS, weather, risk), a semantic knowledge/RFI query layer, a backfill worker, and several UI/cross-linking features across the command center, gate view, turnover manifest, and change-assessment screens. Phase 2 is a focused remediation pass that rebuilt three "agents" (Specification & Quality Compliance, Predictive Schedule Risk, Project Knowledge & RFI) from stub/shallow implementations up to the scope originally planned for them, adding a new Python retrieval microservice and an NVIDIA NIM model provider along the way.

## Phase 1: live polling, semantic knowledge layer, and UI cross-links

- **Seeding + heartbeat/AIS/weather polling** — expanded `scripts/seed.ts` for richer synthetic data; added a health/heartbeat endpoint and BullMQ scheduler entries; added real AIS position-polling (`src/lib/supply/ais-client.ts`) and weather clients (`src/lib/supply/weather-client.ts`) wired into `src/lib/jobs/worker.ts` to auto-transition shipment status and feed predictive-risk HTTP signal clients.
- **Backfill worker** — new `knowledge.embed` job handler in `src/lib/jobs/worker.ts` that scans `knowledgeChunks` rows missing embeddings and backfills them via the model provider (migration `drizzle/0010_glamorous_korg.sql`).
- **Semantic query layer + RFI similarity retrieval** — `src/lib/knowledge/query.ts` extended to do real semantic search; new `rfi-similar` API route for finding similar RFIs, surfaced in `src/components/knowledge-search.tsx`. (This is the layer Phase 2 later rebuilds into a full plan/retrieve/synthesize pipeline.)
- **Graph node expansion** — new endpoint `.../graph/nodes/[nodeId]/route.ts` expands a graph node's neighbors (`src/lib/graph/entities.ts`), rendered in `src/components/graph-workbench.tsx`.
- **Command center cross-links** — alerts now deep-link to related records (TEST_FAILED→finding+gate, SHIPMENT_DELAYED→task+schedule version, predicted_risk_delay→task+mitigation) via `resolveAlertLinks` in `src/lib/dashboard-data.ts`.
- **Live events tab** — merges AIS/weather/risk poll observations into the schedule live-events feed, streamed in `src/components/predictive-risk-workbench.tsx` with freshness shown in `src/components/connection-status.tsx`.
- **Cx records in turnover manifest** — `selectApprovedCxRecordsForManifest` (`src/lib/cx/acceptance.ts`) pulls approved commissioning test records into the turnover-pack manifest.
- **Gate-view read-only schedule context** — `src/lib/readiness/gate-context.ts` extended to surface read-only schedule context on the readiness/gate decision page.
- **Change blast-radius impact list** — `assess-change` route expanded to compute a fuller downstream impact list, rendered via `src/components/change-assessment-list.tsx`.
- **Rate limits + offline/storage hardening** — shared `enforceAiRateLimit(scope)` limiter (`src/lib/redis/rate-limit.ts`, env-configurable via `AI_RATE_LIMIT`/`AI_RATE_LIMIT_WINDOW_SECONDS`) applied to compliance-checks and knowledge-query routes.

## Phase 2: Agent remediation (Specification & Quality Compliance, Predictive Schedule Risk, Project Knowledge & RFI)

Ten commits ("Slice 0" through "Slice 9") implementing the plan in `PLANNER/agentFixingPlan.md`. Summary by area:

**Shared foundation (Slice 0, Slice 1)**
- Split `ModelProvider` into independent `GenerationProvider` (`MODEL_PROVIDER=mock|gemini|nim`) and `EmbeddingProvider` (`EMBEDDING_PROVIDER=mock|service`) interfaces; added `NimModelProvider` against NVIDIA NIM's OpenAI-compatible chat API, plus a shared JSON repair-retry (`requestStructuredJson`) so a malformed model response gets one corrective retry instead of failing outright.
- New stateless FastAPI service `services/retrieval` (port 8003), alongside the pre-existing `services/ingestion` (8001) and `services/solver` (8002): sentence-transformers `BAAI/bge-base-en-v1.5` for 768-dim embeddings (matches the existing `vector(768)` column, no migration needed) and `BAAI/bge-reranker-base` for cross-encoder reranking. No DB access, no auth.
- Added a mixed-embedding-space guard: every `knowledge_chunks` row is tagged with the `embedding_model` that produced it (migration 0012); retrieval filters on the active model tag so switching providers degrades to "fewer results" rather than silently mixing incompatible vector spaces. `scripts/reindex-embeddings.ts` makes a provider switch an explicit, auditable operation.

**Project Knowledge & RFI ("Agent 5") — Slices 2-4**
- `retrieveSemanticCitations` over-fetches and reranks through the retrieval service's cross-encoder when live (`src/lib/knowledge/rerank.ts`), no-op passthrough in mock mode.
- `expandWithGraphContext` (`src/lib/knowledge/expand.ts`) — deterministic, no-LLM one-hop graph context expansion, capped at 5 entries per chunk.
- `answerKnowledgeQuery` (`src/lib/knowledge/pipeline.ts`) replaced raw chunk-concatenation with a two-LLM-call pipeline: planning (intent + doc-type routing + up to 4 sub-queries) → retrieval per sub-query → dedupe/rerank → graph expansion → synthesis, answering only from supplied citations. Groundedness is enforced in code via `filterGroundedClaims` (independently unit-tested), which drops any claim citing even one region outside the retrieved set.
- UI: `KnowledgeSearch` now renders synthesized answers with grouped citation chips (deep links to `/sources/regions/[id]`), graph-context secondary text, and explicit idle/loading/"no results in scope" states.

**Specification & Quality Compliance ("Agent 1") — Slices 5-7**
- Extracted check-creation logic into shared `createComplianceCheck` (`src/lib/compliance/create-check.ts`) used by both the existing pairwise route and a new job handler.
- `discoverCandidateTargets` (`src/lib/compliance/discover.ts`) — the compliance route previously required the caller to already know the target region; this adds automatic discovery via `retrieveSemanticCitations` per target document type. New `POST /compliance/scan` enqueues one idempotent job per (requirement, candidate) pair, falling back to inline execution when Redis is degraded.
- `assessCompliance` (`src/lib/compliance/assess.ts`) gives the LLM full verdict ownership in real mode, but two safety downgrades are enforced in code, never trusted from the model: an unverified grounding region forces `needs_engineering_judgment`, and `equivalent_by_precedent` without an exact-hash accepted precedent is forced down the same path. New `suggestion_source`/`suggestion_model_version` columns (migration 0013) label AI-authored verdicts in the audit trail.
- UI: "Scan for deviations" trigger, an "AI suggestion — needs human review" badge on LLM-authored checks, and an upgraded two-source conflict panel.

**Predictive Schedule Risk — Slice 8**
- `SyntheticSignalClient.poll()` replaced a flat, never-material constant signal with a deterministic-per-cycle hash of taskId+signalType+time-bucket, so risk signals now organically appear, persist, and self-resolve (with a critical-path boost and occasional unavailability).
- `generateMitigations()` (`src/lib/predictive-risk/mitigations.ts`) calls the generation provider for mitigation proposals, using the previous 8 static options as the mock payload and as a fallback on failure.

**Wiring and docs — Slice 9**
- README updated to describe the completed retrieval-backed agents (architecture diagram, status table, credentials) instead of describing them as planned.

## Pre-existing bugs found and fixed along the way

Most fixes were test-script cleanup-ordering races (delete-order/scope bugs in `verify-risk-http.ts`, `verify-risk-http-clients.ts`, `verify-schedule-http.ts`, `verify-polling-http.ts`, `verify-risk-mitigations-http.ts`) surfaced by running the background poll loop continuously across many verification passes — see the Slice 6 and Slice 9 commit messages for details. One real production bug was also fixed: `raiseAlert()` in `src/lib/alerts/write-alert.ts` only checked for an existing ACTIVE alert before inserting, which could race against the DB's unconditional `dedup_key` uniqueness constraint when a risk cycled active→cleared→active again; fixed with an atomic `onConflictDoUpdate` upsert.

## Where to look

- `PLANNER/agentFixingPlan.md` — the plan Phase 2 (Slices 0-9) implements, with full scope/decisions/invariants.
- `services/retrieval/` — new embeddings + rerank microservice.
- `src/lib/compliance/assess.ts`, `src/lib/compliance/discover.ts`, `src/lib/compliance/create-check.ts` — compliance agent rebuild.
- `src/lib/predictive-risk/clients.ts`, `src/lib/predictive-risk/mitigations.ts` — risk agent rebuild.
- `src/lib/knowledge/pipeline.ts`, `src/lib/knowledge/rerank.ts`, `src/lib/knowledge/expand.ts` — knowledge/RFI agent rebuild.
- `src/lib/model/provider.ts` (generation/embedding provider split, NIM support).
- `src/lib/redis/rate-limit.ts`, `src/lib/supply/ais-client.ts`, `src/lib/supply/weather-client.ts` — Phase 1 polling/hardening.
