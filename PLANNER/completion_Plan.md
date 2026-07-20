# Implementation Plan

> **Status: complete.** Every slice below has landed and is covered by `npm run verify:all`. Retained as the historical record of the completion pass — see [../STATUS.md](../STATUS.md) for current status.
>
> Completion roadmap taking Pramana Cx from its then-current status to a fully working system. Each slice is vertical and independently deliverable. Slices are ordered so that infrastructure a later slice needs is delivered by an earlier one. Areas already complete at the time of writing were out of scope and appear only where a later slice wires into them. (The `remaining_work.md` gap list this plan was written against has since been removed — every gap it tracked is closed, and STATUS.md is now the single source of truth for open work.)

---

## Slice 1: Recurring poll infrastructure runs and is observable

### What this delivers
A BullMQ repeatable job registered at worker startup fires on an interval and writes a heartbeat row, so an operator can confirm automatic polling is alive without triggering anything by hand.

### Depends on
none

### Touches
- `src/lib/jobs/scheduler.ts` (new) — registers `repeatable` jobs via `getQueue(...).add(name, {}, { repeat: { every: N } })` reading interval from env
- `src/lib/jobs/worker.ts` — add a `poll.heartbeat` handler that records last-run timestamp
- `scripts/worker.ts` — call the scheduler registration on startup
- `src/lib/env.ts` — add `POLL_INTERVAL_MS` (and per-poll toggles)
- `src/app/api/health/route.ts` — surface last heartbeat time so the poll loop is observable

---

## Slice 2: Predictive risk engine polls every project automatically

### What this delivers
Without any manual API call, the risk engine re-polls active projects on the recurring interval and any newly material risk appears as an advisory alert.

### Depends on
Slice 1

### Touches
- `src/lib/jobs/scheduler.ts` — register `risk.poll.all` repeatable job
- `src/lib/jobs/worker.ts` — add `risk.poll.all` handler that enumerates active projects and enqueues per-project `risk.poll` jobs (existing `pollProjectRisks`)
- `src/lib/predictive-risk/engine.ts` — reuse existing on-demand poll path
- `src/app/api/projects/[projectId]/schedule/risks/route.ts` — already reads risks (verify surfaced)

---

## Slice 3: Live AIS position polling updates shipment coordinates

### What this delivers
A shipment with an MMSI has its `currentLat`/`currentLng` and `lastPolledAt` updated from a live AIS source (aisstream.io) on the recurring poll, and the map reflects the real position instead of a static point.

### Depends on
Slice 1

### Touches
- `src/lib/supply/ais-client.ts` (new) — swappable AIS client behind an interface; aisstream.io WebSocket/HTTP driver + synthetic fallback selected by env
- `src/lib/env.ts` — add `AIS_MODE`, `AISSTREAM_API_KEY`
- `src/lib/jobs/worker.ts` — add `supply.poll` handler that fetches positions for shipments with `mmsi`, updates `shipments.currentLat/currentLng/lastPolledAt/positionSource`
- `src/lib/jobs/scheduler.ts` — register `supply.poll` repeatable job
- `src/components/shipment-map.tsx` — render `positionSource` badge

---

## Slice 4: Live weather polling drives shipment status transitions

### What this delivers
On each poll, real forecast data (Open-Meteo) recomputes `weatherDelayFactor` and `weatherAdjustedEta`; when a shipment crosses green→amber→red it emits `SHIPMENT_DELAYED`, and on recovery emits `SHIPMENT_RECOVERED` — all without manual API calls.

### Depends on
Slice 3

### Touches
- `src/lib/supply/weather-client.ts` (new) — Open-Meteo HTTP driver behind swappable interface; synthetic fallback by env
- `src/lib/env.ts` — add `WEATHER_MODE`, `OPEN_METEO_BASE_URL`
- `src/lib/supply/status.ts` — consume live `weatherDelayFactor` from client instead of seed field
- `src/lib/jobs/worker.ts` — `supply.poll` handler recomputes status, persists new status, and on transition calls existing event path (`processScheduleEvent` / `raiseAlert`)
- `src/lib/events/process.ts` — reuse existing `SHIPMENT_DELAYED`/`SHIPMENT_RECOVERED` fan-out

