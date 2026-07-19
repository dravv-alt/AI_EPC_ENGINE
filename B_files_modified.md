# Files Modified — Refinement branch (merge reference)

Branch point: `379a208c` on `main`. 100 files changed since divergence (50 added, 50 modified, 0 deleted).

Phase split used below:
- **Phase 1** ("earlier branch work"): commits from the branch point up to and including `279f336` (Slice 0: model provider foundation).
- **Phase 2** ("agent remediation"): commits after `279f336` through `Refinement` HEAD (`040279b`).

Status letters: `A` = added, `M` = modified, `D` = deleted (git `--name-status`).

## Python services
- A `services/retrieval/Dockerfile`
- A `services/retrieval/app/main.py`
- A `services/retrieval/requirements.txt`

## Database (schema + migrations)
- M `src/lib/db/schema.ts` — added `embedding_model`, `suggestion_source`/`suggestion_model_version` columns and related fields (touched by 4 commits)
- M `drizzle/meta/_journal.json` — journal entries for new migrations (touched by 4 commits)
- A `drizzle/0010_glamorous_korg.sql`
- A `drizzle/0011_seed_dedup_indexes.sql`
- A `drizzle/0012_low_warhawk.sql`
- A `drizzle/0013_peaceful_freak.sql`
- A `drizzle/meta/0010_snapshot.json`
- A `drizzle/meta/0012_snapshot.json`
- A `drizzle/meta/0013_snapshot.json`

## Core lib — knowledge / retrieval
- A `src/lib/knowledge/expand.ts`
- A `src/lib/knowledge/pipeline.ts`
- A `src/lib/knowledge/rerank.ts`
- M `src/lib/knowledge/query.ts` — semantic query layer, then reworked for rerank-service integration (3 commits)

## Core lib — compliance
- A `src/lib/compliance/assess.ts`
- A `src/lib/compliance/create-check.ts`
- A `src/lib/compliance/discover.ts`

## Core lib — predictive risk
- M `src/lib/predictive-risk/clients.ts` — HTTP risk signal wiring, then synthetic-signal liveliness pass (2 commits)
- M `src/lib/predictive-risk/engine.ts` — LLM-generated mitigations / lively synthetic signals (Slice 8)
- A `src/lib/predictive-risk/mitigations.ts`

## Core lib — model provider
- M `src/lib/model/provider.ts` — mock/gemini/nim provider split foundation, refined in Slice 1 (3 commits)

## Core lib — jobs / scheduling
- A `src/lib/jobs/scheduler.ts`
- M `src/lib/jobs/worker.ts` — heartbeat, risk/AIS polling, weather status transitions, backfill worker, retrieval-service wiring (multiple changes across the branch)

## Core lib — supply / alerts / other
- A `src/lib/supply/ais-client.ts`
- A `src/lib/supply/weather-client.ts`
- M `src/lib/alerts/write-alert.ts` — hardening fixes alongside compliance verdict work (Slice 6)
- M `src/lib/cx/acceptance.ts` — cx records in turnover manifest (Slice 12)
- M `src/lib/dashboard-data.ts` — command center cross-links (Slice 10)
- M `src/lib/demo.ts` — test/fix pass (`f5c8332`)
- M `src/lib/env.ts` — new env vars for polling/weather/semantic-query/model-provider/rate-limit features (multiple changes across the branch)
- M `src/lib/graph/entities.ts` — graph node expansion endpoint support, then test/fix pass
- M `src/lib/ingestion/proposals.ts` — backfill worker added
- M `src/lib/readiness/gate-context.ts` — gate view read-only schedule context (Slice 13)
- M `src/lib/redis/rate-limit.ts` — rate limits / offline hardening (Slice 15)

## API routes (`src/app/api/*`)
- A `src/app/api/projects/[projectId]/compliance/scan/route.ts`
- A `src/app/api/projects/[projectId]/graph/nodes/[nodeId]/route.ts`
- A `src/app/api/projects/[projectId]/knowledge/rfi-similar/route.ts`
- M `src/app/api/document-versions/[versionId]/assess-change/route.ts` — change blast-radius impact list (Slice 14)
- M `src/app/api/health/route.ts` — heartbeat, then retrieval-service check added
- M `src/app/api/projects/[projectId]/compliance/checks/route.ts` — rate limiting + semantic candidate discovery
- M `src/app/api/projects/[projectId]/knowledge/query/route.ts` — semantic query layer, rate limiting, plan/synthesis pipeline
- M `src/app/api/projects/[projectId]/schedule/live-events/route.ts` — live events tab, then test/fix pass
- M `src/app/api/projects/[projectId]/turnover-packs/route.ts` — cx records in turnover manifest (Slice 12)

## UI components & pages
- M `src/app/command-center/page.tsx` — command center cross-links (Slice 10)
- M `src/app/readiness/page.tsx` — gate view read-only schedule context (Slice 13)
- M `src/app/schedule/page.tsx` — live events tab, then test/fix pass
- M `src/components/actions-workbench.tsx` — command center cross-links (Slice 10)
- M `src/components/change-assessment-list.tsx` — change blast-radius impact list (Slice 14)
- M `src/components/compliance-workbench.tsx` — review-queue UI (Slice 7)
- M `src/components/connection-status.tsx` — live events tab (Slice 11)
- M `src/components/feature-shell.tsx` — live events tab (Slice 11)
- M `src/components/gate-decision-form.tsx` — gate view read-only schedule context (Slice 13)
- M `src/components/graph-workbench.tsx` — graph node expansion endpoint, then test/fix pass
- M `src/components/knowledge-search.tsx` — RFI similarity retrieval, then citation-chip UI (Slice 4)
- M `src/components/predictive-risk-workbench.tsx` — live events tab, then test/fix pass
- M `src/components/shipment-map.tsx` — AIS position polling

