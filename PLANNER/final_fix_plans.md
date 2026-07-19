# Final Fix Plan — remaining committed work

Closes the gap between the grand plan (PRD / TRD / Rules / CanonicalBuildPlan / ADRs) and the
current code, for everything still outstanding after the agent remediation in
[agentFixingPlan.md](agentFixingPlan.md).

**Written for parallel AFK execution.** Every slice is a tracer bullet: a thin end-to-end path that
runs and is verifiable before the next thickens it. Each slice is one commit and ships a
`scripts/verify-*.ts` wired into `verify:all`. See [Dependencies](#dependencies-and-parallel-waves)
at the end for what can run concurrently.

**Out of scope** (already verified complete, do not touch): the Commissioning QA Copilot (Cx) and
the Supply Chain Visibility & Risk agent.

**Deliberately excluded** (confirmed intentional or accepted hackathon scope, not gaps): LLM-owned
compliance verdict; weather-outage synthetic fallback; Clerk approvers skipping TOTP freshness; the
"Better Auth" naming divergence; OCR/image + email-export ingestion; generic manual
approval/weather-delay event type; real procurement/lead-time/workforce vendor integrations;
Command Center grouping/filters; durable replayable orchestrator transport; CI, observability
(OTel/Sentry/structured logging), accessibility testing, retention enforcement, backup/restore,
load and failure-injection testing.

---

## Invariants that must survive every slice

1. **`verify:all` stays green offline** — `MODEL_PROVIDER=mock`, `EMBEDDING_PROVIDER=mock`, no
   containers, no API keys, no network.
2. **Nothing AI-authored becomes authoritative.** Everything new lands `reviewState: "proposed"` (or
   equivalent advisory state); a human promotes it.
3. **Advisory stays separate from readiness.** The entropy score in particular must never feed the
   readiness calculation (CanonicalBuildPlan Feature 21 says so explicitly).
4. **Existing verify scripts pass unmodified** unless a slice's own spec says otherwise. That is the
   regression guard for every slice here.

---

# Slice 1 — Named, overridable target constants

**Traces to:** TRD NFR table; PRD success metrics.

**Goal:** the accuracy/latency targets the plans name by identifier actually exist as configurable
values instead of being absent or inlined.

**Files:** `src/lib/config/targets.ts` (new), `src/lib/env.ts`, `.env.example`

### Work
- New module exporting the targets the plans name: `COMPLIANCE_DEVIATION_ACCURACY_TARGET`,
  `RISK_LEAD_TIME_TARGET`, `RFI_MATCH_ACCURACY_TARGET`, `HIGH_SEVERITY_PRECISION_TARGET`,
  `PACK_PREP_TIME_REDUCTION_TARGET`, plus `SOLVER_TIMEOUT_MS` (default 90_000, per Rules.md line 33)
  and `SOLVER_MAX_ATTEMPTS`.
- Each reads an optional env override through the existing `env.ts` Zod schema (add both the schema
  entry **and** the explicit `process.env` mapping — `env.ts` maps keys manually; a schema-only
  addition silently reads `undefined`), falling back to the documented default.
- These are targets/config, not enforcement. Nothing gates on them yet beyond the solver timeout in
  Slice 2 — the point is that they're named, discoverable, and overridable.

### Tracer
`SOLVER_TIMEOUT_MS` resolves to 90000 by default and to an override when the env var is set.

### Verify — `scripts/verify-config-targets.ts`
Pure unit check, no DB/network: every constant resolves to its documented default; an env override
is respected; an out-of-range override is rejected by the Zod schema rather than silently accepted.

---

# Slice 2 — Solver timeout, bounded retry, and `SOLVE_FAILED`

**Traces to:** Rules.md line 33 (hard rule); TRD "Solver timeout/fallback" NFR; ADR-009.

**Goal:** a hung or failing CP-SAT service degrades to an explicit, retryable failure state instead
of hanging a request or a transaction.

**Files:** `src/lib/schedule/solver.ts`, `src/lib/schedule/create-version.ts`,
`src/lib/events/process.ts`

### Work
- `solveSchedule()` currently issues a bare `fetch()` with no timeout. Add
  `AbortSignal.timeout(SOLVER_TIMEOUT_MS)` (from Slice 1, or an inline constant if Slice 1 hasn't
  landed — see dependency note) and a bounded, exponentially backed-off retry loop capped at
  `SOLVER_MAX_ATTEMPTS`.
- On exhausted attempts, fail into a defined `SOLVE_FAILED` outcome. **No migration needed** —
  `scheduleVersions.solverStatus` is already `varchar(30)`, so `"SOLVE_FAILED"` is just a new value.
- **The critical invariant, verbatim from Rules.md:** on failure the prior `schedule_version` and all
  task statuses remain completely untouched, and no partial or inconsistent version is ever
  persisted. Read `create-version.ts` carefully — `solveSchedule` is currently called *inside* a DB
  transaction, so a slow solver holds a transaction open. The fix is to move the solver call
  **outside** the transaction (solve first, then open a short transaction to persist), not merely to
  add a timeout inside it.
- Mark the triggering `schedule_events` row `SOLVE_FAILED` for manual retry (`processingStatus` is
  already a free `varchar(30)`), and write an audit event for the failure — Rules.md line 88 requires
  every `schedule_version` transition *including* `SOLVE_FAILED` to be reconstructible from the audit
  chain alone.

### Tracer
Point `SOLVER_SERVICE_URL` at a stub that sleeps past the timeout → the call aborts, retries the
bounded number of times, then records `SOLVE_FAILED` with the prior version intact.

### Verify — `scripts/verify-solver-resilience.ts`
Stand up a local `node:http` stub (same pattern as `verify-risk-http-clients.ts`): assert a
timeout aborts rather than hanging; retries are bounded and backed off; after exhaustion the prior
`schedule_version` row is byte-identical and no new version was inserted; the event is marked
`SOLVE_FAILED`; an audit event exists. Then assert a *recovering* stub (fails once, then succeeds)
produces a normal version — retry actually retries. `verify:schedule-http` must pass unmodified.

---

# Slice 3 — Rate-limit coverage across the endpoint categories the rules name

**Traces to:** Rules.md line 87; TRD Security section.

**Goal:** the limiter that already exists is applied everywhere the rules require, not just three
routes.

**Files:** `src/lib/redis/rate-limit.ts`, ~12 route files under `src/app/api/`

### Work
- `enforceAiRateLimit` currently guards only `compliance/checks`, `compliance/scan`, and
  `knowledge/query`. Rules.md names: auth, upload, search, AI, export, schedule, compliance, risk,
  and knowledge endpoints.
- Generalize the limiter into scope-aware helpers rather than reusing the AI-specific one everywhere
  — an upload limit and an AI limit want different budgets. Suggested: keep `enforceAiRateLimit`,
  add `enforceRateLimit(scope, limit, windowSeconds)` underneath it, and add per-category env-backed
  budgets alongside the existing `AI_RATE_LIMIT`.
- Apply to: `auth/login`, `auth/register`, `auth/totp/*`; `projects/[projectId]/sources` (upload);
  `schedule/baseline`, `schedule/events`, `schedule/versions`, `schedule/tasks`,
  `schedule/resources`, `schedule/risks`; `turnover-packs` (export); `knowledge/rfi-similar`.
- **Return retryable responses without leaking account or project existence** (Rules.md is explicit
  on this) — the auth endpoints especially must not let a rate-limit response distinguish a real
  account from a fake one.

### Tracer
Hammer one newly-limited endpoint past its budget → HTTP 429 with a retry hint, and the auth 429 is
byte-identical for a real vs. nonexistent account.

### Verify — `scripts/verify-rate-limit-coverage.ts`
Run against the low-limit hardening server `verify-all.ts` already stands up (`AI_RATE_LIMIT=5`).
For each newly-limited category, assert a real 429 after the budget; assert the auth 429 body/status
does not vary by account existence. `verify-hardening-http` must pass unmodified.

---

# Slice 4 — Compliance-generated findings carry owner and due date

**Traces to:** PRD US-24 ("creates a `findings` (NCR) record (owner, severity, due date)").

**Goal:** an auto-proposed NCR is actionable — assignable and time-bound — like a manually created
finding already is.

**Files:** `src/lib/compliance/create-check.ts`,
`src/app/api/compliance/checks/[checkId]/review/route.ts`

### Work
- `createComplianceCheck` inserts its proposed finding with only `title`/`description`/`severity`/
  `status`/`gateId`. `findings.ownerId` and `findings.dueAt` already exist in the schema (**no
  migration**) and are required by the manual-creation route — populate them here too.
- **Owner:** derive deterministically, don't invent one. Reasonable source, in order: the gate's
  `approvalRole` holder for the project, else the requirement's `reviewedBy`, else null. Whatever you
  choose, it must be a real project member — never a fabricated or cross-project user id.
- **Due date:** derive from severity using a named, overridable default (e.g. `high` → 7 days,
  `medium` → 14), sourced from Slice 1's config module if it has landed, else a local constant.
- Apply on the human-acceptance path in the review route too — accepting a flag must not produce a
  finding that's *less* complete than the proposal was.

### Tracer
A discovered compliance deviation produces a proposed finding with a real project-member owner and a
non-null `dueAt`.

### Verify — `scripts/verify-compliance-finding-fields.ts`
Assert both proposal and acceptance paths set `ownerId`/`dueAt`; assert the owner is always a member
of the same project (never cross-project, never fabricated); assert due date varies by severity.
`verify:compliance-http`, `verify:compliance-scan-http`, `verify:compliance-llm-http` must all pass
unmodified.

---

# Slice 5 — Overdue findings surface in gate and system blocker views

**Traces to:** PRD US-05 ("Overdue open issues appear in the selected system's or gate's blocker
view").

**Goal:** a finding past its due date is visible as a blocker regardless of severity.

**Files:** `src/lib/readiness/project-readiness.ts`, `src/app/readiness/page.tsx`,
`src/components/actions-workbench.tsx`

### Work
- `blockingFindingDetails` currently surfaces only `severity in (high, critical)` and
  `status in (open, in_progress)`. There is no "overdue" concept anywhere in the codebase.
- Add a deterministic `isOverdue = dueAt !== null && dueAt < now && status not in (resolved, closed)`
  and include overdue findings in the blocker detail list **at any severity**, flagged distinctly
  from severity-driven blockers so a reviewer can tell why something is listed.
- **Do not change what `computeReadiness` returns.** US-05 is about visibility in the blocker view;
  silently promoting a low-severity overdue finding into a readiness-blocking condition would change
  gate outcomes and is not what the story asks for. Keep the readiness verdict byte-identical —
  `verify:evidence-turnover-http` depends on it.
- Surface an overdue marker and sort on `/actions` too.

### Tracer
A low-severity open finding with a past `dueAt` appears in its gate's blocker view marked overdue,
while the gate's readiness state is unchanged.

### Verify — `scripts/verify-overdue-findings.ts`
Seed one low-severity overdue finding and one high-severity in-date finding; assert both appear with
correct reasons; assert `computeReadiness`'s output for the gate is identical before and after the
overdue finding exists. `verify:evidence-turnover-http` and `verify:gate-context-http` must pass
unmodified.

---

# Slice 6 — Turnover manifest carries solver and model provenance

**Traces to:** TRD "Decisions and Export" ("extended to include the CP-SAT solver version and Gemini
model version when a schedule snapshot is included").

**Goal:** the export answers "what produced this schedule," matching the provenance already added
for readiness rules and extraction models.

**Files:** `src/app/api/projects/[projectId]/turnover-packs/route.ts`

### Work
- The manifest already carries `readinessRuleVersion` and per-source
  `extractionModel`/`extractionProvider`. It carries **no schedule snapshot at all**, so the TRD's
  solver/model-version requirement has nothing to attach to.
- Add a `scheduleSnapshot` section: the project's current `schedule_versions` row (version number,
  `solverStatus`, `solverVersion`, `objectiveHours`, `inputHash`, critical task ids) plus its
  `explanationModelVersion` — every one of these columns already exists, **no migration**.
- Include its assignments, sorted deterministically (the manifest is canonical-JSON hashed —
  unsorted arrays would make `manifestHash` unstable across runs).
- Omit the section cleanly when a project has no schedule version rather than emitting a null-filled
  stub.

### Tracer
A turnover pack for a project with a solved schedule contains `scheduleSnapshot.solverVersion` and
`explanationModelVersion`; the manifest still verifies against its hash.

### Verify — `scripts/verify-turnover-schedule-provenance.ts`
Assert the snapshot appears with correct solver/model versions; assert `manifestHash` is stable
across two generations of identical input (sort determinism); assert clean omission for a
schedule-less project. `verify:evidence-turnover-http`, `verify:turnover-cx-http`,
`verify:turnover-provenance-http` must pass unmodified.

---

# Slice 7 — Evidence entropy / weak-evidence score

**Traces to:** CanonicalBuildPlan Feature 21 (in the active backlog, not the deferred section).

**Goal:** a transparent, advisory, drill-down-able score that flags structurally weak evidence —
kept strictly separate from readiness.

**Files:** `src/lib/evidence/entropy.ts` (new), `src/app/api/projects/[projectId]/entropy/route.ts`
(new), `src/app/readiness/page.tsx` or a small panel component

### Work
- Deterministic, **no LLM**, computed on demand from existing tables — **no migration**. The six
  signals Feature 21 names, each mapped to real data:
  - **Evidence over-reuse** — one `evidence` row `PROVES` an outlier number of requirements (count
    via `edges`).
  - **Unsigned/stale records** — `evidence.validityState in (stale, pending)`, or accepted evidence
    with no `capturedBy`.
  - **Missing calibration** — evidence of a measurement type with no calibration reference in its
    `notes`/linked source region. Define the rule explicitly in code; if the data can't support it
    honestly, emit the signal as `unavailable` rather than scoring it as zero.
  - **Circular edges** — a cycle in the `edges` provenance graph.
  - **Low-confidence extraction** — `requirements.confidence` below a threshold among accepted rows.
  - **Overloaded approver** — one user holding an outlier share of the project's `decisions`.
- Return **per-signal contributions alongside the total**, not just a number — "transparent
  drill-down" is the explicit requirement, and an unexplained score is worse than none.
- Signals that cannot be computed must report `unavailable` with a reason, never silently score 0 —
  the same honesty rule the predictive-risk engine already follows for missing feeds.
- **Advisory only:** never referenced by `computeReadiness` or any gate decision. Enforce this with a
  test, not just a convention.

### Tracer
`GET /api/projects/{id}/entropy` returns a total plus six itemized signal contributions for the
seeded project.

### Verify — `scripts/verify-evidence-entropy.ts`
Seed a known-weak fixture (one over-reused evidence row, one stale record) and assert those specific
signals fire with the expected contributions; assert an uncomputable signal reports `unavailable`
rather than 0; **assert the readiness verdict is byte-identical with and without the score present**
(the separation invariant). `verify:evidence-turnover-http` must pass unmodified.

---

# Slice 8 — Generalize Teach-Back beyond compliance

**Traces to:** CanonicalBuildPlan Feature 22.

> **Correction to the audit:** Teach-Back is **not** unbuilt. It exists end-to-end for compliance —
> `compliancePrecedents` (rationale, cited target region, reviewer attribution, `reviewState`,
> never auto-applied) plus the "Teach-back / equality precedent" UI in `compliance-workbench.tsx`.
> The real gap is that it is compliance-only, while Feature 22 covers correcting *any* AI
> proposal/disposition. This slice generalizes an existing, working mechanism — it does not build one
> from scratch.

**Goal:** correcting any AI proposal captures reusable, cited, attributed rationale.

**Files:** `src/lib/db/schema.ts` (+ migration), `src/lib/teachback/*` (new), the review routes,
review UI components

### Work
- There are 8 review routes; 7 capture a `reviewNote` that is stored and then never reused:
  requirements, evidence, Cx checklists, schedule tasks, schedule resources, schedule risks, and
  compliance checks (the 8th, precedents, *is* the existing teach-back path).
- **Schema:** add a generalized `teachback_notes` table — project-scoped, polymorphic subject
  (`subjectType`/`subjectId`, following the existing `edges` polymorphic pattern),
  `correctedFrom`/`correctedTo` (what the AI proposed vs. what the human decided), `rationale`,
  `sourceRegionId` (nullable citation), `createdBy`, `reviewState`. Do **not** migrate or disturb
  `compliancePrecedents` — it has exact-hash matching semantics that compliance verdicts depend on.
  Leave it as the specialized compliance case; the new table is the general case.
- **Capture:** when a reviewer *edits or rejects* an AI proposal (not on plain accept — accepting
  teaches nothing), persist the rationale they already type into `reviewNote` as a teach-back note
  with before/after values.
- **Surface:** on a similar future review, show matching prior rationale as advisory context —
  matched by subject type + semantic similarity via the existing `retrieveSemanticCitations`, scoped
  to the project. **Never auto-apply**, exactly as the compliance precedent path already refuses to.

### Tracer
Rejecting a proposed requirement with a rationale creates a teach-back note; reviewing a similar
requirement later surfaces it as advisory context.

### Verify — `scripts/verify-teachback-http.ts`
Assert capture on edit/reject and *no* capture on plain accept; assert cross-project notes never
surface; assert a surfaced note never changes the reviewed record's state (advisory-only);
assert `compliancePrecedents` behavior is untouched. `verify:compliance-http` must pass unmodified.

---

# Slice 9 — RFI resolution state

**Traces to:** PRD US-29 ("previously resolved similar RFI").

**Goal:** stop labeling every RFI match "previously resolved" when nothing tracks resolution.

**Files:** `src/lib/db/schema.ts` (+ migration),
`src/app/api/projects/[projectId]/knowledge/rfi-similar/route.ts`,
`src/components/knowledge-search.tsx`

### Work
- Nothing in the data model distinguishes a resolved RFI from an open one —
  `documentVersions.status` is a document lifecycle state (`draft`/`approved`/`superseded`), not an
  RFI resolution state. The endpoint and UI currently label **every** `documentType = "rfi"` vector
  match as "previously resolved."
- **Schema:** add `resolutionState varchar(20)` + `resolvedAt` to `documents` (nullable; only
  meaningful for `documentType = "rfi"`), values `open | resolved | withdrawn`.
- Filter `rfi-similar` to `resolutionState = "resolved"` — the endpoint's whole premise is prior
  *resolutions*. Return unresolved matches, if at all, in a separately-labeled group; never under the
  "resolved" heading.
- Update the UI label so an unresolved match can never render as resolved.
- Backfill existing seeded RFIs to an explicit state rather than leaving null-as-ambiguous.

### Tracer
An unresolved RFI no longer appears in the "previously resolved similar RFI" panel.

### Verify — `scripts/verify-rfi-resolution.ts`
Seed one resolved and one open RFI with near-identical text; assert only the resolved one is
returned under the resolved heading; assert cross-project scoping still holds.
`verify:rfi-similar-http` and `verify:knowledge-http` must pass — **expect to update
`verify-rfi-similar-http.ts`'s fixture** to mark its RFI resolved, since it currently relies on the
unconditional behavior. That is a legitimate fixture update, not a weakened assertion; call it out
in the commit.

---

# Slice 10 — Knowledge metadata filter: system / asset / gate / date / revision

**Traces to:** PRD US-28; ADR-021 ("mandatory-first deterministic metadata filter
(tenant/project/system/asset/gate/doc_type/date/revision)").

**Goal:** the mandatory pre-ranking filter covers every dimension the ADR names, not just project +
doc type.

**Files:** `src/lib/knowledge/query.ts`, `src/lib/knowledge/pipeline.ts`,
`src/app/api/projects/[projectId]/knowledge/query/route.ts`, `src/components/knowledge-search.tsx`

### Work
- `retrieveSemanticCitations` filters only `projectId` + optional `documentType`. Add optional
  `systemId`, `assetId`, `gateId`, `revision`, and a `date` range.
- **No migration required.** `knowledgeChunks → sourceRegions → documentVersions → documents` already
  gives revision and date. System/asset/gate scoping resolves through `edges` — a requirement or
  evidence row anchored to the chunk's `sourceRegionId`, then its `AFFECTS`/`BELONGS_TO` edge — the
  same traversal `expand.ts` already performs. (If this join proves too slow on real data, a
  denormalized scope column is a valid follow-up optimization, but it is **not** needed for
  correctness and should not be done speculatively.)
- **The filter must remain mandatory-first and in SQL, before ranking** — never a post-filter on
  ranked results. That ordering is the security property ADR-021 protects (vector search is never
  global), and post-filtering would silently break it.
- Thread the new filters through the planning call in `pipeline.ts` so the LLM can *propose* a
  narrowing, but the caller's explicit filter always wins (same override precedence already used for
  `documentType`).
- Add filter controls to `KnowledgeSearch` — currently a bare free-text box with no filter UI at all.

### Tracer
A query scoped to one system returns only chunks reachable from that system, with the exclusion
enforced in SQL.

### Verify — `scripts/verify-knowledge-filters.ts`
Seed chunks under two systems with identical text; assert a system-scoped query returns only one;
assert the same for asset, gate, revision, and date range; **assert the filter is pre-ranking** by
confirming an excluded chunk never appears even when it would rank first by similarity.
`verify:knowledge-query-http`, `verify:knowledge-rerank`, `verify:knowledge-synthesis`,
`verify:knowledge-http` must all pass unmodified.

---

# Slice 11 — Wiring and docs

**Files:** `package.json`, `scripts/verify-all.ts`, `STATUS.md`, `README.md`

- Register every new `verify:*` script in `package.json` and `verify-all.ts` (each slice's own
  commit should **not** touch these two files — see the conflict note in Dependencies).
- Update `STATUS.md`'s status table and "What remains" list.
- Update `README.md` only if a new user-facing surface warrants it (entropy panel, knowledge
  filters).

---

## Dependencies and parallel waves

### Hard constraints

1. **Only Slices 8 and 9 touch `src/lib/db/schema.ts` and generate migrations.** Running both
   concurrently causes a migration collision — this bit us during the agent remediation. Either
   serialize them, or give both to a single agent that generates **one** migration covering both.
   Every other slice needs no schema change.
2. **No slice edits `package.json` or `scripts/verify-all.ts`.** Concurrent edits to these two files
   collide. Wire all new scripts centrally in Slice 11 after the others land.
3. **Slices 9 and 10 both touch `knowledge-search.tsx` and the knowledge routes.** Serialize them or
   assign both to one agent.

### Dependency graph

```
Slice 1 (config)  ──soft──> Slice 2 (solver timeout)   [inline the constant if 1 hasn't landed]
                  ──soft──> Slice 4 (due-date defaults)
                  ──soft──> Slice 7 (entropy thresholds)

Slice 4 (finding owner/due) ──soft──> Slice 5 (overdue view)  [5 works without 4; 4 gives it data]

Slice 8 (teach-back) ──hard(schema)──┐
Slice 9 (RFI state)  ──hard(schema)──┴──> one migration, one owner

Slice 9 (RFI state) ──hard(files)──> Slice 10 (knowledge filters)  [shared UI + routes]

All slices ──hard──> Slice 11 (central wiring)
```

Every "soft" dependency means *nicer in this order, but not blocking* — the dependent slice works
standalone with a local constant or without the upstream data.

### Suggested waves

**Wave A — 5 agents in parallel, zero shared files, zero schema**

| Slice | Area | Touches |
| --- | --- | --- |
| 1 | Config targets | `lib/config/`, `env.ts` |
| 2 | Solver resilience | `lib/schedule/` |
| 3 | Rate-limit coverage | `lib/redis/`, auth + schedule + upload routes |
| 5 | Overdue findings | `lib/readiness/`, readiness + actions UI |
| 6 | Turnover schedule provenance | turnover route |

Slice 4 can join Wave A as a 6th if you accept a local due-date constant instead of waiting on
Slice 1; it shares no files with the others.

**Wave B — 2 agents in parallel**

| Agent | Slices | Note |
| --- | --- | --- |
| B1 | 8 + 9 | Bundled: both need schema. One migration covering both tables. |
| B2 | 7 | Entropy score — no schema, no file overlap with B1 |

**Wave C — 1 agent**

| Slice | Note |
| --- | --- |
| 10 | Knowledge filters — must follow Slice 9 (shared knowledge UI/routes) |

**Wave D — orchestrator, not an agent**

Slice 11: wire every new verify script into `package.json` + `verify-all.ts`, run the full matrix
twice (several checks here are probabilistic or poll-driven — one green run is not proof), update
`STATUS.md`.

### Practical notes for whoever runs this

- **Run the full matrix twice** before calling any wave done. The lively risk signals and the
  recurring background poll make single-run greens unreliable.
- **Watch for cleanup-ordering bugs.** The recurring `risk.poll.all` job writes `risk_signals` /
  `schedule_risks` for *every* accepted task project-wide. Any new verify script that creates and
  deletes its own `scheduleTasks` must scope its cleanup by `taskId` — not just by its own tracked
  ids — or it will hit a foreign-key violation intermittently. This pattern has already bitten four
  scripts in this repo.
- **Create your own fixtures.** Don't rely on an arbitrary `SELECT ... LIMIT 1` from `projects` —
  leftover fixtures from other scripts make that non-deterministic, and it breaks outright against a
  freshly-seeded database.
- **Kill your dev servers.** Leftover `next` / worker processes against the shared database caused an
  audit hash-chain fork during the last effort.
