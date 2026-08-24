# Local development guide

This is the working laptop setup for this repo. It is the version that was validated on this machine and is the quickest way to get everything running locally.

Reference docs:

- [Windows and Linux local setup](docs/LOCAL_SETUP_WINDOWS_LINUX.md)
- [Reported errors and implemented fixes](docs/ERRORS_AND_FIXES.md)
- [Backend authority and propagation audit](docs/BACKEND_AUTHORITY_AUDIT.md)

## 1. Prerequisites

Install:

- Git
- Node.js 22 + npm
- Docker Desktop or Docker Engine with Compose
- Ollama
- Clerk CLI only if you want to test the Clerk flow

This repo expects a local dev environment, not the production Docker stack.
Do not use `docker-compose.yml` for the laptop workflow. It is intentionally a
production-oriented, fail-closed setup.

## 2. Install dependencies

From the repo root:

```bash
npm ci
cp .env.example .env.local
```

PowerShell equivalent:

```powershell
npm ci
Copy-Item .env.example .env.local
```

The checked-in local file already uses the development auth mode by default:

```env
AUTH_MODE=development
APP_BASE_URL=http://localhost:3000
```

## 3. Start Docker infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d --build postgres redis minio ingestion solver retrieval
docker compose -f docker-compose.dev.yml ps
```

Wait until Postgres, Redis, ingestion, solver, and retrieval report healthy.

## 4. Start Ollama and pull the required models

```bash
ollama serve
ollama pull gemma4:e2b
ollama pull nomic-embed-text:latest
```

These are the models configured in the repo:

```env
MODEL_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
OLLAMA_MODEL=gemma4:e2b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
```

## 5. Initialize the local database and seed users

Run:

```bash
npm run db:migrate
npm run db:seed
```

This creates the seeded demo project and the local accounts used for development.

### Working local login account

The repo's development login account is:

- Email: manager@pramana.local
- Password: Pramana@123!

This is the account to use when the app is running in development mode.
The seed file also includes:

- field@pramana.local
- approver@pramana.local
- testbeta@ipdkimkc.com
- atharva.v.deo@gmail.com

## 6. Start the app

Open one terminal for the app and another for the worker.

Terminal 1:

```bash
AUTH_MODE=development npm run dev
```

PowerShell:

```powershell
$env:AUTH_MODE='development'; npm run dev
```

Terminal 2:

```bash
npm run worker
```

The app is available at:

[http://localhost:3000](http://localhost:3000)

## 7. Optional Clerk setup

If your team has access to the linked Clerk application, you can run:

```bash
clerk auth login
clerk init --app app_3H8hkjTJXpa5w987cCoDFNSCmcU
```

Then update `.env.local` to:

```env
AUTH_MODE=clerk
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/pending-access
```

If the Clerk app is not available to your account, the local development setup above remains the reliable fallback and should be used instead.

## 8. Quick summary of the commands to run next time

```bash
npm ci
Copy-Item .env.example .env.local

docker compose -f docker-compose.dev.yml up -d --build postgres redis minio ingestion solver retrieval
ollama serve
ollama pull gemma4:e2b
ollama pull nomic-embed-text:latest

npm run db:migrate
npm run db:seed

# Terminal 1
$env:AUTH_MODE='development'; npm run dev

# Terminal 2
npm run worker
```

Then log in with:

- Email: manager@pramana.local
- Password: Pramana@123!
