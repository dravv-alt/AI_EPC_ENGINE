# What I Have Built

This file is the live implementation ledger for Pramana Cx. It records shipped work, verified behavior, and the next prerequisite rather than treating planning intent as completion.

## Runtime

- Production Next.js build passes and is served locally at `http://localhost:4173`.
- `npm run system:start` is now the repeatable local production entry point: it migrates, builds, checks PostgreSQL/Redis/ingestion/solver dependencies, and supervises the Next.js server and BullMQ worker together. `npm run verify:all` runs the complete isolated local acceptance matrix.
- Docker Desktop became unavailable during local work, so an isolated local PostgreSQL cluster is currently running as a development fallback on `127.0.0.1:5432`. The application still uses the normal PostgreSQL connection string and migrations.
- A real ephemeral Redis runtime, BullMQ worker, and isolated PyMuPDF ingestion virtual environment are running locally; `/api/health` reports PostgreSQL, Redis, and object storage independently.

## Completed foundations

- Next.js / TypeScript application scaffold, design tokens, responsive control-room UI, health endpoint, Docker Compose definition, Drizzle migrations, and synthetic seed.
- PostgreSQL authority model for tenants, users, projects, memberships, controlled documents/versions/regions, systems, assets, gates, requirements, evidence, findings, edges, decisions, and audit events.
- Project RBAC backed by `project_members`; tenant-scoped project listing/creation, member provisioning, and audited role changes are implemented. Admin now includes approval authority.
- Credentials authentication is implemented alongside development and Clerk adapters: bcrypt password hashes, opaque random session tokens stored only as SHA-256 hashes, secure HttpOnly/SameSite cookies, expiry/revocation, encrypted TOTP secrets, enrollment/verification, MFA login challenge, and a real profile screen.
- Hash-controlled PDF upload workflow uses a single local-or-S3/MinIO storage boundary, scoped object keys, persisted object metadata, five-minute signed reads, magic-byte validation, BullMQ extraction jobs, PyMuPDF reading-order extraction, page/bounding-box/hash provenance, and explicit extraction state.
- Requirement accept/reject/edit workflow with review metadata and audit events.
- Deterministic readiness calculation from accepted requirements, accepted/stale/failed evidence, and blocking findings. Dashboard values query PostgreSQL, not fixture numbers.

## Phase 3 work currently built

- Cx draft checklist creation, controlled-source citation verification, engineer acceptance, resumable readings, deterministic numeric/boolean verdicts, and narrative human-review routing.
- A deterministic Cx failure writes a finding, blocks the gate, and creates a deduplicated `TEST_FAILED` alert.
- Engineer approval route for an all-proposed-pass Cx record materializes evidence and moves its gate to `in_review`, never `ready`.
- Scoped citation-only knowledge query route: retrieved claims always expose source-region, document-version, and content hash.
- Compliance comparison route: proposed requirements cannot be checked; narrative/unstructured cases become `needs_engineering_judgment`, not an autonomous flag.
- Single-leg shipment registration with deterministic estimate/RAG status and a read-only shipment-risk alert.
- Command Center alert read route.
- Cx is now a guided create → engineer-accept → execute numeric/boolean/narrative steps → approve passing report workflow. Re-recording the same failed step cannot create duplicate findings.
- Compliance has a project-scoped accepted-requirement/controlled-line comparison form; cross-project source regions are rejected.
- Compliance is now a governed end-to-end workflow rather than a single numeric regex. It unit-normalizes compatible engineering quantities, deterministically compares explicit boolean and categorical callouts, routes qualitative text to mandatory review, persists immutable requirement/target snapshots, shows exact clause-versus-line links and source-hierarchy conflicts, and records accept/edit/reject rationale with optimistic version checks.
- Machine-created compliance findings are stored as `proposed` and do not affect readiness or appear in the normal Actions queue. Only an engineer's accepted deviation promotes the finding to `open`; rejection or an accepted equality precedent dismisses it. Project-scoped teach-back precedents preserve both exact citations, normalized target fingerprint, author/reviewer attribution, and audit history, and are never auto-applied. Deterministic numeric/boolean/categorical deviations cannot be overridden by precedent.
- Shipment status transitions use the frozen event contract. Delayed/recovered transitions preserve history, clear recovery alerts, and fan out to schedule re-solves when affected task IDs are supplied.
- Real frontend routes now exist for Overview, Sources, Requirements, Evidence, Readiness, Schedule, Actions, Changes, Cx Tests, Shipments, Compliance, Knowledge, Command Center, Turnover, Settings, and Profile. Sidebar and dashboard actions use Next.js navigation instead of hash anchors.

