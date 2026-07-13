# Implementation Plan

## Slice 1: Health Check and Project Shell

### What this delivers
The deployed application starts, returns `200` from `GET /health`, and shows an authenticated project shell with an empty-state `Project Dashboard`.

### Depends on
none

### Touches
`GET /health`, Next.js app shell, Cloudflare Worker entrypoint, `tenants`, `users`, `projects`, and `project_members` migrations, CI smoke test.

## Slice 2: Project Access and Role Enforcement

### What this delivers
Users can create a project, invite members, and see project-scoped access denied when their `project_members` role does not permit an action.

### Depends on
Slice 1

### Touches
`POST /v1/projects`, `GET /v1/projects/{id}`, project settings screens, Better Auth session middleware, `tenants`, `users`, `projects`, and `project_members` repositories.

## Slice 3: Source Upload and Provenance

### What this delivers
A project member can upload a supported source and see its hash, revision, processing state, and source metadata in `Source Library`.

### Depends on
Slice 2

### Touches
`POST /v1/projects/{id}/documents`, `documents`, `document_versions`, and `source_regions` migrations, R2 storage service, `Source Library`, `Upload Source`, and `Processing Status` screens.

## Slice 4: Requirement Review Queue

### What this delivers
A reviewer can inspect a source-cited requirement proposal and accept, edit, or reject it without changing readiness until acceptance.

### Depends on
Slice 3

### Touches
`GET /v1/projects/{id}/requirements`, `POST /v1/requirements/{id}/review`, `requirements` repository, extraction job contract, `Requirement Review Queue`, and `Requirement Detail` screens.

## Slice 5: System, Asset, and Gate Setup

### What this delivers
A project member can import or create a system, asset, and commissioning gate and view their hierarchy in the project dashboard.

### Depends on
Slice 2

### Touches
`systems`, `assets`, and `gates` migrations and repositories, CSV import validation, system and gate setup UI, and project dashboard summaries.

## Slice 6: Evidence and Test Recording

### What this delivers
A field engineer can attach evidence to a system or asset and record a `test_run` from an approved `test_procedure` with a visible pass/fail state.

### Depends on
Slices 3, 5

### Touches
`evidence`, `test_procedures`, `test_steps`, and `test_runs` migrations, evidence API, `Field Capture`, `Evidence Detail`, and `Test Run Detail` screens.

## Slice 7: Findings and Action Ownership

### What this delivers
A QA/QC lead can create a finding, assign an owner and due date, and see open high-severity findings on the relevant gate view.

### Depends on
Slices 5, 6

### Touches
`POST /v1/projects/{id}/issues`, `findings` migration and repository, `Blocker Detail`, `Finding Detail`, assignment notifications, and due-date queries.

## Slice 8: Deterministic Readiness Board

### What this delivers
A commissioning manager can select a gate and receive a rules-based `READY`, `BLOCKED`, `IN_REVIEW`, or `UNKNOWN` result with categorized, source-linked blockers.

### Depends on
Slices 4, 6, 7

### Touches
`GET /v1/projects/{id}/gates/{gate_id}/readiness`, pure readiness rules module, evidence and edge traversals, `Readiness Board`, and readiness unit/contract tests.

## Slice 9: Change Impact and Stale Evidence

### What this delivers
A revised document or accepted requirement change marks affected evidence stale and displays the impacted requirements, tests, findings, gates, and decisions.

### Depends on
Slices 3, 4, 6, 8

### Touches
`edges` relationship validation, document revision comparison job, stale-evidence propagation service, change-impact panel, and `SUPERSEDES`/`AFFECTS` traversal tests.

## Slice 10: Authorized Gate Decisions

### What this delivers
An authorized approver can approve, reject, or waive a gate with a reason, evidence baseline, rule version, and append-only audit event.

### Depends on
Slices 2, 8, 9

### Touches
`POST /v1/gates/{id}/decisions`, `decisions` and `audit_events` repositories, TOTP check, `Gate Review`, and `Decision History` screens.

## Slice 11: Offline Field Capture

### What this delivers
A field engineer can capture evidence without connectivity, see `Pending Sync`, and receive an explicit server-confirmed state after reconnection.

### Depends on
Slice 6

### Touches
PWA service worker, bounded local queue, sync endpoint, `Field Capture` states, duplicate-hash handling, and offline/online Playwright tests.

## Slice 12: Verifiable Turnover Export

### What this delivers
An operations-readiness lead can export a selected gate's source-linked evidence pack with a manifest hash and verify the generated artifact.

### Depends on
Slices 8, 10

### Touches
`POST /v1/projects/{id}/exports`, `GET /v1/exports/{id}`, R2 export worker, `Exports`, `Export Preview`, `Export Job`, and `Manifest Verification` screens.

## Slice 13: Security, Accessibility, and Pilot Hardening

### What this delivers
The complete workflow passes project-isolation, audit, accessibility, retry, source-citation, and export-integrity checks in CI and is deployable with documented recovery controls.

### Depends on
Slices 1-12

### Touches
Authorization test suite, audit-chain verifier, axe-core and keyboard tests, Playwright flow suite, CodeQL/Gitleaks/Trivy workflows, backup/export runbook, and production configuration.
