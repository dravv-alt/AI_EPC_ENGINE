# AI_EPC_ENGINE

**AI Intelligence Platform for Data Centre EPC Project Delivery**
*Built for the ET AI Hackathon 2026*

## 📖 Overview

India is experiencing a major data-centre construction boom while experienced delivery and commissioning teams remain scarce. Information fragmentation across specifications, submittals, test records, assets, and issues makes readiness difficult to prove and creates avoidable commissioning risk.

The recommended product direction is **Pramana Cx**, an evidence control plane for mission-critical commissioning. It links every requirement to the asset, test, measurement, issue, approval, and source evidence needed to support an authorized engineer's gate decision. It assists human reviewers; it does not certify facilities or replace licensed professionals.

## Product Blueprint

The research-backed product strategy, architecture, freemium model, security controls, and eight-week delivery plan are documented in [docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md).

The PlanBoard workflow output is available in [PLANNER/StructuredPlan.md](PLANNER/StructuredPlan.md), with its approval state tracked in [PLANNER/Tracker.md](PLANNER/Tracker.md).

## Core Features

* **Evidence Graph:** Maps requirements to systems, assets, tests, evidence, findings, and approvals.
* **Readiness Gates:** Computes deterministic L1-L5/custom gate status from accepted evidence and authorized decisions.
* **Change Blast Radius:** Shows which evidence, tests, and approvals become stale after a revision.
* **Source-Grounded Review:** Every AI proposal links to an exact page and region and requires human acceptance.
* **Verifiable Turnover Packs:** Exports evidence with hashes, decision history, and a signed manifest.

## Proposed Tech Stack

* Next.js and TypeScript on Cloudflare Workers
* D1, R2, Vectorize, Workflows, and Queues
* Better Auth with project-scoped RBAC
* Hybrid FTS and vector retrieval with exact source provenance
* Deterministic readiness rules with eval-gated AI extraction

## Getting Started

*(Setup and installation instructions will be added as development begins)*
