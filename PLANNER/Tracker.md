# PlanBoard Tracker

| File | Status | Notes |
|---|---|---|
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