---

## Slice 5: Real external risk signal clients behind the swappable interface

### What this delivers
When `RISK_POLL_MODE=http`, procurement/lead-time/workforce/weather risk signals come from real configured HTTP endpoints (weather reusing the Open-Meteo client), and the risk engine acts on live observations.

### Depends on
Slice 2, Slice 4

### Touches
- `src/lib/predictive-risk/clients.ts` — replace synthetic-only default; wire `HttpSignalClient` endpoints and route `weather_forecast` through the Open-Meteo client from Slice 4
- `src/lib/env.ts` — existing `RISK_*_URL` keys; validate presence when mode is http
- `src/lib/predictive-risk/engine.ts` — no logic change, consumes real observations

---

## Slice 6: pgvector embedding column and backfill worker

### What this delivers
`knowledge_chunks` gains an `embedding` vector column with an ivfflat index, and a worker computes embeddings for every existing and newly ingested chunk, so the vector index is populated and queryable.

### Depends on
none

### Touches
- `src/lib/db/schema.ts` — add `embedding` vector column to `knowledgeChunks`; ivfflat index
- `drizzle/` — new migration enabling `pgvector` extension + column + index
- `src/lib/model/provider.ts` — add `embed(text): Promise<number[]>` to `ModelProvider`, `MockModelProvider` (deterministic), and `GeminiModelProvider`
- `src/lib/jobs/worker.ts` — add `knowledge.embed` handler that backfills chunk embeddings
- `src/lib/ingestion/proposals.ts` — enqueue `knowledge.embed` when chunks are created

---

## Slice 7: Semantic knowledge query with metadata-filter-first retrieval

### What this delivers
The `/knowledge` page returns semantically retrieved citations: the query is embedded, a mandatory SQL metadata filter (project + documentType) runs first, then pgvector cosine similarity ranks results above a threshold — replacing the keyword-only scoring.

### Depends on
Slice 6

### Touches
- `src/lib/knowledge/query.ts` — replace token scoring with embed-query + cosine similarity helper
- `src/app/api/projects/[projectId]/knowledge/query/route.ts` — metadata-filter-first SQL against `knowledge_chunks`, then vector similarity ordering with threshold
- `src/lib/env.ts` — add `KNOWLEDGE_SIMILARITY_THRESHOLD`
- `src/components/knowledge-search.tsx` — display similarity score on citations

---

## Slice 8: RFI similarity retrieval suggests previously resolved RFIs

### What this delivers
When viewing or entering an RFI, the system returns "previously resolved similar RFI" suggestions by embedding the RFI text and doing a `documentType=rfi`-scoped cosine-threshold vector search.

### Depends on
Slice 7

### Touches
- `src/app/api/projects/[projectId]/knowledge/rfi-similar/route.ts` (new) — rfi-scoped vector search endpoint
- `src/lib/knowledge/query.ts` — reuse similarity helper with `documentType=rfi` scope
- `src/components/knowledge-search.tsx` (or new RFI panel) — surface suggested resolved RFIs

---

## Slice 9: Graph node expansion returns linked entities

### What this delivers
Clicking a node on `/graph` calls a node-expansion endpoint that returns its linked documents, supply records, and audit entries, so the user can traverse the evidence graph interactively.

### Depends on
none

### Touches
- `src/app/api/projects/[projectId]/graph/nodes/[nodeId]/route.ts` (new) — expansion query over graph edges
- `src/lib/graph/entities.ts` — expansion resolver (linked docs / supply / audits)
- `src/components/graph-workbench.tsx` — call expansion on node click and render neighbors

---

## Slice 10: Command Center cross-links wired end-to-end

### What this delivers
Every alert on the Command Center deep-links to its related record: `TEST_FAILED`→finding+gate (exists), `SHIPMENT_DELAYED`→affected schedule task+version, and `predicted_risk_delay`→task+mitigation — each verified to render in the UI.

### Depends on
Slice 2, Slice 4

