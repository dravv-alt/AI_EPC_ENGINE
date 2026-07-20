# PlanBoard Tracker

| File | Status | Notes |
|---|---|---|
| FoundationBuildPlan.md | ✅ Complete | All 10 foundation deliverables are implemented and locally verified. Migrations apply cleanly (16 migrations, `0000` through `0015_slice_8_9_teachback_and_rfi_resolution`); credentials/TOTP auth is the verified default and Clerk remains an optional adapter behind `AUTH_MODE`. |
| CanonicalBuildPlan.md | ✅ Approved implementation baseline | Reconciles all planning documents, including Bhavik's Cx and Supply Chain specifications. It is the single build contract for scope, authority boundaries, architecture, schema interpretation, feature sequence, and contradictions. |
| StructuredPlan.md | ✅ Approved | 2 remaining agents integrated (Commissioning QA Copilot + Supply Chain Visibility & Risk); stack override + Divergence Note added; supply-chain exclusion flipped to single-leg committed; orchestrator event contract recorded as emerging. Approved by user. Minor consistency edit: kind→event_type terminology (2 spots). |
| PRD.md | ✅ Approved | Approved by user incl. Agent Suite section, US-01–US-31, all 5 agents' features/constraints/edge cases. |
| TRD.md | ✅ Approved | Approved by user. Local (no-Cloudflare) stack + 3 propagated agents + 4-event contract + Command Center US-31. |
| Schema.md | ✅ Approved | Approved by user. Added compliance_checks, schedule_risks, risk_signal_readings, knowledge_chunks (pgvector), alerts (US-31); predicted_risk_delay enum; local Postgres/pgvector/tsvector/object store. |
| DesignDecisions.md | ✅ Approved | Approved by user. ADR-019–022 added (Compliance, Predictive Risk, RFI, Command Center); foundational ADRs 001–014 + Decisions Log de-Cloudflared to local stack; ADR-004 vector search now user-facing pgvector. |
| AppFlow.md | ✅ Approved | Approved by user. Added Compliance, Predictive Risk, RFI/Knowledge, Project Graph/Timeline, and Command Center flows; 4-event contract; fully local phrasing; navigation map extended. |
| Rules.md | ✅ Approved | Approved by user. Fully de-Cloudflared to local stack; coding/pattern/AI-behaviour/security rules for the 3 native agents; 4-event contract; deterministic-ownership + advisory-only boundary preserved. |
| Features.md | ✅ Approved | Approved by user. Frontend context doc: all TRD endpoints, screen specs, event-contract UI semantics. |
| ImplementationPlan.md | ✅ Approved | Index/pointer doc: stack override summary + 2-dev seam + branch workflow; links to the two per-dev files below. Awaiting user approval. Approved by user. |
| ImplementationPlan_Dev1.md | ✅ Approved | Dev 1 plan (evidence control plane + Spec-Compliance + RFI/Knowledge + TEST_FAILED consumer): shared Phase 0 (B0-01…06) + 14 B1 tasks + full IC-1…IC-4 checkpoint defs. Approved by user. |
| ImplementationPlan_Dev2.md | ✅ Approved | Dev 2 plan (schedule module + CP-SAT solver + Cx QA & Supply Chain agent-services + Predictive Risk worker + Command Center): 15 B2 tasks + IC reference table; prerequisite = Dev 1 Phase 0 frozen. Approved by user. |
| RetrievalArchitecture.md | ✅ Implemented | Controlled-source retrieval contract. The full path is now built: pgvector embeddings, cross-encoder reranking via `services/retrieval`, mandatory-first metadata filters enforced in SQL, and graph-context expansion. |
| Phase3Phase4Verification.md | ✅ Superseded | Its "not claimed complete" list is now fully built and verified. [STATUS.md](../STATUS.md) is the live verification ledger; this file remains the Phase 3/4 scenario matrix. |
| agentFixingPlan.md | ✅ Complete | Remediation for the three retrieval-backed agents (compliance, predictive risk, knowledge/RFI). All slices landed and verified. |
| final_fix_plans.md | ✅ Complete | The 10-slice hardening sequence (config targets, solver resilience, rate limits, finding owner/due-date, overdue blockers, turnover provenance, evidence entropy, generalized teach-back, RFI resolution state, knowledge metadata filters). All 10 landed and wired into `verify:all`. |
| completion_Plan.md | ✅ Complete | Completion pass tracked to close. Remaining open scope is production hardening only — see [STATUS.md](../STATUS.md). |