## Phase 4 work currently built

- Redis-backed API rate limiting with explicit `memory-degraded` fallback only when `INFRA_ALLOW_DEGRADED=true`.
- Second synthetic tenant/project with no development-user membership, used for authorization tests.
- Canonical-v2 audit hash-chain writer/verifier. Writers serialize per project with a PostgreSQL advisory transaction lock, preventing concurrent chain forks. Earlier foundation records remain labelled legacy links.
- Phase 3/4 local verification matrix: `PLANNER/Phase3Phase4Verification.md`.
- Predictive risk now polls swappable procurement, equipment-lead-time, workforce, and weather clients against the current immutable schedule. Every source outcome is persisted, including explicit unavailable readings. Deterministic probability/delay/critical-path/deadline rules emit only new material task/type risks, unchanged materiality is deduplicated, nonmaterial recovery self-resolves alerts, and all mitigation options remain advisory.
- Predicted-risk events are validated against their project-scoped risk, latest source signal, and affected task before an alert can be created. Risk acknowledgement or dismissal records human review but never applies mitigation, invokes CP-SAT, or mutates a schedule date.

## Phase 0 platform contracts now built

- Migration `0003` adds persisted auth sessions, encrypted TOTP state, durable jobs, idempotency records, storage-object metadata, and schedule-event history.
- BullMQ `core` queue, persisted job lifecycle/status API, exponential retry settings, deterministic idempotency keys, and separate worker process.
- `ModelProvider` interface with schema-validated deterministic Mock and Gemini implementations; Gemini is activated only with explicit configuration.
- Frozen Zod event contract and one ingestion endpoint for `TEST_FAILED`, `SHIPMENT_DELAYED`, `SHIPMENT_RECOVERED`, and `predicted_risk_delay`; every event has project, occurrence, transition, and dedup identity.
- Command Center event semantics raise stable active alerts, preserve event history, and clear shipment alerts on recovery. Schedule processing is queued; the CP-SAT delta handler remains Phase 2 work.
- Docker image and Compose topology for pgvector/PostgreSQL, Redis, MinIO, ingestion, core API, and worker. Compose dependency health checks and non-degraded production service settings are defined.

## Phase 1 evidence-to-turnover tracer now built

- Evidence workflow screen and APIs: project-scoped capture always starts `pending`; reviewer acceptance requires a SHA-256 artifact hash and only creates `PROVES` edges to accepted requirements.
- Source revision endpoint and deterministic region-hash blast-radius assessment. Changed source regions locate affected requirements/proof edges, mark accepted evidence `stale`, reopen approved gates to `in_review`, create reassessment findings, and preserve decisions/audit history.
- Gate decision endpoint requires `gate:approve`, a READY deterministic state for ordinary approval, a substantive reason, and fresh TOTP verification for credentials sessions. The immutable decision stores a hash of the exact evidence/readiness baseline.
- Turnover screen and APIs generate only from approved gates. The manifest includes controlled sources, evidence hashes, graph links, decision baseline, and audit-chain head; it is stored through the object boundary and served via a short-lived signed URL.
- Turnover manifests use recursively key-sorted canonical JSON. The verifier recomputes both the persisted JSONB manifest hash and stored object hash; this fixed a real key-order mismatch found by the end-to-end test.

## Phase 2 deterministic schedule tracer now built

- Schedule task proposals, human accept/reject queue, project resources/capacities, per-task resource demand, accepted-task dependencies, and deterministic cycle rejection.
- A dedicated FastAPI OR-Tools CP-SAT service enforces duration, earliest/fixed dates, deadlines, precedence, and cumulative resource capacity. It returns explicit infeasibility instead of inventing dates.
- Schedule workbench routes accepted inputs into a solve, persists immutable numbered versions and per-task assignments, labels critical terminal work, and generates an AI-labelled explanation only after deterministic dates are saved.
- The four-event endpoint persists history and uses BullMQ serialization. Events without mapped affected tasks are history-only; material events with mapped tasks create a new version and supply the previous assignment starts as CP-SAT warm-start hints.
- Schedule version/history UI shows solver status, objective, assignments, critical labels, and saved explanation.

