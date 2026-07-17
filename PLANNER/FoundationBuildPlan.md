# Foundation Build Plan

## Decisions

- Use local PostgreSQL as the development database. Neon is supported later by supplying its standard PostgreSQL connection string as `DATABASE_URL`; no schema or repository code changes are required.
- Use the relational `edges` table as the project graph. Do not introduce Neo4j as an authoritative database.
- Keep authentication behind an `AuthProvider` boundary. Local/owned credentials use persisted opaque sessions and TOTP; Clerk remains an optional adapter when its keys are supplied. Project membership, never provider metadata, is the authorization authority.
- Use Next.js, TypeScript, Drizzle, Postgres, Redis, and MinIO-compatible object storage. The codebase is structured so each domain module can be built independently on feature branches.

## Deliverables in this foundation pass

1. App/tooling configuration and Docker services.
2. Design tokens, typography, responsive layout, reusable status primitives.
3. Domain types, environment validation, and an API health endpoint.
4. Drizzle schema for the core audit/provenance graph.
5. RBAC role matrix and authorization helpers.
6. Credentials/TOTP provider, development provider, and Clerk activation contract.
7. Project shell, navigation, search, account affordance, and mobile navigation.
8. Project overview and deterministic readiness presentation.
9. Source Library and ingestion/job-state API shape.
10. Requirement review, system/gate, findings/action, and audit-ready API seams.

## Manual setup after this pass

1. Copy `.env.example` to `.env.local` and set a local Postgres URL, or a Neon `DATABASE_URL`.
2. Run `docker compose up -d postgres redis minio` for local services, then `npm run db:generate` and `npm run db:migrate`.
3. For owned credentials, set a strong `AUTH_ENCRYPTION_KEY` and change `AUTH_MODE=credentials`. Clerk remains optional via its publishable/secret keys and `AUTH_MODE=clerk`.
4. Set `OBJECT_STORAGE_DRIVER=s3` for MinIO/S3 and add Gemini or AIS/weather credentials only when activating those adapters.
