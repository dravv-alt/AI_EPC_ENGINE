# Phase 3 / Phase 4 local verification matrix

The test fixture is synthetic only. `Mumbai DC-07` is the authorized project; `Isolated DC-01` is intentionally not assigned to the development user and is used to prove authorization denial.

| Scenario | Expected result | Local check |
|---|---|---|
| Draft Cx checklist | Draft cannot execute until engineer accepts | `POST /api/projects/:id/cx/checklists`, then reading returns `409` before review. |
| Deterministic failed Cx numeric step | `proposed_fail` creates one finding, blocks the gate, and creates one `TEST_FAILED` alert | Create/review checklist, post an out-of-tolerance flow reading; assert finding count, gate `blocked`, active alert. |
| Narrative Cx step | `needs_human_review`; no `TEST_FAILED` | Post a text reading to a narrative step and assert its verdict. |
| Compliance boundary | Proposed requirements reject compliance checks; accepted requirements may be checked; narrative never auto-flags | Review requirement, call compliance endpoint, assert source-region citations in response. |
| Scoped knowledge | Only project source regions are returned and each claim carries source-region/version/hash | Query `/knowledge/query`; assert every claim has all three identifiers. |
| Shipment risk | Delayed shipment gets deterministic red/amber status, a simulated/estimate label, and one active alert | Create congested late shipment; assert status and alert. |
| Cross-project authorization | Development user receives `403` for the isolated project | GET isolated project overview. |
| Audit integrity | All canonical-v2 audit events form a valid hash chain | `npm run verify:audit`. |
| Build quality | TypeScript and production build are clean | `npm run typecheck && npm run build`. |

## Status of the previously-deferred scope

Everything this section formerly listed as not-yet-implemented has since been built and is covered by the local verification matrix:

| Formerly deferred | Now |
|---|---|
| Schedule / CP-SAT pipeline | Built — reviewed inputs, dependency validation, CP-SAT solve, immutable versions, warm-start re-solve, bounded timeout + retry degrading to `SOLVE_FAILED` (`verify:schedule-http`, `verify:solver-resilience`) |
| Background jobs | Built — BullMQ + `durable_jobs`, recurring poll registered as repeatable jobs in `src/lib/jobs/scheduler.ts` (`verify:polling-http`, `verify:risk-autopoll-http`) |
| Weather / external signal polling | Built — swappable procurement, lead-time, workforce, and weather clients; all four source outcomes recorded, including explicit data-unavailable (`verify:weather-poll-http`, `verify:risk-http-clients`) |
| pgvector embeddings | Built — `knowledge_chunks` embeddings via the `services/retrieval` embed/rerank service (`verify:knowledge-embed`, `verify:knowledge-rerank`) |
| RFI similarity | Built — scoped similarity restricted to `resolutionState = resolved` (`verify:rfi-similar-http`, `verify:rfi-resolution`) |
| Grounded standards / precedent lookup | Built — code-enforced groundedness filter plus exact-citation `compliance_precedents` (`verify:compliance-llm-http`, `verify:knowledge-synthesis`) |
| Phase 3 frontend surfaces | Built — compliance review queue, knowledge citation chips, graph explorer, Command Center, schedule/risk boards |

AIS vessel tracking is behind a swappable client (`src/lib/supply/ais-client.ts`): a real `aisstream.io` WebSocket driver is opt-in via `AIS_MODE=aisstream` plus an API key, and a synthetic great-circle driver is the offline default. Every position carries an explicit `live` vs. `simulated` label through to the UI, so a seeded position is never presented as a real one.

See [STATUS.md](../STATUS.md) for the authoritative, continuously-updated verification ledger.