## Foundation expansion completed after the original ledger

- Active project selection is now persisted in a validated cookie and every selected project is rechecked against membership. Project settings, member roles, retention policy, project creation, and audit verification are available from the UI.
- Systems, assets, and gates have project-scoped CRUD APIs and a real workbench. The graph API rejects cross-project endpoints and supports requirement, evidence, finding, asset, gate, system, source, schedule-task, and shipment relationships.
- Findings/actions now support create, assignment, severity, due date, in-progress/closed/reopen transitions, resolution notes, optimistic version checks, audit history, and readiness invalidation.
- The audit verifier now recomputes canonical hashes and detects broken links, forks, cycles, and disconnected event segments rather than only checking adjacent rows.
- Profile/security now supports display-name updates, TOTP enroll/verify/disable, password change, revocation of other sessions, and session/membership inspection.
- Field capture is a real offline-first workflow: bounded IndexedDB queue, device-side AES-GCM where supported, client capture idempotency, MIME magic-byte checks, immutable SHA-256 object storage, sync state, review authority labels, PWA manifest/service worker, and offline fallback page.
- Requirement review supports accept, edit, reject, and duplicate-of classification with controlled numeric/unit/tolerance fields. Citations open an exact source-region viewer with document hash, page, bounding box, extracted text, and a signed artifact URL.
- Readiness rule `readiness-v2.1` evaluates accepted proof per accepted requirement, distinguishes missing/pending/stale/failed proof, includes predecessor gates and open findings, stores decision baselines, and keeps schedule information explicitly non-authoritative.
- Schedule inputs now have separate proposal/review authority for tasks and resources, validation flags, dependency cycle diagnostics, asynchronous baseline jobs, serialized solves, immutable history/diffs, warm-start hints, soft-deadline minimum-overrun schedules, bottleneck metadata, and safe post-save AI explanations.
- Controlled-source extraction now triggers schema-validated, citation-bound requirement or schedule proposals through the configured `ModelProvider`; invalid region references and unsupported units are rejected before persistence.
- Shipment registration now requires a registered asset and stores origin/destination, MMSI, simulated/live provenance, deterministic weather/congestion ETA factors, graph-derived task mappings, server-side status transitions, and a responsive Leaflet/OpenStreetMap great-circle map.
- All desktop page destinations now have real Next.js routes. Legacy URLs such as `/#readiness` redirect to `/readiness`; narrow viewports have a complete 19-destination route menu instead of an inert menu button. Global search submits to the project-scoped Knowledge route.
- Migrations `0005` and `0006` add retention, field-capture provenance, finding lifecycle/versioning, Cx report fields, shipment telemetry, reviewed schedule resources/tasks, risk records, event processing, solver diagnostics, and explanation metadata.
- Migration `0008` adds governed compliance snapshots, review attribution/versioning, finding disposition, and project-scoped exact-citation equality precedents with match/review indexes.

## Verified locally

