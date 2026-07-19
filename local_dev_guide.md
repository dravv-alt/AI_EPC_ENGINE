# Local Dev Setup Guide — AI EPC Engine

## Prerequisites

| Tool | Required For |
|------|-------------|
| **Node.js** (v20+) | Next.js app |
| **Docker + Docker Compose** | Postgres, Redis, MinIO, Python services |
| **npm** | Package management |

---

## 1. Environment Setup

```bash
cp .env.example .env
```

Then fill in `.env`. Minimum required keys:

| Key | Notes |
|-----|-------|
| `DATABASE_URL` | Already set for local Docker: `postgresql://pramana:pramana@localhost:5432/pramana` |
| `REDIS_URL` | Already set: `redis://localhost:6379` |
| `MODEL_PROVIDER` | `mock` \| `gemini` \| `nim` — generation. Leave `mock` for offline dev |
| `GEMINI_API_KEY` | Required only if `MODEL_PROVIDER=gemini` |
| `NIM_API_KEY` | Required only if `MODEL_PROVIDER=nim` (hosted by default at `NIM_BASE_URL`, or point at a self-hosted NIM endpoint) |
| `EMBEDDING_PROVIDER` | `mock` \| `service` — embeddings. Leave `mock` unless you need real semantic retrieval quality |
| `AUTH_ENCRYPTION_KEY` | Any 32+ char random string |
| `S3_*` keys | Pre-filled for local MinIO — no change needed |

> [!TIP]
> Keep `MODEL_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` for local dev — no API keys needed, and `npm run verify:all` only stays fully offline under these defaults.

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Start Background Services (Docker)

**Must be running before `npm run dev`:**

```bash
docker compose up -d postgres redis minio ingestion solver retrieval
```

| Service | Port | What it does |
|---------|------|-------------|
| **postgres** (`pgvector/pgvector:pg16`) | `5432` | Primary database (with vector extension) |
| **redis** | `6379` | BullMQ job queues + caching |
| **minio** | `9000` / `9001` (console) | S3-compatible local object storage for file uploads |
| **ingestion** (Python FastAPI) | `8001` | Document ingestion microservice (`services/ingestion/`) |
| **solver** (Python) | `8002` | Scheduling/optimization solver (`services/solver/`) |
| **retrieval** (Python FastAPI) | `8003` | Embeddings + reranking (`services/retrieval/`) — only load-bearing when `EMBEDDING_PROVIDER=service`; safe to skip starting it under the `mock` default |

> [!NOTE]
> First run builds the Python service images — takes a few minutes. The `retrieval` image additionally pre-downloads its embedding/reranker model weights at build time, so its first build is the slowest of the three.

---

## 4. Run DB Migrations

```bash
npm run db:migrate
```

Applies all Drizzle ORM migrations to the local Postgres DB.

---

## 5. (Optional) Seed the Database

```bash
npm run db:seed
```

---

## 6. Start the App

```bash
npm run dev
```

**What this spawns automatically:**
- ✅ Next.js dev server on **http://localhost:3000**

**What does NOT auto-start (run in a separate terminal):**
- ⚠️ BullMQ background worker:
  ```bash
  npm run worker
  ```
  Required for async job processing (document ingestion, AI tasks, risk polling).

---

## Full Startup Checklist

```bash
# Terminal 1 — background infra
docker compose up -d postgres redis minio ingestion solver retrieval

# One-time (or after schema changes)
npm run db:migrate

# Terminal 2 — Next.js app
npm run dev

# Terminal 3 — background worker
npm run worker
```

---

## Alternative: Full Docker Compose (no local Node needed)

```bash
docker compose up
```

Spins up everything including the Next.js app on **http://localhost:4173** and the worker. Good for a quick end-to-end test but slower iteration.

---

## Ports Summary

| Port | Service |
|------|---------|
| `3000` | Next.js (dev mode) |
| `4173` | Next.js (Docker / production mode) |
| `5432` | PostgreSQL |
| `6379` | Redis |
| `8001` | Ingestion service |
| `8002` | Solver service |
| `8003` | Retrieval service (embeddings + reranking) |
| `9000` | MinIO (S3 API) |
| `9001` | MinIO Console UI |

## Verifying your setup

```bash
npm run typecheck
npm run verify:all
```

`verify:all` is the full local test matrix — offline, no API keys needed, as long as `MODEL_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` (the defaults). See [STATUS.md](STATUS.md) for what it covers and the latest result.