## Verification scripts (`scripts/verify-*.ts` and related)
- A `scripts/verify-change-impact-http.ts`
- A `scripts/verify-command-links-http.ts`
- A `scripts/verify-compliance-llm-http.ts`
- A `scripts/verify-compliance-scan-http.ts`
- A `scripts/verify-gate-context-http.ts`
- A `scripts/verify-graph-expansion-http.ts`
- A `scripts/verify-hardening-http.ts`
- A `scripts/verify-knowledge-embed.ts`
- A `scripts/verify-knowledge-http.ts`
- A `scripts/verify-knowledge-query-http.ts`
- A `scripts/verify-knowledge-rerank-http.ts`
- A `scripts/verify-knowledge-synthesis-http.ts`
- A `scripts/verify-live-events-http.ts`
- A `scripts/verify-model-provider.ts`
- A `scripts/verify-poll-http.ts`
- A `scripts/verify-polling-http.ts`
- A `scripts/verify-retrieval-service.ts`
- A `scripts/verify-rfi-similar-http.ts`
- A `scripts/verify-risk-autopoll-http.ts`
- A `scripts/verify-risk-http-clients.ts`
- A `scripts/verify-risk-mitigations-http.ts`
- A `scripts/verify-supply-poll-http.ts`
- A `scripts/verify-turnover-cx-http.ts`
- A `scripts/verify-weather-poll-http.ts`
- A `scripts/reindex-embeddings.ts`
- M `scripts/verify-all.ts` — verification matrix extended across nearly every slice (19 commits in phase 1, 5 in phase 2)
- M `scripts/verify-audit-chain.ts` — test/fix pass (`f5c8332`)
- M `scripts/verify-compliance-http.ts` — LLM-owned compliance verdict + hardening (Slice 6)
- M `scripts/verify-evidence-turnover-http.ts` — test/fix pass (`f5c8332`)
- M `scripts/verify-phase0.ts` — test/fix pass (`f5c8332`)
- M `scripts/verify-risk-http.ts` — model provider foundation, then lively synthetic risk signals (Slice 8)
- M `scripts/verify-schedule-http.ts` — test/fix pass, then compliance verdict hardening
- M `scripts/seed.ts` — seeding, then test/fix pass
- M `scripts/worker.ts` — heartbeat added

## Planning docs (new)
- A `PLANNER/agentFixingPlan.md`
- A `PLANNER/completion_Plan.md`

## Config / docs / infra
- M `.env.example` — model provider + semantic query env vars
- M `.gitignore` — seeding / heartbeat additions
- M `README.md` — docs updated across "ready to fix agents" and Slice 9 wiring/docs commits *(not modified by this task; listed for reference only)*
- M `docker-compose.yml` — retrieval service added (Slice 1)
- M `package-lock.json` — model provider foundation (Slice 0)
- M `package.json` — dependency churn across nearly every slice (19 commits in phase 1, 5 in phase 2)

## Files touched in both branch phases (check carefully on merge)
- `README.md` — docs revised pre-Slice-0 ("ready to fix agents") and again in Slice 9 wiring/docs
- `drizzle/meta/_journal.json` — migration journal updated across backfill/testing work and again for retrieval-service + compliance-verdict migrations
- `package.json` — dependency changes throughout phase 1 (19 commits) and phase 2 (5 commits)
- `scripts/verify-all.ts` — verification matrix grown throughout phase 1 (19 commits) and phase 2 (5 commits)
- `scripts/verify-risk-http.ts` — model provider foundation (phase 1) then lively synthetic risk signals (Slice 8, phase 2)
- `scripts/verify-schedule-http.ts` — test/fix pass (phase 1) then compliance verdict hardening (Slice 6, phase 2)
- `src/app/api/health/route.ts` — heartbeat (phase 1) then retrieval-service health check (Slice 1, phase 2)
- `src/app/api/projects/[projectId]/compliance/checks/route.ts` — rate limiting (phase 1) then semantic candidate discovery (Slice 5, phase 2)
- `src/app/api/projects/[projectId]/knowledge/query/route.ts` — semantic query layer + rate limiting (phase 1) then plan/synthesis pipeline (Slice 3, phase 2)
- `src/components/knowledge-search.tsx` — RFI similarity retrieval (phase 1) then citation-chip UI (Slice 4, phase 2)
- `src/lib/db/schema.ts` — backfill/testing schema changes (phase 1) then retrieval-service + compliance-verdict columns (phase 2)
- `src/lib/jobs/worker.ts` — heartbeat/polling/backfill worker (phase 1) then retrieval-service + semantic candidate discovery wiring (phase 2)
- `src/lib/knowledge/query.ts` — semantic query layer (phase 1) then rerank-service integration (Slice 1/2, phase 2)
- `src/lib/model/provider.ts` — backfill worker + Slice 0 foundation (phase 1) then retrieval-service refinement (Slice 1, phase 2)
- `src/lib/predictive-risk/clients.ts` — weather/HTTP risk signal wiring (phase 1) then synthetic risk signals (Slice 8, phase 2)
