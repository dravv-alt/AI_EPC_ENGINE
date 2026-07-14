# PlanBoard Tracker

| File | Status | Notes |
|---|---|---|
| StructuredPlan.md | ✅ Approved | Assumptions updated after grill session: no design partner yet, synthetic/dummy data for prototype, deployment profile deferred |
| PRD.md | ✅ Approved | Verified already fully merged with Proactive Schedule Management module (US-09–US-12, features, metrics, edge cases, constraints) — no changes needed |
| TRD.md | ✅ Approved | Merged schedule module: CP-SAT via dedicated solver microservice from Workflow step; Better Auth carried forward; re-solve p95 ≤30s w/ SOLVE_FAILED fallback |
| Schema.md | ✅ Approved | Added schedule_tasks/resources/schedule_versions/scheduled_tasks/schedule_events; dependencies reuse edges (PRECEDES); schedule never feeds readiness |
| DesignDecisions.md | ✅ Approved | ADRs added: solver microservice, GeminiModelProvider extraction w/ human-review gate, immutable schedule_version + delta-detector |
| AppFlow.md | 🔄 In Progress | appflow-agent was dispatched (parallel) — session paused by user before completion/approval; resume by checking this agent or re-dispatching |
| Rules.md | ✅ Approved | Added lib/scheduling purity rule, delta-detector gating + SOLVE_FAILED fallback, LLM never writes schedule tables directly |
| ImplementationPlan.md | ⏳ Pending | Blocked on Schema/DesignDecisions/AppFlow/Rules approval |
