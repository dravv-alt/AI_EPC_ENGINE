# Windows and Linux local setup

This is the canonical developer setup for Pramana Cx. It runs PostgreSQL,
Redis, MinIO, ingestion, solver, and retrieval in Docker; Ollama and the
Next.js processes run on the host; Clerk provides authentication.

The application opens at [http://localhost:3000](http://localhost:3000).
The production-oriented `docker-compose.yml` is intentionally not used for
this workflow. It requires HTTPS and deployment-grade secrets.

## 1. Prerequisites

Install:

- Git
- Node.js 22 and npm
- Docker with the Compose plugin
- Ollama
- Clerk CLI

Recommended minimums are 16 GB RAM and 15 GB free disk space. The Ollama
generation model is the largest download.

### Windows 10/11

Use Docker Desktop with the WSL 2 backend. Run these commands once in an
Administrator PowerShell, restart if requested, then enable the distribution
under Docker Desktop → Settings → Resources → WSL Integration:

```powershell
wsl --install
wsl --update
```

Keep the repository inside the WSL filesystem (for example
`~/projects/AI_EPC_ENGINE`) for substantially faster bind mounts and builds.
Open Ubuntu/WSL and follow the Linux shell commands in this guide. Native
PowerShell equivalents are included where the command differs.

Official references:

- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Docker Desktop with WSL 2](https://docs.docker.com/desktop/features/wsl/)
- [Ollama for Windows](https://docs.ollama.com/windows)

### Ubuntu/Debian Linux

Install Docker Engine and the Compose plugin from Docker's official
repository. Verify the daemon before continuing:

```bash
docker --version
docker compose version
docker info
```

If Docker requires `sudo`, either prefix the Compose commands with `sudo` or
complete Docker's documented non-root post-installation steps.

Official references:

- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Compose plugin](https://docs.docker.com/compose/install/linux/)

## 2. Clone and install

```bash
git clone https://github.com/dravv-alt/AI_EPC_ENGINE.git
cd AI_EPC_ENGINE
npm ci
cp .env.example .env.local
```

Native PowerShell:

```powershell
git clone https://github.com/dravv-alt/AI_EPC_ENGINE.git
Set-Location AI_EPC_ENGINE
npm ci
Copy-Item .env.example .env.local
```

`.env.local` is ignored by Git. Never commit it or paste
`CLERK_SECRET_KEY` into source code, screenshots, tickets, or documentation.

## 3. Start developer infrastructure

The developer Compose file exposes every dependency to the host:

```bash
docker compose -f docker-compose.dev.yml up -d --build postgres redis minio ingestion solver retrieval
docker compose -f docker-compose.dev.yml ps
```

Wait until PostgreSQL, Redis, ingestion, solver, and retrieval are healthy.
MinIO's console is available at [http://localhost:9001](http://localhost:9001)
with the local-only credentials shown in `.env.example`.

This topology is for a developer laptop only. It deliberately uses predictable
database and MinIO credentials and must not be deployed.

## 4. Install and verify Ollama

The checked-in model configuration is:

```text
MODEL_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e2b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
```

### Windows

Install `OllamaSetup.exe` from the
[official Windows page](https://docs.ollama.com/windows). The desktop
installation normally starts the Ollama service automatically. Open a new
PowerShell:

```powershell
ollama pull gemma4:e2b
ollama pull nomic-embed-text:latest
ollama list
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull gemma4:e2b
ollama pull nomic-embed-text:latest
ollama list
```

If the distribution does not use systemd, run `ollama serve` in a dedicated
terminal.

Verify both structured generation and the required 768-dimensional embedding:

```bash
npm run verify:ollama
```

### Ollama-in-Docker fallback

Native Ollama generally provides better GPU support. For a portable CPU
fallback:

```bash
docker compose -f docker-compose.dev.yml --profile container-ollama up -d ollama ollama-models
```

The host application still uses `http://127.0.0.1:11434`. Do not change it to
the Compose service name unless the application itself is running in Docker.

## 5. Link Clerk

The repository is linked to Clerk application
`app_3H8hkjTJXpa5w987cCoDFNSCmcU`.

```bash
npm install -g clerk
clerk update --yes
clerk auth login
clerk init --app app_3H8hkjTJXpa5w987cCoDFNSCmcU
clerk doctor
```

`clerk auth login` must run before `clerk init`. Complete the browser login
when prompted. `clerk init` writes the development publishable and secret keys
to the ignored local environment file.

Confirm these non-secret settings exist in `.env.local`:

```text
AUTH_MODE=clerk
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/pending-access
```

Do not copy Clerk keys from another developer. Each developer must authenticate
through the CLI. See the [Clerk CLI documentation](https://clerk.com/docs/cli).

## 6. Migrate and seed PostgreSQL

```bash
npm run db:migrate
npm run db:seed
```

The seed is idempotent. It creates the Mumbai DC-07 project, controlled sample
data, and the checked-in test memberships. Clerk authenticates identity; the
local `users` and `project_members` tables remain authoritative for application
roles.

If a signed-in email is not a seeded member, `/pending-access` is expected.
Add the email through project administration or add an intentional development
membership to `scripts/seed.ts` and reseed. Do not bypass membership checks in
middleware or UI code.

## 7. Start the application

Use separate terminals:

```bash
# Terminal 1
npm run dev:clerk

# Terminal 2
npm run worker
```

Open [http://localhost:3000](http://localhost:3000), sign in, and confirm the
profile button appears. The worker is required for queued extraction, AI, and
risk jobs.

## 8. Verify the complete setup

Linux/WSL:

```bash
curl -fsS http://localhost:3000/api/health
npm run typecheck
npm run build
npm run verify:ollama
```

PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
npm run typecheck
npm run build
npm run verify:ollama
```

The health response must identify Clerk authentication and the configured
Ollama providers. Test sign-in, a Knowledge query, a source citation, and a
shipment weather refresh before considering the laptop ready.

### Terminal PDF ingestion and RAG verification

Windows PowerShell:

```powershell
npm run source:import -- --file "C:\Documents\source.pdf" --title "Controlled source title" --revision "Rev A" --project "MDC-07" --actor "project.admin@example.com" --type "standard"
npm run source:query -- --document "Controlled source title" --project "MDC-07" --query "How is high availability designed?" --synthesize
```

Linux:

```bash
npm run source:import -- --file "/home/user/Documents/source.pdf" --title "Controlled source title" --revision "Rev A" --project "MDC-07" --actor "project.admin@example.com" --type "standard"
npm run source:query -- --document "Controlled source title" --project "MDC-07" --query "How is high availability designed?" --synthesize
```

The importer is idempotent by PDF SHA-256 and rejects actors without
`source:upload`. The query command reports the active embedding model, vector
dimensions, similarity scores, page numbers, source-region IDs, excerpts, and
optional grounded synthesis.

## Ports

| Port | Process |
| ---: | --- |
| 3000 | Next.js development server |
| 5432 | PostgreSQL with pgvector |
| 6379 | Redis/BullMQ |
| 8001 | Ingestion |
| 8002 | CP-SAT solver |
| 8003 | Retrieval/reranking |
| 9000 | MinIO S3 API |
| 9001 | MinIO console |
| 11434 | Ollama |

## Common failures

### Docker daemon is unavailable

Symptom: `Cannot connect to the Docker daemon` or a missing `docker.sock`.

- Windows: start Docker Desktop and verify WSL integration.
- Linux: `sudo systemctl start docker`, then run `docker info`.

### A port is already allocated

Find and stop the conflicting local process. Do not change only one side of a
port mapping; the corresponding URL in `.env.local` must match.

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs --tail=100
```

### Ollama cannot be reached

```bash
curl http://127.0.0.1:11434/api/tags
ollama list
```

If the app runs on the host, use `127.0.0.1`. If the app runs in the deployment
Compose topology, it must use `http://ollama:11434`; container loopback points
back to the container itself.

### Knowledge returns no matches

Confirm:

1. the source version is processed and has extracted regions;
2. `nomic-embed-text:latest` is installed;
3. `EMBEDDING_PROVIDER=ollama`;
4. stored vectors were generated with the currently selected embedding model;
5. `npm run verify:ollama` succeeds.

Restart the worker after environment changes.

### Clerk redirects to pending access

Authentication succeeded, but the email does not have a local project
membership. Reseed the intended development membership or ask a project admin
to add it. Changing the Clerk application does not grant a Pramana project
role.

### Clerk proxy or redirect loop

Run `clerk doctor` and confirm `src/proxy.ts` contains the API matcher followed
by `/__clerk/:path*`. Confirm `APP_BASE_URL` and Clerk redirect URLs use port
3000 for host development.

### Resetting local infrastructure

The following command permanently removes the developer database, object
storage, and containerized Ollama models:

```bash
docker compose -f docker-compose.dev.yml --profile container-ollama down -v
```

Use it only when a complete local reset is intended, then rerun migrations and
the seed.

## Deployment Compose

`docker-compose.yml` is a separate, fail-closed topology. Copy
`.env.compose.example` to `.env`, replace every placeholder with secret-managed
values, configure a real HTTPS `APP_BASE_URL`, and pin approved image tags or
digests before using it. It is not the developer quick start.
