# Pramana Cx Engineering and Agent Rules

## Naming Conventions

- TypeScript variables, functions, and API payload properties use `camelCase`; React components and TypeScript types use `PascalCase`.
- Files use `kebab-case` for route-independent modules and the framework's required route naming for app paths.
- Database tables and columns use `snake_case`; entity vocabulary must match `Schema.md` exactly.
- API paths use plural nouns for collections, for example `/v1/projects/{projectId}/documents`.
- Boolean names begin with `is`, `has`, or `can`; timestamps end with `At` in TypeScript and `_at` in SQL.
- Relationship values use the uppercase names defined in `Schema.md`, such as `PROVES` and `BLOCKS`.

## Code Structure

- Keep route handlers thin: authentication, request parsing, and response mapping only.
- Put business logic in domain services; put D1 queries in repository modules; do not issue database queries directly from React components or route handlers.
- Keep readiness rules in a pure rules module with no model-provider, network, or UI imports.
- Keep AI provider adapters behind `ModelProvider`; application code must not call a vendor SDK directly.
- Keep R2 object access behind a storage service that verifies project scope and content hash.
- UI screens own presentation and user interaction; they must call typed API clients rather than construct raw fetch payloads in multiple components.
- Database migrations are ordered, committed, and never rewritten after they reach a shared environment.

## Error Handling

- API errors use `{ "code": string, "message": string, "request_id": string }` and the correct HTTP status.
- Expected validation, authorization, conflict, and not-found cases are returned as typed domain errors; do not expose stack traces or provider responses.
- Unexpected errors are logged with `request_id`, tenant/project scope, operation, and safe metadata; source document contents and tokens are never logged.
- Ingestion, AI, indexing, and export jobs must record retryable versus terminal failure and remain safe to retry.
- UI failure states must show the action that can be retried or the person who must resolve it; never show a false success state.

## Validation Rules

- Validate all external input at the API boundary with the repository's schema validator before invoking a service.
- Repeat authorization and business invariants in the service layer; API validation alone is not a security boundary.
- Enforce foreign keys, unique constraints, enum checks, non-null rules, and numeric ranges in D1 migrations.
- Reject unsupported files, invalid MIME types, oversized uploads, missing revision metadata, and malformed CSV/XLSX rows before extraction.
- A requirement must have a source region and review state; only `accepted` requirements may affect readiness.
- A readiness transition must be produced by the deterministic rules engine and include a rule version and input/evidence baseline.

## Testing Requirements

- Every readiness rule, state transition, unit conversion, and stale-evidence propagation path has unit tests.
- Every API route has authorization, validation, success, and failure tests with mocked external providers.
- Every primary AppFlow path has a Playwright test covering the happy path and at least one failure branch.
- Upload, job retry, duplicate hash, signed URL, and export-manifest behavior have integration tests against a disposable D1/R2-compatible test setup.
- Retrieval tests must verify project isolation and that every surfaced result resolves to a source region.
- Accessibility checks use axe-core and keyboard navigation for review, readiness, approval, and field-capture screens.
- Do not use live AI providers in deterministic unit tests; use recorded, versioned fixtures and separately run evaluation suites.

## AI Agent Behaviour Rules

- AI may extract, classify, summarize, suggest mappings, and draft actions only within the current project scope.
- AI must include source-region citations and confidence for every requirement or finding proposal.
- AI must not approve a requirement, set readiness, close a finding/NCR, approve a waiver, sign a test, or create a gate decision.
- AI must surface `UNKNOWN` when the source is missing, conflicting, illegible, stale, or outside the evaluated schema.
- AI-generated text is labelled as a proposal until a human accepts it.
- An implementation agent may add functions and tests within the approved PRD/TRD, but must ask before deleting files, changing accepted ADRs, modifying database migrations, changing auth boundaries, or adding an out-of-scope feature.
- An implementation agent must not use customer documents, credentials, or production exports as test fixtures without explicit authorization and redaction.

## Security Rules

- Never hardcode secrets, API keys, tokens, signed URLs, or customer content. Use environment bindings and secret management.
- Never commit `.env` files, raw uploads, model prompts containing customer data, or generated evidence packs.
- Enforce tenant and project predicates on every D1 read/write and verify object ownership before issuing an R2 signed URL.
- Use secure, HTTP-only session cookies; require TOTP for approver actions and re-check authorization at decision time.
- Sanitize rendered source text and comments to prevent script injection; do not render extracted HTML as trusted markup.
- Apply rate limits to auth, upload, search, AI, and export endpoints; return retryable responses without leaking account or project existence.
- Audit role changes, source revisions, requirement reviews, evidence state changes, finding disposition, decisions, and exports in the append-only audit chain.
- Do not send proprietary standards or customer content to a model/provider unless the project has authorized that processing path.
