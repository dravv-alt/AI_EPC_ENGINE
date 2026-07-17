# AI_EPC_ENGINE

**AI Intelligence Platform for Data Centre EPC Project Delivery**
*Built for the ET AI Hackathon 2026*

## 📖 Overview

India is experiencing a major data-centre construction boom while experienced delivery and commissioning teams remain scarce. Information fragmentation across specifications, submittals, test records, assets, and issues makes readiness difficult to prove and creates avoidable commissioning risk.

The recommended product direction is **Pramana Cx**, an evidence control plane for mission-critical commissioning. It links every requirement to the asset, test, measurement, issue, approval, and source evidence needed to support an authorized engineer's gate decision. It assists human reviewers; it does not certify facilities or replace licensed professionals.

## Product Blueprint

The research-backed product strategy, architecture, freemium model, security controls, and eight-week delivery plan are documented in [docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md).

The reconciled implementation baseline is [PLANNER/CanonicalBuildPlan.md](PLANNER/CanonicalBuildPlan.md). The concrete first build pass is in [PLANNER/FoundationBuildPlan.md](PLANNER/FoundationBuildPlan.md).

## Core Features

* **Evidence Graph:** Maps requirements to systems, assets, tests, evidence, findings, and approvals.
* **Readiness Gates:** Computes deterministic L1-L5/custom gate status from accepted evidence and authorized decisions.
* **Change Blast Radius:** Shows which evidence, tests, and approvals become stale after a revision.
* **Source-Grounded Review:** Every AI proposal links to an exact page and region and requires human acceptance.
* **Verifiable Turnover Packs:** Exports evidence with hashes, decision history, and a signed manifest.

## Foundation Stack

* Next.js, React, and TypeScript
* PostgreSQL with Drizzle ORM — local Docker Postgres or Neon through `DATABASE_URL`
* Local or MinIO/S3 object storage, Redis/BullMQ, and a typed `edges` provenance graph
* Owned credentials/TOTP or Clerk authentication behind project-scoped RBAC
* PyMuPDF ingestion and an OR-Tools CP-SAT schedule service
* Deterministic readiness rules with audited, source-grounded AI proposals

## Local development

```bash
npm install
cp .env.example .env.local
docker compose up --build
```

Open `http://localhost:4173`. The Compose topology starts pgvector/PostgreSQL, Redis, MinIO, PyMuPDF ingestion, CP-SAT solver, the core API, and its worker. The default local mode uses a clearly labelled development identity; set `AUTH_MODE=credentials` and a strong `AUTH_ENCRYPTION_KEY` for owned password/TOTP authentication.

```bash
npm run typecheck
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run verify:phase0
npm run verify:schedule-http
npm run verify:audit
```

To use Neon, replace `DATABASE_URL` in `.env.local` with your Neon PostgreSQL connection string. Clerk remains optional: set `AUTH_MODE=clerk` and supply its publishable and secret keys.
