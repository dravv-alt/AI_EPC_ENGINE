# Capabilities

## What it is

**Pramana Cx** — an evidence control plane for EPC commissioning. Next.js app plus three Python sidecars (PyMuPDF ingestion, OR-Tools CP-SAT solver, sentence-transformers embed/rerank), PostgreSQL + pgvector, Redis/BullMQ workers. ~21 UI surfaces, 75 API routes.

**Core stance:** AI is advisory only. AI extracts, retrieves, ranks, drafts. Deterministic code computes readiness, schedules, and test verdicts. Only a human accepts anything.

## Capabilities

| Area | What it does |
| --- | --- |
| **Controlled sources** | Hash-locked PDF upload, page/bbox region extraction, exact citations, revision blast-radius |
| **Requirements** | AI proposes → human accepts/edits/rejects |
| **Facility model** | Systems, assets, gates, typed provenance graph |
| **Evidence** | Capture (incl. encrypted offline PWA), pending→accepted review, immutable objects |
| **Cx workflow** | Cited checklists, deterministic numeric/boolean verdicts, narrative → human, approved immutable report |
| **Compliance** | Semantic deviation scan + exact-citation comparison → proposed findings only |
| **Scheduling** | Reviewed inputs → CP-SAT solve → immutable versions, diffs, warm-start re-solve, `SOLVE_FAILED` degradation |
| **Predictive risk** | Procurement/lead-time/workforce/weather polls → material advisory delays + LLM mitigations. Never edits dates |
| **Knowledge/RFI** | Metadata-filtered retrieval → rerank → plan-then-synthesize with enforced groundedness + citation chips |
| **Readiness & gates** | Deterministic recompute; approval needs permission + reason + fresh TOTP |
| **Turnover** | Approved-gate-only hashed manifest, independently verifiable |
| **Cross-cutting** | Hash-chain audit, project RBAC, rate limits, teach-back (learns from reviewer corrections), evidence-entropy weak-proof score |

## Mock user flow

1. **Log in** → TOTP → pick project
2. **Sources** → upload spec PDF → system hashes + extracts regions
3. **Requirements** → AI proposes 12 → engineer accepts 9, edits 2, rejects 1 *(edits/rejects captured as teach-back)*
4. **Systems** → create "Chilled Water Loop", attach assets, define Gate G3
5. **Evidence** → field tech captures readings offline → syncs → reviewer accepts as proof
6. **Cx** → run cited checklist → numeric steps auto-verdict → report approved → becomes immutable evidence
7. **Compliance** → scan submittals → 3 candidate deviations → engineer accepts 1 → finding with owner + due date
8. **Schedule** → validate dependencies → CP-SAT solve → baseline v4
9. **Risk** → poll flags 9-day valve lead-time slip → advisory alert + mitigation proposals → engineer reviews
10. **Actions** → owner works the finding: assigned → in-progress → resolved
11. **Knowledge** → "why did we reject the flange spec?" → cited answer from prior RFIs
12. **Readiness** → G3 recomputes to ready → approve with reason + fresh TOTP
13. **Turnover** → generate hashed pack → verify independently

**Supporting views:** Graph (how records connect), Changes (what a revision invalidated), Command Center (alerts), Shipments (map + legs), Settings.

## Maturity

- **Verified end-to-end:** platform, sources, evidence→turnover, scheduling, Cx, compliance, risk, knowledge, audit
- **Partial:** Command Center depth, production hardening (CI, accessibility, observability, load)

See [STATUS.md](STATUS.md) for the detailed verification ledger.