### Touches
- `src/lib/dashboard-data.ts` — resolve cross-link targets for each alert type
- `src/app/command-center/page.tsx` — render deep-links
- `src/components/actions-workbench.tsx` — link rendering for shipment and risk alerts
- `src/app/api/projects/[projectId]/schedule/live-events/route.ts` — feed live polled signals into the view

---

## Slice 11: Live Events tab shows real-time polled signals

### What this delivers
A Live Events view on the schedule/risks page streams the most recent AIS, weather, and risk poll results with timestamps, so the demo shows automatic activity rather than only seeded records.

### Depends on
Slice 3, Slice 4, Slice 5

### Touches
- `src/app/api/projects/[projectId]/schedule/live-events/route.ts` — return recent poll observations
- `src/components/schedule-workbench.tsx` or `predictive-risk-workbench.tsx` — Live Events tab
- `src/components/connection-status.tsx` — poll-freshness indicator

---

## Slice 12: Cx report enters the turnover pack manifest

### What this delivers
Approved commissioning test records are included in the turnover pack export, so a generated turnover manifest lists Cx evidence alongside requirements and gate decisions.

### Depends on
none

### Touches
- `src/app/api/projects/[projectId]/turnover-packs/route.ts` — include approved Cx records
- `src/lib/cx/acceptance.ts` — expose approved-record selector for manifest
- turnover export job path in `src/lib/jobs/worker.ts`

---

## Slice 13: Gate view shows read-only schedule context

### What this delivers
On the readiness/gate view, tasks that `AFFECTS` a gate appear as read-only context, so a reviewer sees schedule impact when making a gate decision.

### Depends on
none

### Touches
- `src/lib/readiness/gate-context.ts` — resolve `AFFECTS`-edge tasks for a gate
- `src/app/api/projects/[projectId]/gates/[gateId]/readiness/route.ts` — include task context
- `src/components/gate-decision-form.tsx` — render read-only task context

---

## Slice 14: Change blast-radius impact list rendered

### What this delivers
The `/changes` page displays the full blast-radius traversal (SUPERSEDES/AFFECTS edges → stale evidence) as an impact list, so a user sees everything a document revision invalidates.

### Depends on
Slice 9

### Touches
- `src/app/api/document-versions/[versionId]/assess-change/route.ts` — return full impact list (verify depth)
- `src/components/change-assessment-list.tsx` — render impacted evidence/records
- `src/app/changes/page.tsx` — wire list display

---

## Slice 15: Rate limits and offline/storage hardening

### What this delivers
AI routes (knowledge-query, compliance-AI) are rate-limited, the offline field-capture queue is verified to reconcile queued→server-accepted, and the S3 driver is exercised against MinIO end-to-end.

### Depends on
Slice 7

### Touches
- `src/lib/redis/rate-limit.ts` — apply to `knowledge/query` and compliance AI routes
- `src/app/api/projects/[projectId]/knowledge/query/route.ts`, compliance check routes — enforce limit
- `src/lib/offline/capture-queue.ts` + `src/app/api/projects/[projectId]/field-captures/route.ts` — verify reconciliation path
- `src/lib/storage/service.ts` — exercise S3 driver against MinIO

---

## Slice 16: End-to-end verification and CI

### What this delivers
A new verification script exercises the full polling loop (AIS→weather→status transition→alert→cross-link) and knowledge semantic retrieval, and a GitHub Actions workflow runs `npm run verify:all` so the complete system is checked automatically.

### Depends on
Slice 1, Slice 2, Slice 3, Slice 4, Slice 5, Slice 6, Slice 7, Slice 8, Slice 9, Slice 10, Slice 11, Slice 12, Slice 13, Slice 14, Slice 15

### Touches
- `scripts/verify-polling-http.ts` (new) — drives auto-poll transitions and asserts alerts/cross-links
- `scripts/verify-knowledge-http.ts` (new) — asserts semantic retrieval + RFI similarity
- `scripts/verify-all.ts` — include new scripts
- `package.json` — add `verify:polling-http`, `verify:knowledge-http`
- `.github/workflows/verify.yml` (new) — run `npm run verify:all`
