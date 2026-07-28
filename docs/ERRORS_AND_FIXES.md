# Reported errors and implemented fixes

This ledger records the July 2026 QA findings, their root causes, the applied
fixes, and the verification expected after checkout.

| Area | Reported behaviour | Root cause | Implemented fix |
| --- | --- | --- | --- |
| Clerk access | A valid Google sign-in opened “Project access is pending.” | Clerk identity existed but no matching local project membership was linked. | Added persisted Clerk user linking by verified email, a clear pending-access route, and seeded intentional development memberships. |
| Gate authenticator | An authenticator-code field appeared even though TOTP was disabled. | Credentials-mode TOTP controls leaked into a configuration where the identity provider owned MFA. | Gate controls now explain provider-managed MFA and only require a fresh local TOTP challenge in credentials mode. |
| Header controls | Search, notification, help, and View brief looked clickable but did nothing. | Placeholder buttons and a form that did not preserve the query contract. | Added real links, project search navigation to `/knowledge?q=…`, and dedicated Help and Brief pages. |
| Knowledge | Queries returned no visible results or citations. | Query routing, sparse lexical fallback, and missing source-region affordances made seeded content appear static. | Added deterministic controlled-text fallback, query preservation, explicit result states, citation links, and source-region navigation. |
| Sources | Source rows and cited-region counts could not be opened. | Counts were display-only. | Added expandable source/version rows with direct source-region links. |
| Requirement proposal | Icons and bullets were visually broken. | Proposal text had no structured icon/text layout. | Added a dedicated requirement statement layout with aligned semantic iconography. |
| Actions | The create-finding form was cramped and misaligned. | Six controls were forced into one rigid row. | Reworked the form grid, spacing, responsive breakpoints, and action placement. |
| Cx tests | Gate selection and long checklist/report controls were difficult to use. | Select data and action layout did not degrade well with seeded content. | Corrected gate options, control layout, deterministic reading actions, and report workflow feedback. |
| Graph | Authority graph and audit timeline created an extremely long page without usable scrolling. | Lists expanded with page height. | Added bounded scroll regions and preserved search/selection context. |
| Changes | Blast-radius assessment always asked for a previous controlled version. | Seed data contained only the current version and could not demonstrate comparison. | Added a superseded controlled revision, source region, requirement, and provenance edges to the idempotent seed. |
| Turnover | Approved-gate selector was empty, so an immutable pack could not be created. | No qualifying approved gate existed and the empty state was unexplained. | Added explicit qualification messaging and blocked generation until a real approved gate is available. |
| Dashboard | Metrics were sparse and visually static. | The overview exposed only three cards and no compact operational projection. | Added database-derived rings, bars, audit activity, shipment/schedule pulse, animated loading, and direct workflow links. |
| Shipment route | A sea route crossed Pakistan and India by road. | An offshore vessel was sent to OSRM because a sparse port catalogue selected Mumbai as its nearest known port. | In-transit sea positions now bypass road-to-port routing, destination waypoints are ordered correctly, and marine routing fails closed rather than drawing an air line. |
| Weather map | Weather was almost invisible and looked identical to the route map. | Both tabs used the same basemap and clear samples were tiny circles. | Added a distinct dark weather map, larger condition zones, WMO-derived states, peak wind/rain, observation time, and an expanded legend. |
| Backend authority | It was unclear whether controls persisted or only changed React state. | There was no cross-feature write/read propagation ledger. | Added `BACKEND_AUTHORITY_AUDIT.md`, identifying authoritative database mutations, downstream consumers, presentation-only state, and verification coverage. |

## Verification

Run:

```bash
npm run typecheck
npm run build
npm run verify:all
```

For a real local model and Clerk-enabled browser pass, also run:

```bash
npm run verify:ollama
clerk doctor
```

Then verify sign-in, project access, Knowledge citations, source-region links,
Cx readings/report approval, Changes blast radius, graph scrolling, approved
gate turnover qualification, and both shipment map tabs.
