# Backend authority and propagation audit

This document records which Pramana Cx interactions are authoritative, which are advisory, and which are intentionally browser-local. A control must not imply that project authority changed unless a server route persisted the change.

## Authority rules

- **Authoritative:** written to PostgreSQL and, where required, appended to the canonical audit chain.
- **Propagated:** the persisted mutation is consumed by readiness, graph, schedule, command center, turnover, or another downstream surface.
- **Advisory:** computed and displayed, but explicitly cannot approve, certify, or change controlled dates without review.
- **Local-only:** device UI state or encrypted offline queue state. It never counts toward readiness until synchronized.

## Surface matrix

| Surface | User mutation | Primary persisted records | Downstream consumers | Verification |
|---|---|---|---|---|
| Sources | Upload source/revision | `documents`, `document_versions`, `storage_objects`, `source_regions` | Requirements, Knowledge, Cx, Changes, Turnover | ingestion formats, knowledge, change impact, turnover provenance |
| Requirements | Accept/edit/reject/duplicate | `requirements`, review attribution, audit event | Readiness, Graph, Compliance, Cx context | evidence-to-turnover, graph, gate context |
| Systems | Create system/asset/gate | `systems`, `assets`, `gates` | Cx selectors, Readiness, Shipments, Graph | relational integrity and scope checks |
| Evidence | Capture/review/link | `evidence`, `edges`, audit event | Readiness, Graph, Turnover, Command Center | evidence-to-turnover, entropy, audit chain |
| Field capture | Queue and synchronize | encrypted IndexedDB before sync; `storage_objects` + `evidence` after sync | Evidence review, then Readiness/Graph | hardening and evidence integration |
| Readiness | Recompute and decide gate | deterministic evaluation; `decisions` + gate status on authorized decision | Dashboard, Turnover, Schedule context | gate context, evidence-to-turnover |
| Actions | Create/start/resolve finding | `findings` with optimistic versioning and audit event | Readiness blockers, Dashboard, Command Center | overdue findings, compliance finding fields |
| Cx tests | Draft/review/record/report/approve | checklists, steps, citations, test records, readings, findings, report artifact, evidence | Actions, Readiness, Graph, Turnover | governed Cx, turnover Cx, teach-back |
| Schedule | Propose/review tasks/resources; dependencies; solve | schedule tables, immutable schedule versions, audit events | Readiness context, Shipments, Risks, Turnover | deterministic schedule, solver resilience, provenance |
| Shipments | Register/import/update/deliver | `shipments`, graph edges, audit events | Schedule events, Alerts, Dashboard, Graph | supply poll, weather transition, live events, polling E2E |
| Compliance | Scan/compare/review/precedent | checks, precedents, findings, audit events | Actions, Readiness, future scans | governed compliance, modality, LLM verdict, precedent tests |
| Knowledge | Query and RFI similarity | query is read-only; controlled source/index records are authoritative | Citation links, Graph expansion | query, rerank, synthesis, filters, RFI lifecycle |
| Graph | Create relationship | `edges` + audit event | Readiness, Changes, node expansion, Turnover context | graph expansion, data integrity |
| Command center | Alert lifecycle/navigation | `alerts`; links resolve against live project rows | Actions, Readiness, Shipments, Schedule | command links, polling E2E |
| Changes | Assess revision | change assessment records/findings derived from two controlled versions | Actions, Graph, source revision history | change impact |
| Turnover | Generate pack | `turnover_packs`, signed object, immutable manifest hash | Pack verification/export | turnover verification and provenance |
| Profile/settings | Identity, MFA, sessions, policy/member/project changes | auth, user, membership and project tables | Authorization on every backend operation | credentials/MFA, rate-limit and scope tests |

## Explicitly non-authoritative interactions

- Map tab selection, zoom, pan, chart animation, graph pan/zoom, and form drafts are presentation state.
- Knowledge answers and predictive mitigations are advisory. They do not write controlled conclusions or dates.
- Offline field captures remain encrypted device records until the synchronization endpoint accepts them.
- Live route/weather map refreshes are observations. Automatic shipment workers or an explicit assessment persist material ETA/status changes.
- “View”, “compare”, “search”, “expand”, and citation navigation controls are read-only by design.

## Audit corrections made

1. DB-backed Command Center is now explicitly dynamic and no longer attempts user provisioning during a clean production build.
2. Offline capture no longer silently falls back to plaintext when Web Crypto is unavailable; it fails without saving.
3. Schedule dependency creation now appends a canonical audit event.
4. Project creation now appends the initial project audit event.
5. Shipment route and weather overlays now use live project data, and the automatic worker chain persists material position/weather/status transitions.
6. The solver-resilience verification now removes dependent schedule-risk rows before their source signals, keeping repeated isolated runs clean.
7. In-transit sea positions no longer enter OSRM through a distant catalogued port. The remaining route starts from the stored vessel fix, uses nautical routing, orders destination port waypoints toward land, and fails closed when no verified marine route exists.
8. The Weather map remains observational: Open-Meteo waypoint samples are visibly distinct from the route map, while only the explicit assessment/worker command persists a material delay, status transition, audit event, alert, and downstream schedule event.

## Dashboard authority

The dashboard is a server-rendered projection of current project records, not a separate cache or hardcoded reporting model. Its metric cards, gate bars, evidence/requirement rings, finding-severity bars, shipment/schedule pulse, seven-day audit chart, and recent-authority trail are derived from PostgreSQL on each request. Motion is presentation-only and replays when the dashboard mounts; direct controls link into the authoritative workflows that own each mutation.

## Required production services

- PostgreSQL is the project authority.
- Redis + the core worker are required for queued extraction, checklist/report generation, schedule solving, and recurring risk/supply polling.
- Object storage is required for controlled source and immutable artifact bytes.
- Live AIS requires `AIS_MODE=aisstream` and valid AISStream credentials. Without it, position provenance is explicitly simulated.
- Live marine weather uses `WEATHER_MODE=open-meteo`; failed providers remain unavailable rather than being mislabeled as live.

## Verification command

Run `npm run verify:all` against an isolated migrated database. This exercises production build, credentials/MFA, persistence, audit chain, graph scope, readiness, Cx, compliance, schedule, shipment polling, knowledge, turnover, storage/rate limits, and cross-feature E2E propagation.

The full isolated matrix passed on 28 July 2026, including the MinIO/S3 byte round-trip and the end-to-end shipment/weather/alert/schedule/risk and Knowledge retrieval chains.