- Cross-project API access returns `403`.
- Cx failed numeric reading creates exactly one new finding, blocks the gate, and creates a `TEST_FAILED` alert.
- Scoped knowledge query returns only cited controlled regions.
- A delayed synthetic shipment is labelled as an estimate and creates an alert.
- `npm run verify:phase0` passes against a real isolated Redis process: Redis rate limiting, BullMQ enqueue/idempotency, encrypted TOTP, event validation, Mock provider, and signed storage.
- `npm run verify:credentials-http` passes against an isolated production server: registration, HttpOnly session, scoped profile, TOTP enrollment, MFA challenge, and MFA login; synthetic records are removed afterward.
- `npm run verify:evidence-turnover-http` passes the isolated full tracer: pending capture, accepted-only proof, READY computation, fresh-TOTP approval, immutable decision baseline, signed turnover generation, and independent manifest verification.
- `npm run verify:schedule-http` passes accepted-input review, dependency/resource-constrained 18-hour optimum, immutable baseline, material risk event, BullMQ worker re-solve, three CP-SAT warm-start hints, and saved version history.
- `npm run verify:audit` validates the canonical audit chain, and `npm run typecheck` plus `npm run build` pass.
- Code Review Graph MCP was rerun after intentional staging: 128 files, 378 structural nodes, 4,948 edges, 82 execution flows, and 22 communities were indexed. It correctly classed the all-new foundation as high risk and prioritized auth/session/project-access paths; the isolated auth/evidence/schedule tests cover those critical paths.
- The current production compiler passes after the foundation expansion. A live route sweep returned HTTP 200 for all 20 public application pages, and browser verification proved `/#readiness` redirects to `/readiness`, the responsive route menu opens, a menu click navigates to `/shipments`, and the Leaflet shipment map mounts.
- Governed Cx is now verified end to end with `npm run verify:cx-http`: a synthetic controlled standard is hash-stored and extracted into exact regions; an asynchronous citation-bound checklist is generated and accepted; numeric, boolean, and narrative readings are persisted; narrative judgment remains explicitly human; the draft is editable; engineer approval creates a canonical immutable artifact with a verified SHA-256 hash, accepted evidence, graph linkage, and a gate transition only to `in_review`. The verifier removes its synthetic records and objects afterward.
- Governed compliance is verified end to end with `npm run verify:compliance-http`: `1 bar` is normalized to `100 kPa`; a deterministic deviation first creates only a non-authoritative proposed finding; explicit engineer acceptance promotes it to an active blocker; qualitative text remains mandatory review; an equality precedent is proposed, explicitly accepted, and safely reused only for the same requirement and exact normalized target content; a cross-project target is rejected; synthetic data is removed afterward.
- Browser verification of `/compliance` passed at desktop and 390×844 mobile widths with exact-citation links and review controls present, no nested forms, no horizontal overflow after fixing intrinsic select sizing, and no console warnings/errors.
- Code Review Graph assessed the compliance/readiness/finding change set at risk `0.60`; its highlighted authority/readiness paths are covered by the new HTTP contract test, production build, cross-project assertion, responsive browser check, and canonical audit verification.
- The root `README.md` is now the global architecture/status document. It includes Mermaid runtime, authority-flow, job-lifecycle, and entity diagrams; implemented surfaces; configuration; verification commands; documentation precedence; and an explicit remaining-work register.
- `npm run verify:risk-http` passes four-source polling, explicit unavailable state, deterministic materiality, task/type deduplication, self-resolution, advisory event/alert creation, human acknowledgement, and proof that no schedule version is created.
- `npm run verify:all` passes migrations, type-checking, production build, seed, Phase 0, credentials/MFA, evidence-to-turnover, deterministic schedule, governed Cx, governed compliance, predictive risk, and the canonical audit chain. The latest audit validated 198 events: 196 canonical and 2 labelled legacy.
- Browser acceptance passed all 19 application routes at desktop width and 11 critical workflow routes at 390×844. There are no not-found destinations, console warnings/errors, or page-level horizontal overflow; compact forms and the mobile Readiness proof board were corrected during this pass.

## Not yet complete — do not represent as complete

- Phase 0 remaining acceptance work: exercise the S3 driver against MinIO and run the full Compose stack as one system when Docker Desktop is available. Secure opaque sessions replace the contradictory JWT wording in the older plan.
- Phase 1/2 remaining: production Gemini validation with a supplied key, richer visual schedule-diff overlays, and end-to-end S3/MinIO verification when Docker is available.
- Remaining Phase 3/4 depth: pgvector embeddings and RFI similarity, recurring predictive-risk poll orchestration, configured live external signal/AIS/weather adapters, richer Command Center grouping/cross-links, broader controlled-source formats, observability, and full CI/accessibility/tenancy/load suites.

## Next implementation order

1. Build hybrid pgvector/FTS retrieval with RFI similarity.
2. Add the recurring risk poll orchestrator and configured external-provider acceptance.
3. Expand Command Center cross-links and add CI/accessibility/tenancy/load contract suites.
4. Run the full Compose topology and S3/MinIO integration test once Docker Desktop is healthy.
