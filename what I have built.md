# What I Have Built

This file is the live implementation ledger for Pramana Cx. It records shipped work, verified behavior, and the next prerequisite rather than treating planning intent as completion.

## Runtime

- Production Next.js build passes and is served locally at `http://localhost:4173`.
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
- Shipment status transitions use the frozen event contract. Delayed/recovered transitions preserve history, clear recovery alerts, and fan out to schedule re-solves when affected task IDs are supplied.
- Real frontend routes now exist for Overview, Sources, Requirements, Evidence, Readiness, Schedule, Actions, Changes, Cx Tests, Shipments, Compliance, Knowledge, Command Center, Turnover, Settings, and Profile. Sidebar and dashboard actions use Next.js navigation instead of hash anchors.

## Phase 4 work currently built

- Redis-backed API rate limiting with explicit `memory-degraded` fallback only when `INFRA_ALLOW_DEGRADED=true`.
- Second synthetic tenant/project with no development-user membership, used for authorization tests.
- Canonical-v2 audit hash-chain writer/verifier. Writers serialize per project with a PostgreSQL advisory transaction lock, preventing concurrent chain forks. Earlier foundation records remain labelled legacy links.
- Phase 3/4 local verification matrix: `PLANNER/Phase3Phase4Verification.md`.

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

## Not yet built — do not represent as complete

- Phase 0 remaining acceptance work: exercise the S3 driver against MinIO and run the full Compose stack as one system when Docker Desktop is available. Secure opaque sessions replace the contradictory JWT wording in the older plan.
- Phase 1/2 remaining: systems/assets/gates CRUD screens, Gemini requirement extraction, field/offline artifact upload, richer schedule version diff visualization, solver bottleneck diagnosis beyond the explicit conflicting-constraint message, and event-to-task mappings sourced from shipment/procurement relationships rather than supplied IDs.
- Remaining Phase 3: standards/precedent grounding, pgvector embeddings/RFI similarity, interactive graph/timeline, live AIS/weather polling, predictive-risk polling/materiality worker, automatic shipment-to-task mappings, and richer Command Center cross-links.

## Next implementation order

1. Complete the remaining Phase 3 agent dependencies: standards/precedent grounding, predictive-risk polling, shipment-to-task mappings, pgvector metadata retrieval, and graph/timeline views.
2. Expand Shipment, Knowledge, and Command Center into map/recovery, hybrid retrieval, and graph-cross-linked workflows.
3. Add CI/browser/accessibility/tenancy contract suites, richer schedule diffs, and offline evidence synchronization.
4. Run the full Compose topology and S3/MinIO integration test once Docker Desktop is healthy.
