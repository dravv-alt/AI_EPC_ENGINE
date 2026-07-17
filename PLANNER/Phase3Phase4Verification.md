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

## Explicitly not claimed complete yet

The current branch does **not** yet implement the full prior schedule/CP-SAT pipeline, live AIS/weather polling, background jobs, pgvector embeddings, RFI similarity, grounded standards/precedent lookup, or the dedicated frontend screens for every Phase 3 surface. Those are preconditions/dependencies named in the Phase 3 plan, not features that can be honestly marked verified from the current foundation.
